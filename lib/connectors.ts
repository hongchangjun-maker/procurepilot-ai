import { getPublicDataKey } from "./secrets";

export type OpportunityInput = {
  sourceName: string;
  sourceNoticeId: string;
  title: string;
  agencyName: string;
  agencyType: string;
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
  agencyType?: string;
  noticeType?: string;
  keyword?: string;
  days?: number;
  minBudget?: number;
  maxBudget?: number;
};

export type ConnectorResult = {
  source: string;
  connected: boolean;
  message: string;
  items: OpportunityInput[];
};

export type ScrapeConfig = {
  url: string;
  rowSelector: string;
  titleSelector: string;
  linkSelector?: string;
  linkAttribute?: string;
  publishedSelector?: string;
  deadlineSelector?: string;
  agencySelector?: string;
  idAttribute?: string;
  idPattern?: string;
  noticeType?: string;
  category?: string;
  maxItems?: number;
};

export type AgencySource = {
  id: number;
  name: string;
  type: string;
  region_sido: string;
  homepage_url: string;
  source_type: string;
  source_config: string;
  is_active: number | boolean;
};

type JsonRecord = Record<string, unknown>;

function clean(value: unknown) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function dateOnly(value: unknown) {
  const raw = clean(value);
  const match = raw.match(/(20\d{2})[-./]?\s*(\d{1,2})[-./]?\s*(\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : "";
}

function lastDateOnly(value: unknown) {
  const matches = [...clean(value).matchAll(/(20\d{2})[-./]?\s*(\d{1,2})[-./]?\s*(\d{1,2})/g)];
  const match = matches.at(-1);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : "";
}

function inferCategory(text: string) {
  const value = text.toLowerCase();
  if (/(인공지능|\bai\b|머신러닝|생성형)/i.test(value)) return "AI";
  if (/(vr|ar|xr|가상현실|증강현실)/i.test(value)) return "VR / AR / XR";
  if (/(소프트웨어|시스템|정보화|전산)/.test(value)) return "소프트웨어";
  if (/(교육|연수|학교)/.test(value)) return "교육";
  if (/(콘텐츠|영상|홍보)/.test(value)) return "콘텐츠";
  if (/(데이터|빅데이터)/.test(value)) return "데이터";
  if (/(플랫폼|홈페이지|웹사이트)/.test(value)) return "플랫폼 구축";
  return "기타";
}

function inferAgencyType(name: string) {
  if (name.includes("교육지원청")) return "교육지원청";
  if (name.includes("도교육청") || name.includes("도 교육청")) return "도 교육청";
  if (name.includes("시교육청") || name.includes("시 교육청")) return "시 교육청";
  if (name.includes("보건소")) return "보건소";
  if (name.includes("도청")) return "도청";
  if (name.includes("시청")) return "시청";
  if (name.includes("군청")) return "군청";
  if (name.includes("구청")) return "구청";
  return "기타 공공기관";
}

function matchesFilter(item: OpportunityInput, filter: CollectFilter) {
  const haystack = `${item.title} ${item.agencyName} ${item.regionSido} ${item.category}`.toLowerCase();
  if (filter.keyword && !haystack.includes(filter.keyword.toLowerCase())) return false;
  if (filter.region && filter.region !== "전국" && !haystack.includes(filter.region.toLowerCase())) return false;
  if (filter.category && filter.category !== "전체" && item.category !== filter.category) return false;
  if (filter.agencyType && filter.agencyType !== "전체" && item.agencyType !== filter.agencyType) return false;
  if (filter.noticeType && filter.noticeType !== "전체" && item.noticeType !== filter.noticeType) return false;
  if (filter.minBudget && item.budget > 0 && item.budget < filter.minBudget) return false;
  if (filter.maxBudget && item.budget > filter.maxBudget) return false;
  return true;
}

function rowsFromApi(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.filter((row): row is JsonRecord => Boolean(row && typeof row === "object"));
  if (value && typeof value === "object") return [value as JsonRecord];
  return [];
}

async function fetchJson(url: URL, source: string) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "ProcurePilotAI/2.0 (+public-data-collector)" },
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`${source} API 응답 오류 (${response.status})`);
  const bytes = await readBounded(response, 5_000_000, `${source} API`);
  return JSON.parse(new TextDecoder().decode(bytes)) as JsonRecord;
}

