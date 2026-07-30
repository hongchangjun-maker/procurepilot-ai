import { getD1, getEnv } from "./db";

type EncryptedSecret = {
  v: 1;
  iv: string;
  ciphertext: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey() {
  const secret = getEnv().APP_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("APP_ENCRYPTION_KEY 서버 비밀값을 32자 이상으로 설정해 주세요.");
  }
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), encoder.encode(value));
  return JSON.stringify({
    v: 1,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  } satisfies EncryptedSecret);
}

export async function decryptSecret(payload: string) {
  const parsed = JSON.parse(payload) as EncryptedSecret;
  if (parsed.v !== 1 || !parsed.iv || !parsed.ciphertext) throw new Error("지원하지 않는 비밀값 형식입니다.");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(parsed.iv) },
    await encryptionKey(),
    base64ToBytes(parsed.ciphertext),
  );
  return decoder.decode(plaintext);
}

export async function saveOpenAIKey(apiKey: string) {
  const encrypted = await encryptSecret(apiKey);
  await getD1().prepare(`
    INSERT INTO app_settings (key,value_json) VALUES ('openai_api_key_encrypted',?)
    ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP
  `).bind(encrypted).run();
}

export async function getOpenAIKey() {
  const environmentKey = getEnv().OPENAI_API_KEY?.trim();
  if (environmentKey) return environmentKey;
  const row = await getD1().prepare(
    "SELECT value_json FROM app_settings WHERE key='openai_api_key_encrypted'",
  ).first<{ value_json: string }>();
  if (!row?.value_json) return null;
  return decryptSecret(row.value_json);
}

export async function getOpenAIKeyStatus() {
  const environmentKey = getEnv().OPENAI_API_KEY?.trim();
  if (environmentKey) {
    return { configured: true, source: "environment", masked: `••••${environmentKey.slice(-4)}` };
  }
  try {
    const storedKey = await getOpenAIKey();
    return storedKey
      ? { configured: true, source: "encrypted_d1", masked: `••••${storedKey.slice(-4)}` }
      : { configured: false, source: "none", masked: "" };
  } catch {
    return { configured: false, source: "unreadable", masked: "" };
  }
}
