import { requireAdmin, requireSameOrigin } from "../../../../lib/auth";
import { getOpenAIKey } from "../../../../lib/secrets";

export async function POST(request: Request) {
  const wrongOrigin = requireSameOrigin(request);
  if (wrongOrigin) return wrongOrigin;
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const key = await getOpenAIKey();
  if (!key) return Response.json({ error: "저장된 OpenAI API 키가 없습니다." }, { status: 424 });
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { authorization: `Bearer ${key}` },
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    return Response.json({ error: detail?.error?.message || `OpenAI 연결 테스트 실패 (${response.status})` }, { status: 502 });
  }
  return Response.json({ ok: true, message: "OpenAI 연결이 정상입니다." });
}
