# 필로소피 AI · 입찰 공고 스크래퍼

공공기관 입찰·공모·지원사업을 공식 API에서 수집해 Cloudflare D1에 저장하고, OpenAI Responses API로 공고 요약과 회사 적합도를 분석하는 한국어 업무용 대시보드입니다.

## 구현 범위

- 나라장터 입찰공고정보서비스와 기업마당 지원사업 API 커넥터
- 중소벤처기업부 공식 사업공고 게시판 HTML 커넥터(인증키 없이 동작)
- 검색, 지역·기관·분야·정보유형·예산 필터, 기간 선택, 네 가지 정렬
- D1 영구 저장, 중복키 기반 갱신, 수집 로그와 버전 증가
- 공고 상세, 공식 원문 링크, 즐겨찾기, 태그, 메모
- 회사 프로필과 공고를 비교하는 서버 측 OpenAI 구조화 분석
- 관리자 인증, 공공기관 게시판 선택자 등록·사전 테스트·활성/중지, 역할별 AI 모델 설정
- 공공데이터포털·기업마당 서비스키 입력, 암호화 저장, 실제 연결 테스트
- 관리자 화면에서 OpenAI API 키 입력, AES-GCM 암호화 저장, 마스킹 상태 확인
- 실제 연결이 없으면 명시적인 빈 상태/연결 필요 상태 표시
- 반응형 단일 대시보드, 생성형 히어로 이미지와 소셜 카드

첨부파일 원본 R2 저장, PDF/DOCX/XLSX/HWP 텍스트 추출, OCR, 큐 기반 대량 수집은 다음 단계용 확장 지점을 마련했지만 이번 MVP에는 실제 처리기로 연결하지 않았습니다.

## 기술 구조

```text
app/
  api/
    admin/                 관리자 인증·설정
    ai/                    OpenAI 연결 테스트·분석
    collect/               공식 API 수집
    dashboard/             통계·공고·로그 조회
    opportunities/[id]/    메모·즐겨찾기
  procure-dashboard.tsx    단일 대시보드 UI
db/
  schema.ts                Drizzle/D1 스키마
  seed.sql                 선택적 명시 샘플
drizzle/                   생성된 D1 마이그레이션
lib/
  auth.ts                  서명된 HttpOnly 관리자 세션
  connectors.ts            Source Connector 구현
  db.ts                    Cloudflare 바인딩 접근
public/
  hero-banner.png
  og.png
```

프런트엔드는 Next.js App Router 호환 vinext, TypeScript, React, Tailwind CSS 기반입니다. 서버는 Cloudflare Worker, 저장소는 D1입니다.

## 로컬 실행

Node.js 22 이상이 필요합니다.

```bash
npm ci
copy .env.example .env.local
npm run db:generate
npx wrangler d1 execute DB --local --config wrangler.local.jsonc --file drizzle/0000_strong_proudstar.sql
npx wrangler d1 execute DB --local --config wrangler.local.jsonc --file drizzle/0001_bumpy_iceman.sql
npm run dev
```

D1 로컬 마이그레이션은 Wrangler/Vite 개발 환경의 로컬 DB에 `drizzle` 폴더 SQL을 적용합니다. 선택적 UI 샘플은 `db/seed.sql`을 명시적으로 실행할 때만 들어갑니다. 운영 배포에는 자동 시드하지 않습니다.

검증:

```bash
npm run build
npm test
npm run lint
npx tsc --noEmit
npm audit --omit=dev --audit-level=high
```

## 환경변수

`.env.example`을 기준으로 설정합니다.

- `ADMIN_PASSWORD`: 로컬 개발 기본값 `6085`. 공개 서버에서는 미설정 시 관리자 로그인을 거부하므로 긴 고유 비밀번호 등록 필수
- `APP_ENCRYPTION_KEY`: 관리자 세션 서명용 32자 이상 난수
- `OPENAI_API_KEY`: OpenAI 서버 전용 키
- `OPENAI_MODEL`: 기본 분석 모델. 기본값 `gpt-5.6-terra`
- `DATA_GO_KR_SERVICE_KEY`: 공공데이터포털 나라장터 서비스키
- `BIZINFO_API_KEY`: 기업마당 API 인증키

