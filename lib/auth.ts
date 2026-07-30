import { getEnv } from "./db";

const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

async function signature(value: string) {
  const secret = getEnv().APP_ENCRYPTION_KEY || getEnv().ADMIN_PASSWORD || "6085-development-only";
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function makeAdminCookie(request: Request) {
  const expires = Date.now() + 8 * 60 * 60 * 1000;
  const value = `${expires}.${await signature(String(expires))}`;
  const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  return `pp_admin=${value}; Path=/; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Strict; Max-Age=28800`;
}

export async function isAdmin(request: Request) {
  const raw = request.headers.get("cookie")?.match(/(?:^|;\s*)pp_admin=([^;]+)/)?.[1];
  if (!raw) return false;
  const [expires, sent] = raw.split(".");
  if (!expires || !sent || Number(expires) < Date.now()) return false;
  return sent === await signature(expires);
}

export async function requireAdmin(request: Request) {
  if (await isAdmin(request)) return null;
  return Response.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
}

export function adminPasswordMatches(value: string, request: Request) {
  const configuredSecret = getEnv().ADMIN_PASSWORD;
  const hostname = new URL(request.url).hostname;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  const configured = configuredSecret || (isLocal ? "6085" : "");
  if (!configured) return false;
  return value === configured;
}
