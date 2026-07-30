import { collectBizinfo, collectG2B, duplicateKey, type OpportunityInput } from "../../../lib/connectors";
import { apiError, getD1 } from "../../../lib/db";

async function saveOpportunity(db: D1Database, item: OpportunityInput) {
  const key = duplicateKey(item);
  const existing = await db.prepare("SELECT id FROM opportunities WHERE duplicate_key = ?").bind(key).first<{ id: number }>();
  const values = [
    item.sourceName, item.sourceNoticeId, item.title, item.agencyName, item.regionSido,
    item.regionSigungu, item.category, item.noticeType, item.publishedAt, item.deadlineAt,
    item.budget, item.summaryRaw, item.detailText, item.originalUrl,
    item.deadlineAt && item.deadlineAt < new Date().toISOString().slice(0, 10) ? "마감" : "진행중",
  ];
  if (existing) {
    await db.prepare(`
      UPDATE opportunities SET source_name=?, source_notice_id=?, title=?, agency_name=?,
      region_sido=?, region_sigungu=?, category=?, notice_type=?, published_at=?, deadline_at=?,
      budget=?, summary_raw=?, detail_text=?, original_url=?, status=?, version=version+1,
      updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).bind(...values, existing.id).run();
    return "updated";
  }
  await db.prepare(`
    INSERT INTO opportunities
      (source_name,source_notice_id,title,agency_name,region_sido,region_sigungu,category,
      notice_type,published_at,deadline_at,budget,summary_raw,detail_text,original_url,status,duplicate_key)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(...values, key).run();
  return "new";
}

export async function POST(request: Request) {
  const startedAt = new Date().toISOString();
  try {
    if (request.headers.get("content-length") && Number(request.headers.get("content-length")) > 20000) {
      return Response.json({ error: "요청 크기가 너무 큽니다." }, { status: 413 });
    }
    const filter = await request.json() as { region?: string; category?: string; keyword?: string; days?: number };
    const db = getD1();
    const settled = await Promise.allSettled([collectG2B(filter), collectBizinfo(filter)]);
    let newCount = 0;
    let updatedCount = 0;
    const sources: Array<{ source: string; connected: boolean; message: string }> = [];
    for (const result of settled) {
      if (result.status === "rejected") {
        sources.push({ source: "외부 API", connected: true, message: result.reason instanceof Error ? result.reason.message : "수집 실패" });
        continue;
      }
      sources.push({ source: result.value.source, connected: result.value.connected, message: result.value.message });
      for (const item of result.value.items) {
        const outcome = await saveOpportunity(db, item);
        if (outcome === "new") newCount++;
        else updatedCount++;
      }
      await db.prepare(`
        INSERT INTO collection_logs (source_name,started_at,ended_at,status,total_count,new_count,updated_count,error_message)
        VALUES (?,?,?,?,?,?,?,?)
      `).bind(result.value.source, startedAt, new Date().toISOString(), result.value.connected ? "완료" : "연결 필요",
        result.value.items.length, newCount, updatedCount, result.value.connected ? "" : result.value.message).run();
    }
    if (!sources.some((source) => source.connected)) {
      return Response.json({ error: "연결된 공식 데이터 소스가 없습니다.", sources }, { status: 424 });
    }
    return Response.json({ ok: true, newCount, updatedCount, sources });
  } catch (error) {
    return apiError(error, "수집에 실패했습니다.");
  }
}
