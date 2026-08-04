import { requireAdmin, requireSameOrigin } from "../../../../../lib/auth";
import { collectHtmlAgency, validateScrapeConfig, type AgencySource } from "../../../../../lib/connectors";
import { apiError } from "../../../../../lib/db";

export async function POST(request: Request) {
  const wrongOrigin = requireSameOrigin(request);
  if (wrongOrigin) return wrongOrigin;
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await request.json() as Record<string, unknown>;
    const config = validateScrapeConfig(body.sourceConfig);
    const source: AgencySource = {
      id: 0,
      name: String(body.name || "수집 테스트").trim() || "수집 테스트",
      type: String(body.agencyType || "기타 공공기관"),
      region_sido: String(body.region || "전국"),
      homepage_url: config.url,
      source_type: "scrape",
      source_config: JSON.stringify(config),
      is_active: 1,
    };
    const result = await collectHtmlAgency(source, {});
    return Response.json({ ok: true, message: result.message, samples: result.items.slice(0, 5) });
  } catch (error) {
    return apiError(error, "수집 테스트에 실패했습니다.");
  }
}
