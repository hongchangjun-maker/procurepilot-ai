import { env } from "cloudflare:workers";

export type AppEnv = {
  DB: D1Database;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  DATA_GO_KR_SERVICE_KEY?: string;
  BIZINFO_API_KEY?: string;
  ADMIN_PASSWORD?: string;
  APP_ENCRYPTION_KEY?: string;
};

export function getEnv() {
  return env as unknown as AppEnv;
}

export function getD1() {
  const binding = getEnv().DB;
  if (!binding) throw new Error("D1 데이터베이스가 연결되지 않았습니다.");
  return binding;
}

export function apiError(error: unknown, fallback = "요청을 처리하지 못했습니다.") {
  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message }, { status: 500 });
}
