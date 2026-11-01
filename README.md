# 제주상점 (day5)

제주 특산품을 골라 담고 주문하는 쇼핑몰과, 날씨를 보고 서귀포 관광지를 골라 주는 에이전트(서귀포 길잡이)를 담은 프로젝트입니다.

- 쇼핑몰: <https://day5-flax.vercel.app> (로그인 없이 열립니다)
- 에이전트 화면: <https://day5-flax.vercel.app/guide.html>
- 저장소: <https://github.com/jeongeunlee0/day5> (`main` 브랜치에 푸시하면 Vercel이 자동 배포)

> 지금 상태를 정직하게 적어 두면: 쇼핑몰은 **체험 모드(브라우저 저장)와 체험 결제**로 끝까지 동작합니다. 에이전트는 키가 없어도 **규칙 기반 안내**로 답하고, 키가 있으면 Claude 가 답합니다. Supabase 연결과 실제 결제는 하지 않았습니다. 자세한 내용은 [알려진 한계](#알려진-한계와-아직-안-한-것)를 보세요.

---

## 1. 무엇이 들어 있나

| 구성 | 위치 | 설명 |
|---|---|---|
| 쇼핑몰 | `index.html` + `src/shop/` | 3D 메인 화면, 상품 28개, 장바구니, 체험 결제와 주문·반품, 로그인, 방명록, 문의 채팅 |
| 서귀포 길잡이 | `guide.html` + `src/guide/` | 3D 지도 + 대화. 날씨·관람객 통계 도구를 쓰는 에이전트 |
| 에이전트 API | `api/agent.js`, `api/_lib/` | Vercel 서버리스 함수. Claude(키가 있을 때) 또는 규칙 기반(키가 없을 때) + 호출 제한 |
| 상품 데이터 | `public/data/products.json` | 상품의 단일 원본 |
| DB | `supabase/` | 스키마(`schema.sql`)와 상품 시드(`seed_products.sql`) |
| 도구 | `scripts/` | 데이터 점검·시드 생성·관람객 CSV 가져오기·커서 생성·브라우저 회귀 검사 |

## 2. 빠른 시작

필요한 것: Node.js (`^20.19.0` 또는 `>=22.12.0`, Vite 8 요구 사항).

```bash
npm install
npm run dev
```

`http://localhost:5173/` 을 엽니다. 키를 하나도 설정하지 않아도 쇼핑몰은 **체험 모드**로, 에이전트는 **규칙 기반 안내**로 바로 동작합니다.

- 체험 모드: 계정·장바구니·주문·방명록이 이 브라우저(localStorage)에만 저장됩니다. 비밀번호는 솔트가 붙은 SHA-256 해시로만 저장합니다.
- Supabase 모드: 환경변수가 있으면 자동으로 전환되고, 화면 맨 위 배지가 `DEMO` → `LIVE` 로 바뀝니다.

### 명령어

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 (에이전트 API도 같은 서버에서 동작) |
| `npm run build` / `npm run preview` | 배포용 빌드 / 빌드 결과 미리보기 |
| `npm run lint` | oxlint |
| `npm run validate:data` | 상품 JSON 점검 (중복·카테고리 표기·가격 범위) |
| `npm run build:seed` | `products.json` → `supabase/seed_products.sql` 생성 |
| `npm run import:visitors -- <파일.csv>` | 내려받은 관람객 CSV 를 검증해 `api/_data/` 에 정리해 넣기 (`--dry-run` 은 검증만) |
| `npm run build:cursor` | 귤 커서 SVG → `public/cursor.css` 생성 |
| `npm run check` | lint + 데이터 점검 + 빌드를 한 번에 |

## 3. 환경변수

`.env.example` 을 복사해 `.env.local` 로 만듭니다. `.env*` 는 `.gitignore` 에 들어 있어 커밋되지 않습니다.

| 이름 | 어디서 쓰나 | 필요한 때 |
|---|---|---|
| `VITE_SUPABASE_URL` | 쇼핑몰(브라우저) | Supabase 모드 |
| `VITE_SUPABASE_ANON_KEY` | 쇼핑몰(브라우저) | Supabase 모드. anon 키는 공개용이라 브라우저에 노출돼도 됩니다 |
| `ANTHROPIC_API_KEY` | 에이전트 API(서버 전용) | Claude 가 답하게 하려면. **없으면 규칙 기반 안내로 답합니다** |
| `RATE_LIMIT_PER_MIN`, `RATE_LIMIT_PER_DAY` | 에이전트 API(서버 전용) | 선택. IP당 호출 제한(기본 8회/분 · 60회/일) |

`VITE_` 접두사가 붙은 값만 브라우저로 나갑니다. `ANTHROPIC_API_KEY` 는 접두사가 없어서 서버에서만 읽힙니다. 이 키를 `VITE_` 로 바꾸면 안 됩니다.

쇼핑몰 화면 아래쪽 "Supabase 연결 설정"에 URL·키를 직접 넣어도 되지만, 그 브라우저에만 저장됩니다.

## 4. 폴더 구조

```
.
├─ index.html              쇼핑몰 마크업 (스타일·스크립트는 src/shop)
├─ guide.html              서귀포 길잡이 화면
├─ src/
│  ├─ shop/                쇼핑몰 (아래 5절)
│  │  ├─ main.js           진입점: 모듈을 연결하고 시작
│  │  ├─ shop.css          전체 스타일
│  │  ├─ util.js           $, esc, won, 카테고리 도우미, 토스트 …
│  │  ├─ state.js          상태 객체 S 한 곳
│  │  ├─ api.js            데이터 계층: demo(브라우저) / remote(Supabase)
│  │  ├─ payments.js       결제 연동 지점 (지금은 체험 결제)
│  │  ├─ render.js         상태 → 화면
│  │  ├─ session.js        로그인 사용자 데이터·방명록 다시 불러오기
│  │  ├─ ui.js             서랍·모달, 로그인 탭
│  │  ├─ actions.js        data-action 레지스트리 + 클릭 리스너 하나
│  │  ├─ forms.js          폼·입력 이벤트(로그인, 방명록, 검색, 정렬, Esc)
│  │  ├─ chat.js           문의 응대 채팅
│  │  ├─ content.js        제주어·토스트 문구
│  │  ├─ art.js            상품 일러스트(SVG)
│  │  ├─ effects.js        장바구니 날아가기, 스크롤 효과
│  │  └─ scene.js          three.js 메인 장면
│  └─ guide/               길잡이 화면 (main.js, guide.css)
├─ api/
│  ├─ agent.js             Vercel 함수: 입력 검증 → 호출 제한 → Claude 또는 규칙 기반
│  ├─ _lib/sites.js        관광지 6곳(이름·좌표·실내외)
│  ├─ _lib/tools.js        도구 2개: 날씨(Open-Meteo), 관람객 통계(CSV)
│  ├─ _lib/rules.js        키가 없을 때 쓰는 규칙 기반 안내
│  ├─ _lib/limit.js        호출 제한
│  └─ _data/               ← 관람객 CSV를 여기에 둡니다 (아래 8절)
├─ public/
│  ├─ data/products.json   상품 원본
│  └─ cursor.css           귤 마우스 커서 (생성 파일)
├─ supabase/
│  ├─ schema.sql           테이블·RLS 정책
│  └─ seed_products.sql    상품 시드 (생성 파일)
├─ scripts/
│  ├─ products.mjs         데이터 점검 / 시드 SQL 생성
│  ├─ import-visitors.mjs  관람객 CSV 검증·정리
│  ├─ make-cursor.mjs      커서 SVG 원본 + 생성기
│  └─ browser-regression.js  브라우저 회귀 검사 50개 (콘솔에 붙여 넣어 실행)
├─ prompt.html             (사이트와 무관) 스키마 요청용 프롬프트 안내 페이지
├─ vercel.json             함수에 api/_data 포함
├─ vite.config.js          멀티 페이지 빌드 + 개발 중 /api/agent 연결
└─ package.json
```

## 5. 쇼핑몰 코드 읽는 법

모듈은 **한 방향**으로만 의존합니다(순환 참조 없음). `→` 는 "가져다 쓴다"는 뜻입니다.

```
util                                      (아무것도 가져다 쓰지 않음)
state    → util
payments → util
api      → util, state
render   → util, art, state, api, content, payments
session  → state, api, render
ui       → util, state, api
effects  → util, art
chat     → util, state, api, content
actions  → util, state, api, render, session, ui, effects, content, chat, payments
forms    → util, state, api, render, session, ui, chat
scene    → util
main     → 위 모두를 연결하고 시작
```

핵심 아이디어 다섯 가지:

1. **상태는 `S` 한 곳** (`state.js`). 화면은 `render.js` 의 함수가 `S` 를 읽어 그립니다. 상태가 바뀌면 해당 `render*()` 만 다시 부릅니다.
2. **데이터 계층 `api`** (`api.js`). Supabase 키가 있으면 `remote`, 없으면 `demo` 가 `api` 가 됩니다. 두 객체는 같은 함수 이름(`cart`, `order`, `signIn` …)을 가지므로 화면 코드는 어느 쪽인지 알 필요가 없습니다. 기능을 추가할 때는 **두 객체 모두**에 함수를 추가해야 합니다.
3. **액션 레지스트리** (`actions.js`). 버튼에 `data-action="add" data-id="4"` 처럼 이름표를 달면, 문서에 달린 클릭 리스너 하나가 `ACTIONS['add']` 를 찾아 실행합니다. 새 버튼은 `ACTIONS` 에 함수 하나만 추가하면 됩니다.
4. **결제는 한 곳** (`payments.js`). "주문하기"는 결제 확인 창을 열고, `requestPayment()` 가 성공해야만 `api.order()` 로 주문이 만들어집니다. 실패하면 주문도 장바구니 변경도 없습니다. 지금은 **체험 결제**(실제 청구 없음, 카드·계좌 정보를 받지 않음)이며, 실제 결제사를 붙일 때는 이 함수만 바꾸면 됩니다.
5. **채팅은 의도 목록** (`chat.js`). `INTENTS` 배열의 한 줄이 한 가지 질문 유형입니다. `test(질문)` 이 참이면 `reply(질문)` 이 `{ text, actions }` 를 돌려줍니다. 위에서부터 처음 맞는 것이 답합니다.
   - 답은 **불러온 상품 데이터로만** 만듭니다. 사이트에 등록되지 않은 정책(배송 등)은 추측하지 않고 모른다고 말합니다. 새 의도를 넣을 때도 이 원칙을 지켜 주세요.

### 자주 하는 변경

| 하고 싶은 일 | 고칠 곳 |
|---|---|
| 상품 추가·가격 변경 | `public/data/products.json` → 6절 |
| 새 버튼/동작 | 마크업에 `data-action`, `actions.js` 의 `ACTIONS` 에 함수 |
| 실제 결제 연동 | `payments.js` 의 `requestPayment` 를 결제사 호출로 교체 (결제 승인은 서버에서 검증하세요) |
| 채팅이 새 질문에 답하게 | `chat.js` 의 `INTENTS` 에 한 줄 |
| 상품 그림 추가 | `art.js` 의 `switch` 에 이모지별 `case` (그리고 `scripts/products.mjs` 의 `ART_EMOJI` 목록) |
| 색·레이아웃 | `shop.css` (색은 맨 위 `:root` 변수) |
| 메인 3D 장면 | `scene.js` |
| 커서 모양 | `scripts/make-cursor.mjs` 수정 후 `npm run build:cursor` |

## 6. 상품 데이터 작업 흐름

`public/data/products.json` 이 **유일한 원본**입니다. 체험 모드는 이 파일을 직접 읽고, Supabase 모드는 같은 내용을 넣은 DB를 읽습니다.

```bash
# 1) JSON 수정
# 2) 점검 — 오류가 있으면 종료 코드 1
npm run validate:data
# 3) DB 시드 재생성
npm run build:seed
# 4) Supabase SQL Editor 에서 supabase/seed_products.sql 실행 (id 기준 덮어쓰기라 여러 번 실행해도 안전)
```

규칙:

- `category` 는 `과일 · 채소·곡물 · 육류 · 수산 · 간식·가공` 5가지 **표기 그대로**만 씁니다(DB에도 같은 check 제약이 있습니다).
- `emoji` 는 어떤 일러스트를 쓸지 고르는 값입니다. `art.js` 에 그림이 있는 이모지만 쓸 수 있습니다.
- 기존 상품의 `id`·`name` 을 바꾸면 이미 쌓인 장바구니·주문과 어긋날 수 있습니다.
- **가격은 화면 구성을 위한 예시값**이며 실제 시장 가격이 아닙니다. 판매 전에 직접 정해야 합니다.
- 상품 설명은 웹 검색으로 확인한 일반적 특징만 적었습니다. 검증하지 못한 품목(카라향, 전복, 오메기술, 고사리)은 JSON의 `unverifiedExcluded` 에 기록하고 넣지 않았습니다. 근거는 상품마다 `basis`, 출처는 `meta.sources` 에 있습니다.

점검 도구(`scripts/products.mjs validate`)가 보는 것: id 형식·중복, 이름 중복, **규격만 다른 같은 상품**(한라봉 3kg 과 5kg), 설명 중복, 카테고리 표기, 가격 범위, 그림이 없는 이모지, 상품이 1개뿐인 카테고리.

## 7. Supabase 설정 순서

> 아직 연결하지 않았습니다(보류). 연결할 때 아래 순서를 따르세요.

1. 프로젝트를 만든 뒤 SQL Editor 에서 **`supabase/schema.sql`** 을 실행합니다. 테이블 6개와 행 단위 보안(RLS) 정책이 만들어집니다.
2. 이어서 **`supabase/seed_products.sql`** 을 실행합니다. 상품 28개가 들어갑니다.
3. `.env.local`(또는 Vercel 환경변수)에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 를 넣습니다.
4. 가입 직후 바로 로그인되게 하려면 Authentication → Providers → Email 에서 "Confirm email" 을 끕니다. 켜 두면 인증 메일의 링크를 누른 뒤에 로그인할 수 있습니다.

주의:

- `schema.sql` 은 **한 번만** 실행하세요. 정책(`create policy`)에 `if not exists` 가 없어 다시 실행하면 중복 오류가 납니다.
- `products` 테이블은 읽기 정책만 있어 브라우저에서 수정할 수 없습니다. 상품 변경은 SQL Editor 에서 시드를 다시 실행하는 방식입니다.
- 이미 예전 스키마를 실행했다면 새로 만들지 말고 `category` 컬럼(`text not null`, 위 5가지 check)을 추가하세요.
- 주문 테이블에는 결제 정보 컬럼이 없습니다. 실제 결제를 붙일 때는 결제 식별자·상태를 저장할 컬럼과 서버 검증이 필요합니다.

## 8. 서귀포 길잡이(에이전트)

흐름: 질문 → `POST /api/agent` → (입력 검증 → 호출 제한) → 답 + 추천 관광지 → 화면이 지도에 표시. 답하는 쪽은 둘 중 하나입니다.

| 모드 | 언제 | 어떻게 |
|---|---|---|
| **규칙 기반** (`mode: "rules"`) | `ANTHROPIC_API_KEY` 가 **없을 때** | 같은 도구로 6곳의 날씨·통계를 모아 단순한 규칙으로 고름. 모델의 판단이 아니며 답변에도 그렇게 밝힘 |
| **Claude** (`mode: "ai"`) | 키가 **있을 때** | `claude-opus-5-5` 가 도구를 골라 호출하며 답함 (최대 8턴) |

규칙 기반의 기준(`api/_lib/rules.js` 맨 위 상수): 앞으로 12시간 중 **비·눈 예보, 강수확률 50% 이상, 풍속 10m/s 이상**이면 야외를 피하고 실내(감귤박물관)를 우선합니다. 붐비지 않는 달일수록 가점이 있고, 질문에 "실내/비", "야외/산책", "한적/붐비" 같은 말이 있으면 반영합니다.

| 도구 | 내용 |
|---|---|
| `get_weather_forecast` | [Open-Meteo](https://open-meteo.com) 시간별 예보 24시간. **API 키 불필요** |
| `get_visitor_trend` | 서귀포시 관람객 월별 통계(공공데이터 15125100 CSV) |

화면은 답변과 함께 "생각 과정 보기"에서 찾기·판단·실행 3단계를 보여 주고, 위쪽 안내에 **지금 어떤 상태인지**(관람객 자료 유무, 규칙 기반 여부)를 알립니다.

### 관람객 CSV 준비

1. [공공데이터포털 15125100](https://www.data.go.kr/data/15125100/fileData.do)에서 CSV 를 내려받습니다. (포털이 로그인 세션 기반 다운로드라 자동으로 받을 수 없어 직접 받아야 합니다.)
2. 검증하고 넣습니다.
   ```bash
   npm run import:visitors -- 내려받은파일.csv --dry-run   # 검증만
   npm run import:visitors -- 내려받은파일.csv             # 검증 후 api/_data/seogwipo-visitors.csv 로 저장
   ```
3. 커밋·푸시하면 배포에 포함됩니다. 화면의 "관람객 통계 자료가 아직 없어요" 안내가 사라지는지 확인하세요.

도구가 하는 일: UTF-8 이 아니면 EUC-KR 로 읽어 UTF-8 로 바꾸고, `"12,345"` 같은 따옴표 속 쉼표를 없애 순수 숫자로 정리합니다(에이전트의 CSV 읽기는 쉼표로 단순 분리하므로 필요한 작업입니다). 필요한 열 이름, 연도·월 범위, 음수·글자 값, 같은 달 중복은 **오류로 막고 저장하지 않으며**, 빈 칸과 12개월이 안 되는 연도는 경고합니다. 열 이름은 `기준연도, 기준월, 천지연폭포, 천제연폭포, 정방폭포, 중문대포 주상절리대, 산방산_용머리, 감귤박물관(, 데이터기준일자)` 여야 합니다(포털 페이지로 확인).

### 호출 제한과 응답 코드

`POST` 는 IP당 **8회/분, 60회/일**(환경변수로 조정)로 제한합니다. 입력 검증 다음, 모델·외부 API 호출 앞에서 확인합니다. 이 제한은 서버리스 인스턴스 메모리 기준의 **최선형**입니다(인스턴스가 여러 개이거나 새로 뜨면 횟수가 따로 세어짐). 더 단단히 막으려면 Vercel 방화벽의 Rate Limiting 을 함께 쓰세요.

| 코드 | 의미 |
|---|---|
| 200 | 정상 (`GET`: 관광지 목록·`ai`/`csvReady` 상태, `POST`: 답변) |
| 400 | 빈 질문·잘못된 JSON |
| 413 | 요청이 너무 큼 (개발 서버 경로에서 10KB 초과) |
| 429 | 호출 제한 초과 (`Retry-After` 헤더) |
| 405 | 지원하지 않는 메서드 |
| 500 / 502 | 서버 오류 / 모델 API 오류 |

## 9. 배포 (Vercel)

- `main` 에 푸시하면 자동 배포됩니다. 프레임워크는 Vite, 루트 디렉터리는 `.` 입니다.
- 환경변수는 Vercel 프로젝트 설정에 등록합니다(3절). **추가한 뒤에는 재배포**해야 반영됩니다.
- `vercel.json` 은 `api/_data/**`(관람객 CSV)를 서버리스 함수에 포함시킵니다. 없으면 배포 환경에서 CSV를 못 읽습니다.
- 프로덕션 주소(`day5-flax.vercel.app`)는 공개입니다. 같은 프로젝트의 다른 주소(`…-leejeongeun.vercel.app`, 미리보기 배포)는 Vercel 로그인 보호가 켜져 있어 로그인해야 열립니다.

## 10. 점검 방법

```bash
npm run check        # 린트 + 데이터 점검 + 빌드
```

브라우저 회귀 검사(50개): `npm run dev` 로 서버를 켜고 체험 모드의 `http://localhost:5173/` 을 연 뒤, 개발자 도구 콘솔에 `scripts/browser-regression.js` 를 붙여 넣습니다. 상품 필터·검색·정렬, 가입·로그인·오류 안내, 장바구니, **체험 결제(실패 시 주문·장바구니 불변 포함)**, 주문·반품, 방명록, 채팅, 스크롤 효과를 확인하고 `50 passed, 0 failed` 를 돌려줘야 합니다. 이 검사는 localStorage 를 지우므로 평소 쓰는 브라우저 프로필에서는 주의하세요.

자동 테스트 러너(CI)는 설정되어 있지 않습니다.

## 알려진 한계와 아직 안 한 것

- **실제 결제는 연결되어 있지 않습니다.** 결제사 계약과 키가 필요해서 하지 못했고, 대신 "체험 결제"(실제 청구 없음·카드 정보 수집 없음)를 화면에 분명히 표시합니다. 반품도 상태만 "반품됨"으로 바꾸며 환불 정산은 없습니다. 실제 결제를 붙이는 방법은 5절의 표를 보세요.
- **가격은 예시값**입니다(6절).
- **Supabase 는 보류했습니다.** 코드는 `remote` 에 구현되어 있지만 키가 없어 실서버로 실행해 보지 못했습니다. 연결할 때 7절을 따르고, 가입·장바구니·주문·방명록을 직접 눌러 확인하세요(회귀 스크립트는 체험 모드 전용). 연결 실패 시 안내 메시지는 확인했습니다.
- **Claude 모드의 실제 응답은 키가 없어 실행해 보지 못했습니다.** 도구, 규칙 기반 모드, API 응답 코드, 화면은 각각 확인했지만 모델이 도구를 부르는 전체 흐름은 키를 넣은 뒤 직접 확인해야 합니다.
- **관람객 CSV 는 아직 들어 있지 않습니다.** 포털에서 직접 받아 8절의 도구로 넣어야 합니다. 도구와 에이전트 연동은 시험용 합성 데이터로 끝까지 확인했지만, 실제 포털 파일로는 해 보지 못했습니다.
- **호출 제한은 최선형**입니다(8절). 키를 등록해 공개하기 전에 플랫폼 수준의 제한도 함께 쓰길 권합니다.
- **비밀번호 찾기·재설정 기능이 없습니다.**
- **체험 모드 계정은 그 브라우저에서만 유효**합니다. 다른 기기에서는 쓸 수 없습니다. 실제 서비스는 Supabase 모드로 써야 합니다.
- Open-Meteo 는 일반 예보 모델이라 기상청 단기예보보다 서귀포 현지 정확도가 떨어질 수 있습니다. 무료 API 는 비상업 이용 기준으로 알려져 있으나 제가 이용 조건을 직접 확인하지는 않았으니, 상업적으로 쓴다면 [공식 조건](https://open-meteo.com/en/terms)을 확인하세요.
- 메인 화면의 3D(three.js)는 약 546KB(gzip 136KB)입니다. 느린 회선에서는 첫 로딩이 깁니다.
- 외부에서 불러오는 것은 **G마켓 산스 폰트 2개(jsdelivr CDN)뿐**입니다. three.js 와 Supabase 클라이언트는 npm 패키지로 빌드에 포함되어 CDN 없이 동작합니다. 폰트를 불러오지 못하면 시스템 한글 글꼴로 대신 표시됩니다.

## 정리 이력

처음 만든 React 앱의 흔적(`App.jsx`, `components/`, `data/vibes.js`, `src/App.jsx`, `src/supabaseClient.js`, `1.html`, 기본 아이콘·이미지 등 18개 파일)과 사용하지 않는 의존성(`react`, `react-dom`, `@types/react*`, `@vitejs/plugin-react`)은 사이트가 참조하지 않는 것을 확인한 뒤 지웠습니다. 모두 git 이력에 남아 있어 필요하면 되살릴 수 있습니다.
