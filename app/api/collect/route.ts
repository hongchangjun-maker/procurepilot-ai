import {
  collectBizinfo,
  collectG2B,
  collectHtmlAgency,
  duplicateKey,
  type AgencySource,
  type CollectFilter,
  type ConnectorResult,
  type OpportunityInput,
} from "../../../lib/connectors";
import { requireSameOrigin } from "../../../lib/auth";
import { apiError, getD1 } from "../../../lib/db";

async function saveOpportunity(db: D1Database, item: OpportunityInput) {
  const key = duplicateKey(item);
  const existing = await db.prepare("SELECT id FROM opportunities WHERE duplicate_key = ?").bind(key).first<{ id: number }>();
  const values = [
    item.sourceName, item.sourceNoticeId, item.title, item.agencyName, item.agencyType, item.regionSido,
    item.regionSigungu, item.category, item.noticeType, item.publishedAt, item.deadlineAt,
    item.budget, item.summaryRaw, item.detailText, item.originalUrl,
    item.deadlineAt && item.deadlineAt < new Date().toISOString().slice(0, 10) ? "마감" : "진행중",
  ];
  if (existing) {
    await db.prepare(`
      UPDATE opportunities SET source_name=?, source_notice_id=?, title=?, agency_name=?, agency_type=?,
      region_sido=?, region_sigungu=?, category=?, notice_type=?, published_at=?, deadline_at=?,
      budget=?, summary_raw=?, detail_text=?, original_url=?, status=?, version=version+1,
      updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).bind(...values, existing.id).run();
    return "updated";
  }
  await db.prepare(`
    INSERT INTO opportunities
      (source_name,source_notice_id,title,agency_name,agency_type,region_sido,region_sigungu,category,
      notice_type,published_at,deadline_at,budget,summary_raw,detail_text,original_url,status,duplicate_key)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(...values, key).run();
  return "new";
}

function parseFilter(value: unknown): CollectFilter {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, unknown>;
  const number = (input: unknown) => {
    const parsed = Number(input);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  };
  return {
    region: String(raw.region || "전국").slice(0, 30),
    category: String(raw.category || "전체").slice(0, 40),
    agencyType: String(raw.agencyType || "전체").slice(0, 40),
    noticeType: String(raw.noticeType || "전체").slice(0, 40),
    keyword: String(raw.keyword || "").trim().slice(0, 80),
    days: Math.max(1, Math.min(30, number(raw.days) || 7)),
    minBudget: number(raw.minBudget),
    maxBudget: number(raw.maxBudget),
  };
}

async function logResult(db: D1Database, source: string, startedAt: string, status: string, total: number, created: number, updated: number, error = "") {
  await db.prepare(`
    INSERT INTO collection_logs (source_name,started_at,ended_at,status,total_count,new_count,updated_count,error_message)
    VALUES (?,?,?,?,?,?,?,?)
  `).bind(source, startedAt, new Date().toISOString(), status, total, created, updated, error).run();
}

export async function POST(request: Request) {
  const wrongOrigin = requireSameOrigin(request);
  if (wrongOrigin) return wrongOrigin;
  const startedAt = new Date().toISOString();
  try {
    if (request.headers.get("content-length") && Number(request.headers.get("content-length")) > 20_000) {
      return Response.json({ error: "요청 크기가 너무 큽니다." }, { status: 413 });
    }
    const filter = parseFilter(await request.json());
    if (filter.minBudget && filter.maxBudget && filter.minBudget > filter.maxBudget) {
      return Response.json({ error: "최소 예산은 최대 예산보다 클 수 없습니다." }, { status: 400 });
    }
    const db = getD1();
    const recent = await db.prepare("SELECT started_at FROM collection_logs WHERE datetime(started_at) >= datetime('now','-20 seconds') LIMIT 1").first();
    if (recent) return Response.json({ error: "공식 사이트 보호를 위해 잠시 후 다시 수집해 주세요." }, { status: 429 });

    const configured = await db.prepare(`
      SELECT id,name,type,region_sido,homepage_url,source_type,source_config,is_active
      FROM agencies WHERE is_active=1 AND source_type='scrape' ORDER BY id LIMIT 8
    `).all<AgencySource>();
    const jobs: Array<{ name: string; run: () => Promise<ConnectorResult> }> = [
      { name: "나라장터", run: () => collectG2B(filter) },
      { name: "기업마당", run: () => collectBizinfo(filter) },
      ...configured.results.map((source) => ({ name: source.name, run: () => collectHtmlAgency(source, filter) })),
    ];
    const settled = await Promise.allSettled(jobs.map((job) => job.run()));
    let newCount = 0;
    let updatedCount = 0;
    const sources: Array<{ source: string; connected: boolean; message: string }> = [];
    for (let index = 0; index < settled.length; index++) {
      const result = settled[index];
      const sourceName = jobs[index].name;
      if (result.status === "rejected") {
        const message = result.reason instanceof Error ? result.reason.message : "수집 실패";
        sources.push({ source: sourceName, connected: false, message });
        await logResult(db, sourceName, startedAt, "실패", 0, 0, 0, message);
        continue;
      }
      let sourceNew = 0;
      let sourceUpdated = 0;
      for (const item of result.value.items) {
        const outcome = await saveOpportunity(db, item);
        if (outcome === "new") sourceNew++;
        else sourceUpdated++;
      }
      newCount += sourceNew;
      updatedCount += sourceUpdated;
      sources.push({ source: result.value.source, connected: result.value.connected, message: result.value.message });
      await logResult(db, result.value.source, startedAt, result.value.connected ? "완료" : "연결 필요",
        result.value.items.length, sourceNew, sourceUpdated, result.value.connected ? "" : result.value.message);
    }
    if (!sources.some((source) => source.connected)) {
      return Response.json({ error: "연결된 공식 데이터 소스가 없습니다.", sources }, { status: 424 });
    }
    return Response.json({ ok: true, newCount, updatedCount, sources });
  } catch (error) {
    return apiError(error, "수집에 실패했습니다.");
  }
}
