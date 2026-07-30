import { apiError, getD1, getEnv } from "../../../lib/db";

export async function GET() {
  try {
    const db = getD1();
    const [opportunities, logs, profile, stats] = await Promise.all([
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
          SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) today,
          SUM(CASE WHEN deadline_at != '' AND date(deadline_at) BETWEEN date('now') AND date('now','+7 day') THEN 1 ELSE 0 END) urgent,
          SUM(CASE WHEN status = '마감' OR (deadline_at != '' AND date(deadline_at) < date('now')) THEN 1 ELSE 0 END) closed
        FROM opportunities
      `).first(),
    ]);
    return Response.json({
      opportunities: opportunities.results,
      logs: logs.results,
      profile,
      stats,
      connections: {
        g2b: Boolean(getEnv().DATA_GO_KR_SERVICE_KEY),
        bizinfo: Boolean(getEnv().BIZINFO_API_KEY),
        openai: Boolean(getEnv().OPENAI_API_KEY),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
