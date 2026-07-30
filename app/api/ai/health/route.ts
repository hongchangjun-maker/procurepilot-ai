import { requireAdmin } from "../../../../lib/auth";
import { getEnv } from "../../../../lib/db";

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const key = getEnv().OPENAI_API_KEY;
  if (!key) return Response.json({ error: "OPENAI_API_KEY가 배포 환경에 설정되지 않았습니다." }, { status: 424 });
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { authorization: `Bearer ${key}` },
  });
  if (!response.ok) return Response.json({ error: `OpenAI 연결 테스트 실패 (${response.status})` }, { status: 502 });
  return Response.json({ ok: true, message: "OpenAI 연결이 정상입니다." });
}
