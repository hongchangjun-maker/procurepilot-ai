import { apiError, getD1 } from "../../../lib/db";
import { getOpenAIKeyStatus, getPublicDataKeyStatus } from "../../../lib/secrets";

export async function GET() {
  try {
    const db = getD1();
    const [opportunities, logs, profile, stats, openaiStatus, g2bStatus, bizinfoStatus, scrapeSources] = await Promise.all([
      db.prepare(`
        SELECT o.*, a.summary_json, a.relevance_score, a.relevance_grade,
          a.relevance_reason, a.strengths, a.weaknesses, a.strategy, a.model_name,
          n.note, n.is_favorite, n.tags
        FROM opportunities o
        LEFT JOIN ai_analyses a ON a.opportunity_id = o.id
        LEFT JOIN user_notes n ON n.opportunity_id = o.id
        ORDER BY CASE WHEN o.deadline_at = '' THEN 1 ELSE 0 END, o.deadline_at ASC
        LIMIT 250
      `).all(),
      db.prepare("SELECT * FROM collection_logs ORDER BY id DESC LIMIT 12").all(),
      db.prepare("SELECT * FROM business_profiles ORDER BY id DESC LIMIT 1").first(),
      db.prepare(`
        SELECT COUNT(*) total,
          COALESCE(SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END),0) today,
          COALESCE(SUM(CASE WHEN deadline_at != '' AND date(deadline_at) BETWEEN date('now') AND date('now','+7 day') THEN 1 ELSE 0 END),0) urgent,
          COALESCE(SUM(CASE WHEN status = '마감' OR (deadline_at != '' AND date(deadline_at) < date('now')) THEN 1 ELSE 0 END),0) closed
        FROM opportunities
      `).first(),
      getOpenAIKeyStatus(),
      getPublicDataKeyStatus("data_go_kr_service_key"),
      getPublicDataKeyStatus("bizinfo_api_key"),
      db.prepare("SELECT COUNT(*) count FROM agencies WHERE is_active=1 AND source_type='scrape'").first<{ count: number }>(),
    ]);
    return Response.json({
      opportunities: opportunities.results,
      logs: logs.results,
      profile,
      stats,
      connections: {
        g2b: g2bStatus.configured,
        bizinfo: bizinfoStatus.configured,
        scraper: Boolean(scrapeSources?.count),
        openai: openaiStatus.configured,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