async function readBounded(response: Response, limit: number, source: string) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > limit) throw new Error(`${source} 응답이 허용 크기를 초과했습니다.`);
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel("response too large");
      throw new Error(`${source} 응답이 허용 크기를 초과했습니다.`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function collectG2B(filter: CollectFilter): Promise<ConnectorResult> {
  const key = await getPublicDataKey("data_go_kr_service_key");
  if (!key) return { source: "나라장터", connected: false, message: "공공데이터포털 서비스키가 필요합니다.", items: [] };
  const now = new Date();
  const start = new Date(now.getTime() - Math.max(1, Math.min(30, filter.days || 7)) * 86400000);
  const stamp = (date: Date, end = false) => `${date.toISOString().slice(0, 10).replaceAll("-", "")}${end ? "2359" : "0000"}`;
  const url = new URL("https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServc");
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("inqryDiv", "1");
  url.searchParams.set("inqryBgnDt", stamp(start));
  url.searchParams.set("inqryEndDt", stamp(now, true));
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("type", "json");
  const json = await fetchJson(url, "나라장터");
  const body = json.response as JsonRecord | undefined;
  const payload = body?.body as JsonRecord | undefined;
  const wrapped = payload?.items as JsonRecord | undefined;
  const rows = rowsFromApi(Array.isArray(payload?.items) ? payload.items : wrapped?.item ?? payload?.items);
  const items = rows.map((row): OpportunityInput => {
    const title = clean(row.bidNtceNm);
    const agencyName = clean(row.ntceInsttNm || row.dminsttNm);
    return {
      sourceName: "나라장터",
      sourceNoticeId: `${clean(row.bidNtceNo)}-${clean(row.bidNtceOrd)}`,
      title,
      agencyName,
      agencyType: inferAgencyType(agencyName),
      regionSido: clean(row.prtcptPsblRgnNm) || "전국",
      regionSigungu: "",
      category: inferCategory(title),
      noticeType: "입찰공고",
      publishedAt: dateOnly(row.bidNtceDt),
      deadlineAt: dateOnly(row.bidClseDt),
      budget: Number(row.asignBdgtAmt || row.presmptPrce || 0),
      summaryRaw: title,
      detailText: clean(row.bidNtceDtl),
      originalUrl: clean(row.bidNtceDtlUrl) || "https://www.g2b.go.kr/",
    };
  }).filter((item) => item.title && item.sourceNoticeId !== "-" && matchesFilter(item, filter));
  return { source: "나라장터", connected: true, message: `${items.length}건을 확인했습니다.`, items };
}

export async function collectBizinfo(filter: CollectFilter): Promise<ConnectorResult> {
  const key = await getPublicDataKey("bizinfo_api_key");
  if (!key) return { source: "기업마당", connected: false, message: "기업마당 인증키가 필요합니다.", items: [] };
  const url = new URL("https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do");
  url.searchParams.set("crtfcKey", key);
  url.searchParams.set("dataType", "json");
  url.searchParams.set("searchCnt", "100");
  if (filter.keyword) url.searchParams.set("hashtags", filter.keyword);
  const json = await fetchJson(url, "기업마당");
  const rows = rowsFromApi(json.jsonArray || json.items || json.item || (json.response as JsonRecord | undefined)?.body);
  const items = rows.map((row, index): OpportunityInput => {
    const title = clean(row.pblancNm || row.title);
    const urlValue = clean(row.pblancUrl || row.link);
    const agencyName = clean(row.jrsdInsttNm || row.sprvInsttNm || row.organization) || "기업마당";
    return {
      sourceName: "기업마당",
      sourceNoticeId: clean(row.pblancId || row.id || urlValue) || `bizinfo-${index}`,
      title,
      agencyName,
      agencyType: inferAgencyType(agencyName),
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
  }).filter((item) => item.title && matchesFilter(item, filter));
  return { source: "기업마당", connected: true, message: `${items.length}건을 확인했습니다.`, items };
}

function validateOfficialUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("올바른 HTTPS 게시판 주소를 입력해 주세요.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("수집 주소는 인증정보와 별도 포트가 없는 HTTPS 주소만 허용합니다.");
  }
  const host = url.hostname.toLowerCase();
  const allowed = ["go.kr", "or.kr", "ac.kr"].some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  if (!allowed || host === "localhost" || /^\d+(?:\.\d+){3}$/.test(host)) {
    throw new Error("공공기관 도메인(.go.kr, .or.kr, .ac.kr)만 수집할 수 있습니다.");
  }
  return url;
}

export function validateScrapeConfig(value: unknown): ScrapeConfig {
  if (!value || typeof value !== "object") throw new Error("HTML 수집 설정이 필요합니다.");
  const raw = value as Record<string, unknown>;
  const config: ScrapeConfig = {
    url: validateOfficialUrl(String(raw.url || "")).toString(),
    rowSelector: clean(raw.rowSelector),
    titleSelector: clean(raw.titleSelector),
    linkSelector: clean(raw.linkSelector),
    linkAttribute: clean(raw.linkAttribute) || "href",
    publishedSelector: clean(raw.publishedSelector),
    deadlineSelector: clean(raw.deadlineSelector),
    agencySelector: clean(raw.agencySelector),
    idAttribute: clean(raw.idAttribute),
    idPattern: clean(raw.idPattern),
    noticeType: clean(raw.noticeType) || "공모",
    category: clean(raw.category),
    maxItems: Math.max(1, Math.min(50, Number(raw.maxItems) || 30)),
  };
  for (const [label, selector] of [["행", config.rowSelector], ["제목", config.titleSelector]] as const) {
    if (!selector || selector.length > 160 || /[{}\0]/.test(selector)) throw new Error(`${label} CSS 선택자를 확인해 주세요.`);
  }
  return config;
}

type ScrapedRow = { title: string; link: string; published: string; deadline: string; agency: string; id: string };

function appendText(rows: ScrapedRow[], field: keyof Omit<ScrapedRow, "link" | "id">, text: Text) {
  const row = rows.at(-1);
  if (row) row[field] += text.text;
}

function sourceNoticeId(row: ScrapedRow, config: ScrapeConfig) {
  if (row.id && config.idPattern) {
    try {
      const match = row.id.match(new RegExp(config.idPattern));
      if (match?.[1]) return match[1];
    } catch {
      throw new Error("공고 ID 정규식이 올바르지 않습니다.");
    }
  }
  if (row.id) return row.id;
  if (row.link) return row.link;
  return `${clean(row.title)}-${dateOnly(row.published)}`;
}

export async function collectHtmlAgency(source: AgencySource, filter: CollectFilter): Promise<ConnectorResult> {
  const config = validateScrapeConfig(JSON.parse(source.source_config || "{}"));
  const response = await fetch(config.url, {
    headers: { accept: "text/html,application/xhtml+xml", "user-agent": "ProcurePilotAI/2.0 (+public-data-collector)" },
    redirect: "manual",
    signal: AbortSignal.timeout(12_000),
  });
  if (response.status >= 300 && response.status < 400) throw new Error(`${source.name} 게시판이 다른 주소로 이동했습니다. 새 HTTPS 주소를 등록해 주세요.`);
  if (!response.ok) throw new Error(`${source.name} 게시판 응답 오류 (${response.status})`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) throw new Error(`${source.name} 주소가 HTML 게시판이 아닙니다.`);
  const htmlBytes = await readBounded(response, 1_500_000, `${source.name} 게시판`);
  const boundedResponse = new Response(htmlBytes, { headers: { "content-type": contentType } });

  const rows: ScrapedRow[] = [];
  const rowSelector = config.rowSelector;
  let rewriter = new HTMLRewriter().on(rowSelector, {
    element(element) {
      rows.push({ title: "", link: "", published: "", deadline: "", agency: "", id: config.idAttribute ? element.getAttribute(config.idAttribute) || "" : "" });
    },
  }).on(`${rowSelector} ${config.titleSelector}`, { text(text) { appendText(rows, "title", text); } });
  if (config.linkSelector) {
    rewriter = rewriter.on(`${rowSelector} ${config.linkSelector}`, {
      element(element) {
        const row = rows.at(-1);
        if (row && !row.link) row.link = element.getAttribute(config.linkAttribute || "href") || "";
      },
    });
  }
  if (config.publishedSelector) rewriter = rewriter.on(`${rowSelector} ${config.publishedSelector}`, { text(text) { appendText(rows, "published", text); } });
  if (config.deadlineSelector) rewriter = rewriter.on(`${rowSelector} ${config.deadlineSelector}`, { text(text) { appendText(rows, "deadline", text); } });
  if (config.agencySelector) rewriter = rewriter.on(`${rowSelector} ${config.agencySelector}`, { text(text) { appendText(rows, "agency", text); } });
  const transformed = rewriter.transform(boundedResponse);
  await transformed.arrayBuffer();

  const base = new URL(config.url);
  const parsedItems = rows.slice(0, config.maxItems).map((row): OpportunityInput => {
    const title = clean(row.title);
    const agencyName = clean(row.agency) || source.name;
    let originalUrl = config.url;
    if (row.link && !row.link.startsWith("javascript:") && row.link !== "#view") {
      originalUrl = new URL(row.link.replaceAll("&amp;", "&"), base).toString();
    } else if (row.id) {
      const match = row.id.match(/doBbsFView\('310','(\d+)'[^)]*'(\d+)'\)/);
      if (match) originalUrl = new URL(`/site/smba/ex/bbs/View.do?bcIdx=${match[1]}&cbIdx=310&parentSeq=${match[2]}`, base).toString();
    }
    const deadlineAt = lastDateOnly(row.deadline);
    const publishedAt = dateOnly(row.published);
    return {
      sourceName: source.name,
      sourceNoticeId: sourceNoticeId(row, config),
      title,
      agencyName,
      agencyType: source.type || inferAgencyType(agencyName),
      regionSido: source.region_sido || "전국",
      regionSigungu: "",
      category: config.category || inferCategory(title),
      noticeType: config.noticeType || "공모",
      publishedAt,
      deadlineAt,
      budget: 0,
      summaryRaw: `${agencyName} 공식 게시판에서 수집한 공고입니다.`,
      detailText: deadlineAt ? `신청기간 종료일 ${deadlineAt}` : "세부 내용은 공식 원문에서 확인하세요.",
      originalUrl,
    };
  }).filter((item) => item.title && item.sourceNoticeId);
  if (!parsedItems.length) throw new Error(`${source.name} 게시판에서 공고를 찾지 못했습니다. 행·제목 선택자를 확인해 주세요.`);
  const items = parsedItems.filter((item) => matchesFilter(item, filter));
  return { source: source.name, connected: true, message: `${items.length}건을 확인했습니다.`, items };
}

export function duplicateKey(item: OpportunityInput) {
  const normalized = `${item.sourceNoticeId}|${item.agencyName}|${item.title}|${item.publishedAt}`
    .toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) hash = Math.imul(hash ^ normalized.charCodeAt(i), 16777619);
  return `${item.sourceName}-${(hash >>> 0).toString(16)}`;
}
