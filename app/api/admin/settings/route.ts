/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAdmin, requireSameOrigin } from "../../../../lib/auth";
import { apiError, getD1 } from "../../../../lib/db";
import { validateScrapeConfig } from "../../../../lib/connectors";
import { getOpenAIKeyStatus, getPublicDataKeyStatus, saveOpenAIKey, savePublicDataKey } from "../../../../lib/secrets";

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const db = getD1();
    const [agencies, profile, settings, openaiStatus, dataGoStatus, bizinfoStatus, stats] = await Promise.all([
      db.prepare("SELECT * FROM agencies ORDER BY is_active DESC, name").all(),
      db.prepare("SELECT * FROM business_profiles ORDER BY id DESC LIMIT 1").first(),
      db.prepare("SELECT key,value_json,updated_at FROM app_settings WHERE key NOT LIKE '%api_key%'").all(),
      getOpenAIKeyStatus(),
      getPublicDataKeyStatus("data_go_kr_service_key"),
      getPublicDataKeyStatus("bizinfo_api_key"),
      db.prepare("SELECT COUNT(*) total FROM opportunities").first(),
    ]);
    return Response.json({
      agencies: agencies.results,
      profile,
      settings: settings.results,
      secrets: {
        openai: openaiStatus.configured,
        openaiSource: openaiStatus.source,
        openaiMasked: openaiStatus.masked,
        dataGoKr: dataGoStatus.configured,
        dataGoKrMasked: dataGoStatus.masked,
        bizinfo: bizinfoStatus.configured,
        bizinfoMasked: bizinfoStatus.masked,
      },
      stats,
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
  const wrongOrigin = requireSameOrigin(request);
  if (wrongOrigin) return wrongOrigin;
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await request.json() as Record<string, any>;
    const db = getD1();
    if (body.type === "openai_key") {
      const apiKey = String(body.apiKey || "").trim();
      if (!apiKey.startsWith("sk-") || apiKey.length < 20 || apiKey.length > 512) {
        return Response.json({ error: "유효한 OpenAI API 키를 입력해 주세요." }, { status: 400 });
      }
      await saveOpenAIKey(apiKey);
    } else if (body.type === "source_key") {
      const name = String(body.name || "");
      const apiKey = String(body.apiKey || "").trim();
      if (!(["data_go_kr_service_key", "bizinfo_api_key"] as const).includes(name as "data_go_kr_service_key" | "bizinfo_api_key")) {
        return Response.json({ error: "지원하지 않는 공공데이터 키입니다." }, { status: 400 });
      }
      if (apiKey.length < 8 || apiKey.length > 1024) return Response.json({ error: "서비스키를 확인해 주세요." }, { status: 400 });
      await savePublicDataKey(name as "data_go_kr_service_key" | "bizinfo_api_key", apiKey);
    } else if (body.type === "profile") {
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
      const name = String(body.name || "").trim().slice(0, 100);
      if (!name) return Response.json({ error: "기관명을 입력해 주세요." }, { status: 400 });
      const sourceType = body.sourceType === "scrape" ? "scrape" : "api";
      const sourceConfig = sourceType === "scrape" ? validateScrapeConfig(body.sourceConfig) : (body.sourceConfig || {});
      await db.prepare(`
        INSERT INTO agencies (name,type,region_sido,homepage_url,source_type,source_config,is_active)
        VALUES (?,?,?,?,?,?,?)
      `).bind(name, body.agencyType || "기타 공공기관", body.region || "전국",
        sourceType === "scrape" ? sourceConfig.url : String(body.homepageUrl || "").slice(0, 500), sourceType,
        JSON.stringify(sourceConfig), body.isActive === false ? 0 : 1).run();
    } else if (body.type === "agency_state") {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "기관 ID가 올바르지 않습니다." }, { status: 400 });
      await db.prepare("UPDATE agencies SET is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(body.isActive ? 1 : 0, id).run();
    } else if (body.type === "agency_delete") {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "기관 ID가 올바르지 않습니다." }, { status: 400 });
      await db.prepare("DELETE FROM agencies WHERE id=?").bind(id).run();
    } else {
      return Response.json({ error: "지원하지 않는 설정입니다." }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
