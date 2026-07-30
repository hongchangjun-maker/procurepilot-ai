/* eslint-disable @typescript-eslint/no-explicit-any */
import { getEnv } from "./db";

export type OpportunityInput = {
  sourceName: string;
  sourceNoticeId: string;
  title: string;
  agencyName: string;
  regionSido: string;
  regionSigungu: string;
  category: string;
  noticeType: string;
  publishedAt: string;
  deadlineAt: string;
  budget: number;
  summaryRaw: string;
  detailText: string;
  originalUrl: string;
};

export type CollectFilter = {
  region?: string;
  category?: string;
  keyword?: string;
  days?: number;
};

export type ConnectorResult = {
  source: string;
  connected: boolean;
  message: string;
  items: OpportunityInput[];
};

function clean(value: unknown) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function dateOnly(value: unknown) {
  const raw = clean(value);
  const match = raw.match(/(\d{4})[-.]?(\d{2})[-.]?(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function inferCategory(text: string) {
  const value = text.toLowerCase();
  if (/(인공지능|\bai\b)/i.test(value)) return "AI";
  if (/(소프트웨어|시스템|정보화)/.test(value)) return "소프트웨어";
  if (/(교육|연수|학교)/.test(value)) return "교육";
  if (/(콘텐츠|영상|홍보)/.test(value)) return "콘텐츠";
  if (/(데이터|빅데이터)/.test(value)) return "데이터";
  if (/(플랫폼|홈페이지|포털)/.test(value)) return "플랫폼 구축";
  return "기타";
}

function matchesFilter(item: OpportunityInput, filter: CollectFilter) {
  const haystack = `${item.title} ${item.agencyName} ${item.regionSido} ${item.category}`;
  if (filter.keyword && !haystack.toLowerCase().includes(filter.keyword.toLowerCase())) return false;
  if (filter.region && filter.region !== "전국" && !haystack.includes(filter.region)) return false;
  if (filter.category && filter.category !== "전체" && item.category !== filter.category) return false;
  return true;
}

export async function collectG2B(filter: CollectFilter): Promise<ConnectorResult> {
  const key = getEnv().DATA_GO_KR_SERVICE_KEY;
  if (!key) return { source: "나라장터", connected: false, message: "공공데이터포털 서비스키가 필요합니다.", items: [] };
  const now = new Date();
  const start = new Date(now.getTime() - Math.max(1, filter.days || 7) * 86400000);
  const stamp = (date: Date, end = false) => `${date.toISOString().slice(0, 10).replaceAll("-", "")}${end ? "2359" : "0000"}`;
  const url = new URL("https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServc");
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("inqryDiv", "1");
  url.searchParams.set("inqryBgnDt", stamp(start));
  url.searchParams.set("inqryEndDt", stamp(now, true));
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("type", "json");
  const response = await fetch(url, { headers: { "user-agent": "ProcurePilotAI/1.0" } });
  if (!response.ok) throw new Error(`나라장터 API 응답 오류 (${response.status})`);
  const json = await response.json() as Record<string, any>;
  const raw = json?.response?.body?.items;
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.item) ? raw.item : raw?.item ? [raw.item] : [];
  const items = rows.map((row: Record<string, unknown>): OpportunityInput => {
    const title = clean(row.bidNtceNm);
    const noticeId = `${clean(row.bidNtceNo)}-${clean(row.bidNtceOrd)}`;
    return {
      sourceName: "나라장터",
      sourceNoticeId: noticeId,
      title,
      agencyName: clean(row.ntceInsttNm || row.dminsttNm),
      regionSido: clean(row.prtcptPsblRgnNm) || "전국",
      regionSigungu: "",
      category: inferCategory(title),
      noticeType: "입찰공고",
      publishedAt: dateOnly(row.bidNtceDt),
      deadlineAt: dateOnly(row.bidClseDt),
      budget: Number(row.asignBdgtAmt || row.presmptPrce || 0),
      summaryRaw: clean(row.bidNtceNm),
      detailText: clean(row.bidNtceDtl),
      originalUrl: clean(row.bidNtceDtlUrl) || `https://www.g2b.go.kr/`,
    };
  }).filter((item: OpportunityInput) => item.title && item.sourceNoticeId && matchesFilter(item, filter));
  return { source: "나라장터", connected: true, message: `${items.length}건을 확인했습니다.`, items };
}

export async function collectBizinfo(filter: CollectFilter): Promise<ConnectorResult> {
  const key = getEnv().BIZINFO_API_KEY;
  if (!key) return { source: "기업마당", connected: false, message: "기업마당 인증키가 필요합니다.", items: [] };
  const url = new URL("https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do");
  url.searchParams.set("crtfcKey", key);
  url.searchParams.set("dataType", "json");
  url.searchParams.set("searchCnt", "100");
  if (filter.keyword) url.searchParams.set("hashtags", filter.keyword);
  const response = await fetch(url, { headers: { "user-agent": "ProcurePilotAI/1.0" } });
  if (!response.ok) throw new Error(`기업마당 API 응답 오류 (${response.status})`);
  const json = await response.json() as Record<string, any>;
  const rows = json?.jsonArray || json?.items || json?.item || json?.response?.body?.items || [];
  const list = Array.isArray(rows) ? rows : [rows];
  const items = list.map((row: Record<string, unknown>, index: number): OpportunityInput => {
    const title = clean(row.pblancNm || row.title);
    const urlValue = clean(row.pblancUrl || row.link);
    return {
      sourceName: "기업마당",
      sourceNoticeId: clean(row.pblancId || row.id || urlValue) || `bizinfo-${index}`,
      title,
      agencyName: clean(row.jrsdInsttNm || row.sprvInsttNm || row.organization) || "기업마당",
      regionSido: clean(row.areaNm || row.region) || "전국",
      regionSigungu: "",
      category: inferCategory(`${title} ${clean(row.hashTags)}`),
      noticeType: "지원사업",
      publishedAt: dateOnly(row.creatPnttm || row.pubDate || row.registDt),
      deadlineAt: dateOnly(row.reqstEndDe || row.endDate),
      budget: Number(String(row.budget || 0).replace(/\D/g, "")) || 0,
      summaryRaw: clean(row.bsnsSumryCn || row.description),
      detailText: clean(row.bsnsSumryCn || row.description),
      originalUrl: urlValue || "https://www.bizinfo.go.kr/",
    };
  }).filter((item: OpportunityInput) => item.title && matchesFilter(item, filter));
  return { source: "기업마당", connected: true, message: `${items.length}건을 확인했습니다.`, items };
}

export function duplicateKey(item: OpportunityInput) {
  const normalized = `${item.sourceNoticeId}|${item.agencyName}|${item.title}|${item.publishedAt}`
    .toLowerCase().replace(/[^a-z0-9가-힣|]/g, "");
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) hash = Math.imul(hash ^ normalized.charCodeAt(i), 16777619);
  return `${item.sourceName}-${(hash >>> 0).toString(16)}`;
}
