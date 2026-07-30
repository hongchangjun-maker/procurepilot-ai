"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useState } from "react";

type Row = Record<string, any>;
type Dashboard = {
  opportunities: Row[];
  logs: Row[];
  profile?: Row;
  stats: Row;
  connections: { g2b: boolean; bizinfo: boolean; openai: boolean };
};

const categories = ["전체", "AI", "디지털", "소프트웨어", "교육", "콘텐츠", "VR / AR / XR", "메타버스", "상담 / 심리", "플랫폼 구축", "데이터", "기타"];
const regions = ["전국", "서울", "경기", "인천", "강원", "충북", "충남", "세종", "대전", "전북", "전남", "광주", "경북", "경남", "대구", "부산", "울산", "제주"];
const agencyTypes = ["전체", "시청", "군청", "구청", "도청", "보건소", "도 교육청", "시 교육청", "교육지원청", "기타 공공기관"];

function money(value: number) {
  if (!value) return "금액 미공개";
  if (value >= 100000000) return `${(value / 100000000).toFixed(value % 100000000 ? 1 : 0)}억원`;
  if (value >= 10000) return `${Math.round(value / 10000).toLocaleString()}만원`;
  return `${value.toLocaleString()}원`;
}

function shortDate(value?: string) {
  return value ? value.slice(0, 10).replaceAll("-", ".") : "미정";
}

function statusOf(row: Row) {
  if (!row.deadline_at) return row.status || "진행중";
  const days = Math.ceil((new Date(row.deadline_at).getTime() - Date.now()) / 86400000);
  if (days < 0) return "마감";
  if (days <= 7) return "마감임박";
  return row.status === "신규" ? "신규" : "진행중";
}

