import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("renders the Korean commercial procurement dashboard", async () => {
  const dashboard = await readFile(new URL("../app/procure-dashboard.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /필로소피 AI/);
  assert.match(dashboard, /입찰 공고 스크래퍼/);
  assert.match(dashboard, /공식 공고 수집부터 AI 요약/);
  assert.match(dashboard, /마스터 관리자/);
  assert.match(dashboard, /수집 시작/);
  assert.match(dashboard, /\/hero-banner\.png/);
  assert.doesNotMatch(dashboard, /codex-preview|Your site is taking shape/);
});

test("ships production assets and no disposable starter", async () => {
  const [layout, dashboard, packageJson] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/procure-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  await access(new URL("../public/hero-banner.png", import.meta.url));
  await access(new URL("../public/og.png", import.meta.url));
  assert.match(layout, /openGraph/);
  assert.match(dashboard, /연결되지 않은 소스는 결과를 만들지 않습니다/);
  assert.match(dashboard, /ChatGPT API 키 입력/);
  assert.match(dashboard, /API 키 저장/);
  assert.match(dashboard, /연결 테스트/);
  const auth = await readFile(new URL("../lib/auth.ts", import.meta.url), "utf8");
  const secrets = await readFile(new URL("../lib/secrets.ts", import.meta.url), "utf8");
  const settingsRoute = await readFile(new URL("../app/api/admin/settings/route.ts", import.meta.url), "utf8");
  assert.match(auth, /isLocal \? "6085" : ""/);
  assert.match(secrets, /AES-GCM/);
  assert.match(secrets, /openai_api_key_encrypted/);
  assert.match(settingsRoute, /openaiMasked/);
  assert.doesNotMatch(settingsRoute, /value_json:\s*openai/i);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});

test("connects real public sources without fabricating collection results", async () => {
  const [dashboard, connectors, collectRoute, settingsRoute, migration] = await Promise.all([
    readFile(new URL("../app/procure-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/connectors.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/collect/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/settings/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0001_bumpy_iceman.sql", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /정보 유형/);
  assert.match(dashboard, /예산 범위\(원\)/);
  assert.match(dashboard, /저장 전 수집 테스트/);
  assert.match(connectors, /validateOfficialUrl/);
  assert.match(connectors, /\.go\.kr, \.or\.kr, \.ac\.kr/);
  assert.match(connectors, /HTMLRewriter/);
  assert.match(collectRoute, /Promise\.allSettled/);
  assert.match(collectRoute, /sourceNew/);
  assert.match(settingsRoute, /savePublicDataKey/);
  assert.match(migration, /mss\.go\.kr/);
  assert.doesNotMatch(connectors, /items:\s*\[\s*\{/);
});
