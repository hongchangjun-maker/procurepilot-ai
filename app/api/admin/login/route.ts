import { adminPasswordMatches, makeAdminCookie } from "../../../../lib/auth";

export async function POST(request: Request) {
  const { password } = await request.json() as { password?: string };
  if (!password || !adminPasswordMatches(password)) {
    return Response.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  return Response.json({ ok: true }, { headers: { "set-cookie": await makeAdminCookie(request) } });
}