export default function ProcureDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("전국");
  const [category, setCategory] = useState("전체");
  const [agencyType, setAgencyType] = useState("전체");
  const [days, setDays] = useState(7);
  const [sort, setSort] = useState("deadline");
  const [collecting, setCollecting] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard");
      const json = await response.json() as Dashboard & Row;
      if (!response.ok) throw new Error(json.error);
      setData(json);
      setSelected((current) => current ? json.opportunities.find((row: Row) => row.id === current.id) || null : json.opportunities[0] || null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Initial network synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const rows = useMemo(() => {
    const filtered = (data?.opportunities || []).filter((row) => {
      const haystack = `${row.title} ${row.agency_name} ${row.category} ${row.region_sido}`.toLowerCase();
      return (!search || haystack.includes(search.toLowerCase()))
        && (region === "전국" || haystack.includes(region))
        && (category === "전체" || row.category === category)
        && (agencyType === "전체" || (row.agency_name || "").includes(agencyType.replace("기타 ", "")));
    });
    return [...filtered].sort((a, b) => {
      if (sort === "budget") return Number(b.budget) - Number(a.budget);
      if (sort === "score") return Number(b.relevance_score || -1) - Number(a.relevance_score || -1);
      if (sort === "latest") return String(b.published_at).localeCompare(String(a.published_at));
      return (a.deadline_at || "9999").localeCompare(b.deadline_at || "9999");
    });
  }, [data, search, region, category, agencyType, sort]);

  async function collect() {
    setCollecting(true);
    setMessage("");
    try {
      const response = await fetch("/api/collect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ region, category, keyword: search, days }),
      });
      const json = await response.json() as Row;
      if (!response.ok) throw new Error(`${json.error}${json.sources ? ` · ${json.sources.map((s: Row) => `${s.source}: ${s.message}`).join(" / ")}` : ""}`);
      setMessage(`수집 완료 · 신규 ${json.newCount}건 · 갱신 ${json.updatedCount}건`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "수집에 실패했습니다.");
    } finally {
      setCollecting(false);
    }
  }

  function choose(row: Row) {
    setSelected(row);
    if (window.innerWidth < 1100) setDetailOpen(true);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">P</span>
          <div><strong>필로소피 AI</strong><small>입찰 공고 스크래퍼</small></div>
        </div>
        <div className="top-actions">
          <label className="global-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="공고·기관·키워드 검색" /></label>
          <button className="ghost-button" onClick={() => setAdminOpen(true)}>⚙ 마스터 관리자</button>
        </div>
      </header>

      <section className="hero">
        <img src="/hero-banner.png" alt="" />
        <div className="hero-shade" />
        <div className="hero-copy">
          <p className="eyebrow">PUBLIC OPPORTUNITY INTELLIGENCE</p>
          <h1>흩어진 공공 기회를<br /><em>사업 가능성</em>으로 바꾸세요.</h1>
          <p>공식 공고 수집부터 AI 요약, 우리 회사 적합도 분석까지 한 화면에서.</p>
          <div className="hero-points"><span>✓ 공공기관 입찰·공모 수집</span><span>✓ AI 요약 및 적합도 분석</span><span>✓ 지역·기관·분야 스마트 검색</span></div>
        </div>
        <div className="connection-strip">
          <Connection on={data?.connections.g2b} label="나라장터" />
          <Connection on={data?.connections.bizinfo} label="기업마당" />
          <Connection on={data?.connections.openai} label="OpenAI" />
        </div>
      </section>

      <section className="metrics">
        <Metric label="전체 공고" value={data?.stats?.total || 0} note="D1 저장 건수" icon="▦" />
        <Metric label="오늘 신규" value={data?.stats?.today || 0} note="오늘 수집" icon="↗" accent />
        <Metric label="마감 임박" value={data?.stats?.urgent || 0} note="7일 이내" icon="◷" warning />
        <Metric label="AI 고적합" value={(data?.opportunities || []).filter((row) => row.relevance_score >= 75).length} note="75점 이상" icon="✦" />
      </section>

      {message && <div className="notice" role="status">{message}<button onClick={() => setMessage("")}>×</button></div>}

      <section className="workspace">
        <aside className="filters panel">
          <div className="panel-heading"><div><span className="kicker">COLLECT</span><h2>수집 조건</h2></div><button className="icon-button" onClick={() => { setRegion("전국"); setCategory("전체"); setAgencyType("전체"); }}>↻</button></div>
          <Field label="지역"><select value={region} onChange={(e) => setRegion(e.target.value)}>{regions.map((v) => <option key={v}>{v}</option>)}</select></Field>
          <Field label="기관 유형"><select value={agencyType} onChange={(e) => setAgencyType(e.target.value)}>{agencyTypes.map((v) => <option key={v}>{v}</option>)}</select></Field>
          <Field label="분야"><select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((v) => <option key={v}>{v}</option>)}</select></Field>
          <Field label="정보 유형"><select><option>전체</option><option>입찰공고</option><option>사전규격</option><option>발주계획</option><option>공모</option><option>지원사업</option></select></Field>
          <Field label="조회 기간"><div className="segmented">{[1, 7, 30].map((v) => <button key={v} className={days === v ? "active" : ""} onClick={() => setDays(v)}>{v === 1 ? "오늘" : `${v}일`}</button>)}</div></Field>
          <Field label="예산 범위"><div className="budget-row"><input placeholder="최소" inputMode="numeric" /><span>—</span><input placeholder="최대" inputMode="numeric" /></div></Field>
          <button className="primary-button collect-button" onClick={collect} disabled={collecting}>{collecting ? "공식 소스 확인 중…" : "⌁  수집 시작"}</button>
          <p className="helper">공식 API 인증키가 연결된 소스만 수집합니다. 연결되지 않은 소스는 결과를 만들지 않습니다.</p>
        </aside>

        <section className="list-panel panel">
          <div className="list-toolbar">
            <div><span className="kicker">OPPORTUNITIES</span><h2>기회 탐색 <b>{rows.length}</b></h2></div>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="정렬">
              <option value="deadline">마감 임박순</option><option value="latest">등록일 최신순</option><option value="budget">예산 높은순</option><option value="score">적합도 높은순</option>
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>공고·기관</th><th>분야</th><th>예산</th><th>마감</th><th>AI 적합도</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={selected?.id === row.id ? "selected" : ""} onClick={() => choose(row)}>
                    <td><div className="title-cell"><button className={`star ${row.is_favorite ? "on" : ""}`} aria-label="즐겨찾기">★</button><div><strong>{row.title}</strong><span>{row.agency_name} · {row.region_sido}</span></div></div></td>
                    <td><span className="tag">{row.category}</span><small>{row.notice_type}</small></td>
                    <td>{money(row.budget)}</td>
                    <td><strong>{shortDate(row.deadline_at)}</strong><span className={`status ${statusOf(row)}`}>{statusOf(row)}</span></td>
                    <td>{row.relevance_score != null ? <div className="score"><b>{Math.round(row.relevance_score)}</b><span><i style={{ width: `${row.relevance_score}%` }} /></span></div> : <span className="muted">미분석</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && rows.length === 0 && <Empty onCollect={collect} connected={Boolean(data?.connections.g2b || data?.connections.bizinfo)} />}
            {loading && <div className="loading-state">저장된 공고를 불러오는 중입니다…</div>}
          </div>
        </section>

        <aside className={`detail panel ${detailOpen ? "mobile-open" : ""}`}>
          <button className="mobile-close" onClick={() => setDetailOpen(false)}>×</button>
          {selected ? <Detail key={selected.id} row={selected} connections={data!.connections} refresh={load} /> : <div className="detail-empty"><span>⌁</span><h3>공고를 선택하세요</h3><p>요약, 첨부파일, AI 적합도와 메모가 여기에 표시됩니다.</p></div>}
        </aside>
      </section>

      <section className="bottom-grid">
        <div className="panel logs"><div className="panel-heading"><div><span className="kicker">ACTIVITY</span><h2>최근 수집 로그</h2></div></div>
          {(data?.logs || []).length ? data!.logs.map((log) => <div className="log-row" key={log.id}><span className={`log-dot ${log.status === "완료" ? "ok" : ""}`} /><div><strong>{log.source_name}</strong><small>{log.status} · 신규 {log.new_count}건 · 갱신 {log.updated_count}건</small></div><time>{shortDate(log.started_at)}</time></div>)
            : <p className="empty-line">아직 수집 기록이 없습니다.</p>}
        </div>
        <div className="panel guide-card"><span>시작 가이드</span><h3>공식 API 키를 연결하면<br />첫 수집을 시작할 수 있어요.</h3><ol><li><b>1</b> 배포 환경에 인증키 등록</li><li><b>2</b> 관리자에서 사업 프로필 저장</li><li><b>3</b> 수집 후 AI 적합도 분석</li></ol><button onClick={() => setAdminOpen(true)}>관리자 설정 열기 →</button></div>
      </section>

      {adminOpen && <AdminModal close={() => setAdminOpen(false)} connections={data?.connections} onSaved={load} />}
    </main>
  );
}

