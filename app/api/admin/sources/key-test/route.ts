import { requireAdmin, requireSameOrigin } from "../../../../../lib/auth";
import { collectBizinfo, collectG2B } from "../../../../../lib/connectors";
import { apiError } from "../../../../../lib/db";

export async function POST(request: Request) {
  const wrongOrigin = requireSameOrigin(request);
  if (wrongOrigin) return wrongOrigin;
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await request.json() as { name?: string };
    const result = body.name === "bizinfo_api_key" ? await collectBizinfo({ days: 1 }) : await collectG2B({ days: 1 });
    if (!result.connected) return Response.json({ error: result.message }, { status: 424 });
    return Response.json({ ok: true, message: `${result.source} 연결이 정상입니다. 최신 응답 ${result.items.length}건을 확인했습니다.` });
  } catch (error) {
    return apiError(error, "공공데이터 연결 테스트에 실패했습니다.");
  }
}