어떤 비밀값에도 `NEXT_PUBLIC_`을 붙이지 마세요. 인증키는 브라우저 번들 또는 API 응답으로 전달되지 않습니다.

## 공식 데이터 연동

### 나라장터

공공데이터포털의 `조달청_나라장터 입찰공고정보서비스` 활용신청 후 서비스키를 관리자 화면에 저장하거나 `DATA_GO_KR_SERVICE_KEY`에 설정합니다. 현재 버전은 용역 목록 오퍼레이션을 사용합니다. 물품·공사·사전규격·발주계획은 `lib/connectors.ts`의 동일 인터페이스로 추가할 수 있습니다.

### 기업마당

기업마당 정책정보 개방에서 지원사업정보 API 사용신청 후 인증키를 관리자 화면에 저장하거나 `BIZINFO_API_KEY`에 설정합니다.

중소벤처기업부 사업공고는 별도 인증키 없이 공식 목록에서 수집하며 원문 링크를 보존합니다. 관리자는 `.go.kr`, `.or.kr`, `.ac.kr`의 공개 HTTPS 게시판에 한해 CSS 선택자를 입력하고 저장 전 테스트할 수 있습니다. 서버는 응답 크기, 한 번의 수집 건수, 수집 간격을 제한합니다. robots.txt, 이용약관, 저작권, 재배포 조건은 기관별로 확인해야 하며 인증·접근 제한을 우회하면 안 됩니다.

## OpenAI 연결

OpenAI 키는 두 가지 안전한 서버 경로를 지원합니다.

1. Cloudflare의 `OPENAI_API_KEY` 비밀 환경변수
2. 관리자 화면 `AI · 모델`에서 입력 후 `API 키 저장`

관리자 화면에서 저장한 키는 `APP_ENCRYPTION_KEY`를 기반으로 AES-GCM 암호화되어 D1에 저장됩니다. 브라우저에는 연결 여부와 끝 4자리 마스킹만 반환되며 원문 키는 다시 표시되지 않습니다. 환경변수 키가 있으면 그것을 우선 사용합니다. `연결 테스트`는 서버가 OpenAI 모델 목록 API를 실제 호출해 인증 상태를 확인합니다.

분석은 Responses API의 `json_schema` 구조화 출력으로 수행하며 결과를 D1에 저장합니다.

역할별 기본 모델:

- 분류·빠른 요약: `gpt-5.6-luna`
- 적합도·첨부 분석: `gpt-5.6-terra`
- 복잡한 제안 전략: `gpt-5.6-sol`

관리자에서 역할별 모델을 바꾸면 다음 요청부터 실제 적용됩니다. 모델 접근 권한이나 API 상태에 따라 오류가 날 수 있으며, 앱은 그 오류를 사용자에게 표시하고 가짜 분석을 만들지 않습니다.

## 관리자 사용

상단 `마스터 관리자`에서 진입합니다. 로컬 개발 초기 비밀번호는 `6085`입니다.

초기 비밀번호는 로컬 개발 편의를 위한 값이며 공개 서버에서는 자동으로 활성화되지 않습니다. 운영 전 `ADMIN_PASSWORD`와 `APP_ENCRYPTION_KEY`를 등록하고, 향후에는 사용자 계정, MFA, 역할 기반 권한, 감사 로그, 로그인 속도 제한을 추가해야 합니다.

관리자에서 가능한 작업:

- 사업 프로필 입력·저장
- 공식 게시판 URL·CSS 선택자 등록, 저장 전 실제 수집 테스트, 활성/중지·삭제
- 나라장터·기업마당 서비스키 암호화 저장 및 실제 연결 확인
- 외부 소스와 OpenAI 연결 상태 확인
- 요약·적합도·첨부·분류 모델 역할 설정
- D1·R2·보안 구성 상태 확인

## Cloudflare Sites 배포

이 프로젝트의 `.openai/hosting.json`은 D1 논리 바인딩 `DB`를 선언합니다. Sites 배포 시 D1 리소스와 마이그레이션이 연결됩니다. 배포 후 Sites 환경변수에 모든 서버 비밀값을 등록하세요.