function Connection({ on, label }: { on?: boolean; label: string }) {
  return <span className={on ? "connected" : ""}><i />{label} {on ? "연결됨" : "미연결"}</span>;
}

function Metric({ label, value, note, icon, accent, warning }: { label: string; value: number; note: string; icon: string; accent?: boolean; warning?: boolean }) {
  return <div className={`metric ${accent ? "accent" : ""} ${warning ? "warning" : ""}`}><span className="metric-icon">{icon}</span><div><small>{label}</small><strong>{Number(value).toLocaleString()}</strong><em>{note}</em></div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function Empty({ onCollect, connected }: { onCollect: () => void; connected: boolean }) {
  return <div className="empty-state"><span className="empty-icon">⌕</span><h3>조건에 맞는 실제 공고가 없습니다</h3><p>{connected ? "필터를 바꾸거나 공식 소스에서 새 공고를 수집해 보세요." : "관리자 설정 안내에 따라 공식 데이터 소스 인증키를 먼저 연결해 주세요."}</p><button className="primary-button" onClick={onCollect} disabled={!connected}>{connected ? "지금 수집하기" : "데이터 소스 연결 필요"}</button></div>;
}

function Detail({ row, connections, refresh }: { row: Row; connections: Dashboard["connections"]; refresh: () => Promise<void> }) {
  const [tab, setTab] = useState("summary");
  const [note, setNote] = useState(row.note || "");
  const [tags, setTags] = useState(row.tags || "");
  const [favorite, setFavorite] = useState(Boolean(row.is_favorite));
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState("");
  const summary = row.summary_json ? JSON.parse(row.summary_json) : null;

  async function saveNote() {
    setWorking(true);
    const response = await fetch(`/api/opportunities/${row.id}/note`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ note, tags, isFavorite: favorite }) });
    setFeedback(response.ok ? "메모가 저장되었습니다." : "메모를 저장하지 못했습니다.");
    setWorking(false);
    if (response.ok) await refresh();
  }

  async function analyze() {
    setWorking(true); setFeedback("");
    const response = await fetch("/api/ai/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ opportunityId: row.id }) });
    const json = await response.json() as Row;
    setFeedback(response.ok ? "AI 분석이 저장되었습니다." : json.error);
    setWorking(false);
    if (response.ok) await refresh();
  }

  return <div className="detail-content">
    <div className="detail-top"><span className="source">{row.source_name}</span><button className={`favorite ${favorite ? "on" : ""}`} onClick={() => setFavorite(!favorite)}>★</button></div>
    <h2>{row.title}</h2><p className="detail-agency">{row.agency_name} · {row.region_sido}</p>
    <div className="detail-meta"><div><small>예산</small><strong>{money(row.budget)}</strong></div><div><small>마감일</small><strong>{shortDate(row.deadline_at)}</strong></div></div>
    <div className="tabs"><button className={tab === "summary" ? "active" : ""} onClick={() => setTab("summary")}>AI 요약</button><button className={tab === "files" ? "active" : ""} onClick={() => setTab("files")}>첨부·원문</button><button className={tab === "memo" ? "active" : ""} onClick={() => setTab("memo")}>메모</button></div>
    {tab === "summary" && <div className="analysis">
      {summary ? <>
        <div className="fit-card"><div><span>사업 적합도</span><strong>{Math.round(summary.relevance_score)}<small>/100</small></strong></div><b>{summary.relevance_grade}</b></div>
        <p>{summary.relevance_reason}</p>
        <Info title="사업 목적" text={summary.purpose} />
        <Bullet title="주요 과업" items={summary.main_tasks} />
        <Bullet title="핵심 포인트" items={summary.key_points} />
        <div className="split-info"><Bullet title="우리의 강점" items={summary.strengths} positive /><Bullet title="보완할 점" items={summary.weaknesses} /></div>
        <Info title="추천 대응 전략" text={summary.strategy} />
        <p className="ai-note">AI 결과는 검토 참고자료입니다. 참가자격·제출서류는 원문을 확인하세요. · {row.model_name}</p>
      </> : <div className="ai-empty"><span>✦</span><h3>아직 AI 분석이 없습니다</h3><p>{connections.openai ? "저장된 사업 프로필과 이 공고를 비교해 요약·적합도를 생성합니다." : "OpenAI가 연결되지 않았습니다. 연결 전에는 분석 결과를 생성하지 않습니다."}</p><button className="primary-button" onClick={analyze} disabled={working || !connections.openai}>{working ? "분석 중…" : "AI 요약·적합도 분석"}</button></div>}
    </div>}
    {tab === "files" && <div className="files"><p>첨부파일은 공식 원문에서 안전하게 확인할 수 있습니다. R2 저장·문서 추출 커넥터는 확장 구조로 준비되어 있습니다.</p><a href={row.original_url} target="_blank" rel="noreferrer">공식 원문 열기 ↗</a><Info title="원문 개요" text={row.detail_text || row.summary_raw || "원문 요약 정보가 제공되지 않았습니다."} /></div>}
    {tab === "memo" && <div className="memo"><label>개인 메모<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="검토 포인트, 담당자, 다음 행동을 기록하세요." /></label><label>태그<input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="예: 우선검토, 컨소시엄" /></label><label className="check"><input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} /> 즐겨찾기에 추가</label><button className="primary-button" onClick={saveNote} disabled={working}>저장</button></div>}
    {feedback && <p className="inline-feedback">{feedback}</p>}
  </div>;
}

