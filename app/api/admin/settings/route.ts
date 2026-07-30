/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAdmin } from "../../../../lib/auth";
import { apiError, getD1, getEnv } from "../../../../lib/db";

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const db = getD1();
    const [agencies, profile, settings] = await Promise.all([
      db.prepare("SELECT * FROM agencies ORDER BY is_active DESC, name").all(),
      db.prepare("SELECT * FROM business_profiles ORDER BY id DESC LIMIT 1").first(),
      db.prepare("SELECT key,value_json,updated_at FROM app_settings WHERE key NOT LIKE '%api_key%'").all(),
    ]);
    return Response.json({
      agencies: agencies.results,
      profile,
      settings: settings.results,
      secrets: {
        openai: Boolean(getEnv().OPENAI_API_KEY),
        dataGoKr: Boolean(getEnv().DATA_GO_KR_SERVICE_KEY),
        bizinfo: Boolean(getEnv().BIZINFO_API_KEY),
      },
      models: [
        { id: "gpt-5.6-luna", label: "비용 절감", note: "대량 분류·빠른 요약" },
        { id: "gpt-5.6-terra", label: "가성비", note: "일상 분석 기본값" },
        { id: "gpt-5.6-sol", label: "고성능", note: "복잡한 제안 전략" },
      ],
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await request.json() as Record<string, any>;
    const db = getD1();
    if (body.type === "profile") {
      await db.prepare(`
        INSERT INTO business_profiles
        (company_name,intro,technologies,services,achievements,strengths,target_markets,preferred_categories,excluded_categories,budget_range,service_regions)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        body.companyName || "", body.intro || "", body.technologies || "", body.services || "",
        body.achievements || "", body.strengths || "", body.targetMarkets || "",
        body.preferredCategories || "", body.excludedCategories || "", body.budgetRange || "", body.serviceRegions || "",
      ).run();
    } else if (body.type === "models") {
      const safe = {
        summary: body.summary || "gpt-5.6-luna",
        relevance: body.relevance || "gpt-5.6-terra",
        attachment: body.attachment || "gpt-5.6-terra",
        classification: body.classification || "gpt-5.6-luna",
      };
      await db.prepare(`
        INSERT INTO app_settings (key,value_json) VALUES ('ai_models',?)
        ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP
      `).bind(JSON.stringify(safe)).run();
    } else if (body.type === "agency") {
      await db.prepare(`
        INSERT INTO agencies (name,type,region_sido,homepage_url,source_type,source_config,is_active)
        VALUES (?,?,?,?,?,?,?)
      `).bind(body.name || "", body.agencyType || "기타 공공기관", body.region || "전국",
        body.homepageUrl || "", body.sourceType || "api", JSON.stringify(body.sourceConfig || {}), body.isActive === false ? 0 : 1).run();
    } else {
      return Response.json({ error: "지원하지 않는 설정입니다." }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