일반적인 자체 Cloudflare 배포를 사용할 경우:

1. D1 데이터베이스 생성
2. `DB` 바인딩 연결
3. `drizzle`의 SQL 마이그레이션 적용
4. 위 환경변수를 Worker Secret로 등록
5. 빌드 후 Worker/Pages 호환 산출물 배포

R2를 켜려면 `.openai/hosting.json`의 `r2`에 `ATTACHMENTS` 같은 논리 바인딩을 추가하고, `attachments.storage_key`에 객체 키만 저장하세요.

## GitHub 업로드

```bash
git init
git add .
git commit -m "Build ProcurePilot AI commercial MVP"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

`.env`, `.env.local`, API 키, 토큰, 실제 고객 데이터는 커밋하지 마세요. 배포는 보호된 `main` 브랜치와 승인된 마이그레이션을 기준으로 운영하는 것을 권장합니다.

## DB 스키마

요구된 핵심 테이블을 모두 포함합니다.

- `agencies`
- `opportunities`
- `attachments`
- `ai_analyses`
- `business_profiles`
- `app_settings`
- `collection_logs`
- `user_notes`

`opportunities.duplicate_key`는 공고번호·기관·정규화 제목·게시일을 기반으로 생성되며, 같은 키가 다시 들어오면 레코드를 갱신하고 `version`을 증가시킵니다.

## 기관 커넥터 추가

`lib/connectors.ts`의 반환 규격 `ConnectorResult`와 `OpportunityInput`을 구현합니다.

1. 목록 API 호출
2. 원본 응답 필드 정규화
3. 지역·분야·기간 필터 적용
4. 공식 원문 URL 보존
5. 오류를 숨기지 않고 호출자에게 전달
6. `app/api/collect/route.ts`의 수집 배열에 커넥터 추가

HTML 커넥터는 관리자 입력을 `validateScrapeConfig`로 검증한 뒤 실행합니다. 공공기관 HTTPS 도메인만 허용되며, 기관마다 행·제목·링크·등록일·마감일·기관명·공고 ID 선택자를 지정할 수 있습니다. 사이트 구조가 바뀌면 저장 전 수집 테스트로 선택자를 다시 확인해야 합니다.

## 배너 이미지

현재 `public/hero-banner.png`에 생성형 이미지를 적용했습니다. 교체 시 같은 파일명을 쓰거나 컴포넌트 경로를 변경합니다.

사용한 이미지 생성 프롬프트:

> 가로로 긴 실사 스타일의 전문적인 배너 이미지. 세련된 한국인 여성이 현대적인 사무용 컴퓨터 책상에 앉아 AI 기술로 공공기관 입찰 정보를 분석하고 있으며, 그 옆에 정장을 입은 한국인 남성이 자연스럽게 웃으며 화면의 입찰 정보를 가리킨다. 화면에는 읽을 수 없는 추상 데이터 대시보드가 보이고, 딥 네이비와 따뜻한 아이보리 색조의 밝고 신뢰감 있는 프리미엄 한국형 비즈니스 환경. 왼쪽은 흰색 문구를 위한 어두운 여백. 로고, 워터마크, 읽을 수 있는 텍스트 없음.

## 운영 보안 고도화

- 관리자 기본 비밀번호 폐기, MFA/RBAC/세션 회전
- Cloudflare Turnstile 및 수집·AI API 속도 제한
- 감사 로그, 데이터 접근 이력, 비밀값 회전 절차
- 첨부파일 MIME·크기·악성코드 검사와 격리
- 기관별 이용약관·공공누리·개인정보 영향 검토
- AI 입력 최소화, 보존기간, 삭제·내보내기 정책
- 분석 근거 원문 인용, 사람의 최종 확인, 비용 상한
- 백업·복구 훈련, 장애 알림, SLO와 운영 런북

AI 적합도는 내부 검토 우선순위를 돕는 참고값이며 참가자격, 법률·회계 판단, 낙찰 가능성을 보장하지 않습니다.