function Info({ title, text }: { title: string; text?: string }) {
  return <section className="info-block"><h4>{title}</h4><p>{text || "확인 가능한 정보가 없습니다."}</p></section>;
}

function Bullet({ title, items, positive }: { title: string; items?: string[]; positive?: boolean }) {
  return <section className={`info-block ${positive ? "positive" : ""}`}><h4>{title}</h4>{items?.length ? <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p>확인 가능한 정보가 없습니다.</p>}</section>;
}

function AdminModal({ close, connections, onSaved }: { close: () => void; connections?: Dashboard["connections"]; onSaved: () => Promise<void> }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState("profile");
  const [admin, setAdmin] = useState<Row | null>(null);
  const [feedback, setFeedback] = useState("");
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [models, setModels] = useState({ summary: "gpt-5.6-luna", relevance: "gpt-5.6-terra", attachment: "gpt-5.6-terra", classification: "gpt-5.6-luna" });
  const [agency, setAgency] = useState({ name: "", agencyType: "시청", region: "전국", homepageUrl: "", sourceType: "api" });

  async function login(e: FormEvent) {
    e.preventDefault();
    const response = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    const json = await response.json() as Row;
    if (!response.ok) return setFeedback(json.error);
    setAuthenticated(true);
    const settings = await fetch("/api/admin/settings");
    const payload = await settings.json() as Row;
    setAdmin(payload);
    if (payload.profile) setProfile({ companyName: payload.profile.company_name || "", intro: payload.profile.intro || "", technologies: payload.profile.technologies || "", services: payload.profile.services || "", achievements: payload.profile.achievements || "", strengths: payload.profile.strengths || "", targetMarkets: payload.profile.target_markets || "", preferredCategories: payload.profile.preferred_categories || "", excludedCategories: payload.profile.excluded_categories || "", budgetRange: payload.profile.budget_range || "", serviceRegions: payload.profile.service_regions || "" });
  }

  async function save(payload: Row) {
    const response = await fetch("/api/admin/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const json = await response.json() as Row;
    setFeedback(response.ok ? "설정이 안전하게 저장되었습니다." : json.error);
    if (response.ok) await onSaved();
  }

  async function testAI() {
    const response = await fetch("/api/ai/health", { method: "POST" });
    const json = await response.json() as Row;
    setFeedback(json.message || json.error);
  }

  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.currentTarget === e.target) close(); }}>
    <div className="admin-modal">
      <button className="modal-close" onClick={close}>×</button>
      {!authenticated ? <form className="login-card" onSubmit={login}><span className="admin-lock">⌾</span><p className="kicker">MASTER ADMIN</p><h2>관리자 인증</h2><p>기관·연결·AI 모델·사업 프로필을 관리합니다.</p><label>관리자 비밀번호<input autoFocus type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호 입력" /></label><button className="primary-button">관리자 모드 진입</button>{feedback && <p className="form-error">{feedback}</p>}<small>초기 비밀번호 6085 · 운영 전 환경변수로 반드시 변경하세요.</small></form>
      : <div className="admin-layout">
        <aside><div className="admin-brand"><span className="brand-mark">P</span><div><b>관리 센터</b><small>운영 설정</small></div></div>{[["profile", "사업 프로필"], ["sources", "기관 관리"], ["ai", "AI · 모델"], ["system", "DB · 시스템"]].map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</aside>
        <section className="admin-body">
          <div className="admin-head"><div><span className="kicker">ADMIN CONSOLE</span><h2>{tab === "profile" ? "내 사업 프로필" : tab === "sources" ? "수집 기관 관리" : tab === "ai" ? "AI 연결 및 모델" : "시스템 상태"}</h2></div><span className="admin-status"><i /> 관리자 모드</span></div>
          {tab === "profile" && <div className="admin-form"><p>AI 적합도 분석의 기준이 되는 실제 회사 정보를 입력하세요.</p><div className="form-grid">{Object.entries({ companyName: "회사명", intro: "사업 소개", technologies: "보유 기술", services: "주요 서비스", achievements: "주요 실적", strengths: "강점", targetMarkets: "목표 시장", preferredCategories: "우선 분야", excludedCategories: "제외 분야", budgetRange: "대응 예산", serviceRegions: "활동 지역" }).map(([key, label]) => <label key={key} className={key === "intro" || key === "achievements" ? "wide" : ""}>{label}{key === "intro" || key === "achievements" ? <textarea value={profile[key] || ""} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} /> : <input value={profile[key] || ""} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} />}</label>)}</div><button className="primary-button" onClick={() => save({ type: "profile", ...profile })}>사업 프로필 저장</button></div>}
          {tab === "sources" && <div className="admin-form"><div className="source-status"><Connection on={connections?.g2b} label="나라장터 API" /><Connection on={connections?.bizinfo} label="기업마당 API" /></div><p>서비스키는 배포 환경변수에 저장합니다. 화면이나 D1에 평문으로 노출하지 않습니다.</p><div className="form-grid"><label>기관명<input value={agency.name} onChange={(e) => setAgency({ ...agency, name: e.target.value })} /></label><label>기관 유형<select value={agency.agencyType} onChange={(e) => setAgency({ ...agency, agencyType: e.target.value })}>{agencyTypes.slice(1).map((v) => <option key={v}>{v}</option>)}</select></label><label>지역<select value={agency.region} onChange={(e) => setAgency({ ...agency, region: e.target.value })}>{regions.map((v) => <option key={v}>{v}</option>)}</select></label><label>수집 방식<select value={agency.sourceType} onChange={(e) => setAgency({ ...agency, sourceType: e.target.value })}><option value="api">공식 API</option><option value="scrape">HTML 커넥터</option></select></label><label className="wide">홈페이지·엔드포인트<input value={agency.homepageUrl} onChange={(e) => setAgency({ ...agency, homepageUrl: e.target.value })} /></label></div><button className="primary-button" onClick={() => save({ type: "agency", ...agency })}>기관 추가</button><div className="agency-list">{(admin?.agencies || []).map((item: Row) => <div key={item.id}><span><b>{item.name}</b><small>{item.type} · {item.region_sido}</small></span><em>{item.is_active ? "활성" : "비활성"}</em></div>)}</div></div>}
          {tab === "ai" && <div className="admin-form"><div className="api-card"><div><span>OpenAI Responses API</span><strong>{connections?.openai ? "연결됨" : "환경변수 설정 필요"}</strong><small>키는 서버에서만 사용되며 브라우저로 반환되지 않습니다.</small></div><button onClick={testAI}>연결 테스트</button></div><div className="model-grid">{Object.entries({ summary: "공고 요약", relevance: "적합도 분석", attachment: "첨부문서 분석", classification: "키워드 분류" }).map(([key, label]) => <label key={key}>{label}<select value={models[key as keyof typeof models]} onChange={(e) => setModels({ ...models, [key]: e.target.value })}>{(admin?.models || []).map((model: Row) => <option key={model.id} value={model.id}>{model.id} · {model.label}</option>)}</select></label>)}</div><div className="model-notes">{(admin?.models || []).map((model: Row) => <div key={model.id}><b>{model.label}</b><span>{model.id}</span><small>{model.note}</small></div>)}</div><button className="primary-button" onClick={() => save({ type: "models", ...models })}>모델 설정 저장</button></div>}
          {tab === "system" && <div className="system-grid"><div><span>D1 데이터베이스</span><strong>연결됨</strong><small>공고·로그·분석·메모 영구 저장</small></div><div><span>저장된 공고</span><strong>{admin?.stats?.total || "대시보드 확인"}</strong><small>중복키 기반 버전 갱신</small></div><div><span>첨부 저장소</span><strong>확장 대기</strong><small>R2 바인딩 추가 시 원본 저장</small></div><div><span>보안 상태</span><strong>환경변수 권장</strong><small>ADMIN_PASSWORD·APP_ENCRYPTION_KEY</small></div></div>}
          {feedback && <p className="inline-feedback">{feedback}</p>}
        </section>
      </div>}
    </div>
  </div>;
}
