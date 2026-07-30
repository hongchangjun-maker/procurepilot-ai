import { apiError, getD1 } from "../../../../../lib/db";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as { note?: string; isFavorite?: boolean; tags?: string };
    const db = getD1();
    await db.prepare(`
      INSERT INTO user_notes (opportunity_id,note,is_favorite,tags)
      VALUES (?,?,?,?)
      ON CONFLICT(opportunity_id) DO UPDATE SET
        note=excluded.note, is_favorite=excluded.is_favorite, tags=excluded.tags, updated_at=CURRENT_TIMESTAMP
    `).bind(Number(id), (body.note || "").slice(0, 5000), body.isFavorite ? 1 : 0, (body.tags || "").slice(0, 500)).run();
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
