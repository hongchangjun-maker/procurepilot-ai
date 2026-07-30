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
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});
