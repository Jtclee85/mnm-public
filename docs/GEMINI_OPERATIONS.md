# Gemini 공급자와 학급 코드 운영 문서

공개용 뭐냐면(`mnm-public`)은 생성형 AI 공급자로 Gemini를 쓴다. **교사**가 자기 Gemini API 키로 학급 코드를 만들고, **학생**은 학급 코드만 입력해 AI 기능을 쓴다. 학생 화면에는 키가 전달되지 않는다.
원본 심사본(`Jtclee85/mnm`)과 원본 Vercel 프로젝트 `mnm`에는 적용하지 않는다.

> **현재 상태 (2026-09-30)**: 로컬 구현과 테스트만 끝났다. Vercel 환경변수 변경, Upstash 연결, Production 배포는 하지 않았다.
> 사용자 결정으로 당분간 **교사 개인 테스트 용도**로만 쓴다. Gemini 약관 문제(아래 [보류된 약관 검토](#보류된-약관-검토))는 나중에 해결한다.

## 1. 선택한 모델

| 항목 | 값 |
|---|---|
| 모델 코드 | `gemini-3.5-flash` |
| 설정 위치 | [lib/server/ai/gemini.js](../lib/server/ai/gemini.js)의 `GEMINI_MODEL` (이 상수만 바꾸면 전체가 바뀐다) |
| 호출 방식 | Gemini REST API `v1beta` (`generateContent`, `streamGenerateContent?alt=sse`, `models.get`) |

### 선택 근거 (2026-09-29 Google 공식 문서 확인)

- [모델 목록](https://ai.google.dev/gemini-api/docs/models): `gemini-3.5-flash`는 **Stable**(안정) 모델이다. Preview·Experimental이 아니다.
- [가격표](https://ai.google.dev/gemini-api/docs/pricing): `gemini-3.5-flash`의 **무료 등급(Free Tier)** 입력·출력이 "Free of charge"로 제공된다.
- [모델 상세](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash): 텍스트·이미지 입력, 구조화 출력(Structured outputs), 입력 1,048,576 토큰, 출력 65,536 토큰을 지원한다. 표지판 사진 읽기와 관련성 판정을 한 모델로 처리할 수 있다.
- 작업지시의 기본 후보(품질 우선의 `gemini-3.5-flash`)가 위 조건(안정 버전, 무료 등급 제공)을 모두 만족해 그대로 채택했다.

참고: 같은 문서에서 `gemini-3.5-flash`는 "legacy Flash model"로 소개되고, 더 새로운 안정 모델(`gemini-3.6-flash`, `gemini-3.7-flash`, `gemini-3.8-flash`)도 무료 등급으로 제공된다. 실제 학생 자료로 품질·속도·무료 한도를 비교한 뒤 `GEMINI_MODEL`만 바꿔 교체할 수 있다.

### SDK 대신 REST를 쓰는 이유

모든 `pages/api/*` 라우트는 Edge runtime이다. 공식 `@google/genai` SDK가 Next.js 14.2 Edge 번들에서 문제없이 동작하는지 확실히 확인할 수 없었고, 새 의존성을 추가하지 않는다는 프로젝트 규칙도 있다. 그래서 Gemini와 Upstash 모두 `fetch`로 REST API를 직접 호출한다.

## 2. 구조

```
[교사] /teacher ──(교사 키, 헤더)──▶ /api/verify-ai-key, /api/class/create|update
          │                                   │  키 확인(models.get) 후 AES-GCM 암호화
          │ 관리 토큰(이 기기 localStorage)      ▼
          └──────────────────────────▶ Upstash Redis  mnm:class:{학교-4자리}  (한국 시간 자정 만료)
                                              ▲
[학생] / ──(학급 코드, 헤더)──▶ /api/chat 등 ──┘ 요청마다 조회·복호화 → Gemini 호출 → 결과만 학생에게
```

| 파일 | 역할 |
|---|---|
| `lib/aiProviderConfig.js` | 공급자 선택(`AI_PROVIDER`), 헤더 이름, 오류 code — 화면·서버 공용 |
| `lib/server/ai/provider.js` | 공급자 공통 인터페이스, 학급 코드로 교사 키 찾기, 교사 키 헤더 읽기 |
| `lib/server/ai/gemini.js` | Gemini 요청·스트리밍·오류 분류 (`GEMINI_MODEL`) |
| `lib/server/ai/openai.js` | 기존 OpenAI 구현 보존 (롤백용) |
| `lib/server/ai/messages.js` · `errors.js` · `safety.js` | 메시지 변환, 공통 오류, 입력 검증·안전 설정 |
| `lib/server/class/redis.js` | Upstash REST 클라이언트 |
| `lib/server/class/crypto.js` | 교사 키 AES-GCM 암호화 (`CLASS_KEY_SECRET`) |
| `lib/server/class/classes.js` | 학급 코드 생성·조회·교체·삭제, 자정 만료, 틀린 코드 시도 제한 |
| `pages/api/class/{create,join,update,delete}.js` | 학급 API |
| `pages/teacher.js` · `components/TeacherClassPanel.js` | 교사용 설정 화면 (한국어 고정) |
| `components/ClassCodeDialog.js` · `lib/useClassSession.js` | 학생 학급 코드 입력 창과 참여 상태 |
| `lib/useAiKey.js` · `components/AiKeySettingsDialog.js` | 교사 기기의 키 보관과 키 설정 창 |
| `lib/useTeacherClasses.js` | 교사 기기에서 만든 학급 목록과 관리 토큰 |
| `lib/aiRequestGuard.js` | 학생 브라우저의 중복 요청 방지 |

## 3. 교사 흐름

1. `mnm-public.vercel.app/teacher`에 들어간다(학생 학급 코드 창의 "선생님이신가요?" 링크로도 갈 수 있다).
2. **① Gemini API 키**: [Google AI Studio](https://aistudio.google.com/apikey)에서 받은 키를 넣고 **연결 확인**을 누른다. 생성 요청 없이 `models.get`으로 확인하고, 성공해야 저장한다.
   - 키는 교사 기기에만 저장한다. 기본은 `sessionStorage`(탭을 닫으면 삭제), **이 기기에 저장**을 고르면 `localStorage`.
3. **② 오늘의 학급 코드 만들기**: 학교 이름(한글·영문·숫자 1~20자)을 넣으면 `학교이름-숫자4자리`(예: `해원초-4821`) 코드가 만들어진다.
   - 서버는 키를 다시 확인한 뒤 AES-GCM으로 암호화해 Upstash에 저장하고, **발급한 날 한국 시간 자정**에 자동으로 지운다.
   - 같은 날 같은 학교에 같은 숫자가 있으면 다른 숫자로 다시 뽑는다.
4. **이 기기에서 만든 학급**: 코드 복사, 지금 키로 교체, 코드 재발급(새 코드 발급 후 이전 코드 삭제), 학급 삭제.
   - 관리 권한은 학급을 만들 때 받은 **관리 토큰**으로 확인한다. 토큰 원문은 이 기기의 `localStorage['mnmTeacherClasses']`에만 있고, 서버에는 SHA-256 해시만 있다. 다른 기기에서는 관리할 수 없다.
5. 다음 날에는 새 코드를 만든다. 키가 이 기기에 남아 있으면 다시 입력하지 않아도 된다.

## 4. 학생 흐름

1. `mnm-public.vercel.app`에 들어가 사용법 6과정을 본다. 사용법 안의 분석 체험은 미리 준비된 결과를 써서 AI를 부르지 않는다.
2. 사용법이 끝나면(완료·나중에 보기·다시 보지 않기 모두) **학급 코드 입력** 창이 뜬다. '자료조사 주의점'으로 가면 그 안내를 닫은 뒤에 뜬다.
3. 코드를 넣고 **들어가기**를 누르면 서버가 코드를 확인한다. 응답에는 코드·학교 이름·만료 시각만 있고 키는 없다.
4. 참여 정보(`mnmClassSession`: 코드·학교 이름·만료 시각)는 `localStorage`에 둔다. 코드는 키가 아니고 그날 자정에 만료되므로, 같은 날 탭을 새로 열어도 다시 넣지 않게 하기 위해서다. 만료 시각이 지나면 자동으로 지운다.
5. 학급에 들어와 있지 않으면 분석·모드 전환·퀴즈·평가·교과평어·챗봇·사진 글자 읽기를 시작하지 않고 학급 코드 창을 연다. 입력한 조사 주제·자료·챗봇 질문은 그대로 남는다.
6. 머리글의 **🏫 학급 코드** 버튼으로 참여한 학급을 확인하거나 나갈 수 있다.
7. 사용법 '다시 보지 않기'(`mnmAppUsageTutorialSeen`)와 학급 참여(`mnmClassSession`)는 따로 관리된다.

오프라인 데모(`NEXT_PUBLIC_OFFLINE_DEMO_MODE=true`)는 API를 호출하지 않으므로 학급 코드를 요구하지 않고, 교사 화면도 안내만 보여 준다.

## 5. 키와 코드의 보관·전달 방식

| 값 | 어디에 | 누가 볼 수 있나 |
|---|---|---|
| 교사 Gemini 키 원문 | 교사 브라우저(`sessionStorage` 기본, 선택 시 `localStorage`) | 교사 기기 |
| 교사 키 암호문 | Upstash `mnm:class:{코드}` (자정 만료) | 서버(`CLASS_KEY_SECRET`로만 복호화) |
| 관리 토큰 원문 / 해시 | 교사 브라우저 `mnmTeacherClasses` / Upstash | 교사 기기 / 서버 |
| 학급 코드 | 학생 브라우저 `mnmClassSession` | 학생·교사 |
| 틀린 코드 시도 횟수 | Upstash `mnm:class-fail:{IP 해시}` (10분 만료) | 서버 (IP 원문은 저장하지 않음) |

- 교사 키는 키 확인·학급 만들기·키 교체 요청에서만 교사 브라우저가 헤더(`AI_KEY_HEADER`)로 보낸다. URL·query string·쿠키에는 넣지 않는다.
- 학생 AI 요청에는 학급 코드만 헤더(`CLASS_CODE_HEADER`)로 싣는다. 한글 학교 이름 때문에 `encodeURIComponent`로 인코딩한다.
- 서버는 요청을 처리하는 동안에만 키를 복호화해 지역 변수로 쓰고, Google로 보낼 때도 URL이 아니라 `x-goog-api-key` 헤더를 쓴다. 응답·로그·전역 변수에는 남기지 않는다.
- 암호문은 학급 코드를 추가 인증 데이터(AAD)로 묶어, 다른 학급 레코드로 옮겨 붙이면 풀리지 않는다.
- 서버 로그에는 분류된 오류 code와 HTTP 상태만 남긴다. 원본 오류 객체, 요청 본문, 이미지, 키, 학급 코드는 기록하지 않는다.
- 익명 학습 산출물 전송에는 키와 학급 코드 헤더가 섞이지 않는다(E2E로 확인).

### 숫자 4자리 코드의 위험과 대응

`학교이름-숫자4자리`는 학교 이름이 알려지면 경우의 수가 1만 개뿐이다. 그래서 다음을 함께 둔다.
- 같은 접속자(IP 해시)가 10분에 **10번** 틀리면 맞는 코드도 잠시 거절한다(`too_many_attempts`, `CLASS_FAILURE_LIMIT`로 조정). 한 반이 같은 공인 IP를 쓰므로, 학생들이 오타를 많이 내는 환경이면 값을 올린다.
- 코드는 **발급한 날 자정**에 만료된다.
- 교사는 언제든 **코드 재발급**이나 **학급 삭제**로 코드를 무효화할 수 있다.

### 공용 PC에서 지우는 방법

- 교사: `/teacher` → ① **키 바꾸기** → **키 삭제**. 오늘 학급이 더 필요 없으면 **학급 삭제**도 누른다.
- 학생: 머리글 **🏫 학급 코드** → **학급 나가기**.

## 6. Gemini를 호출하는 기능

| 기능 | 화면 동작 | 앱 라우트 | Gemini 호출 | 1회 동작당 호출 수 |
|---|---|---|---|---|
| 자료 분석(이해 모드) | 분석 시작 | `/api/chat` | `streamGenerateContent` | 1 (스트림 차단 시 `/api/chat-once`로 1회 추가) |
| 다른 모드 결과 | 탐구·발표·글쓰기 탭 첫 클릭 | `/api/chat` | `streamGenerateContent` | 1 (같은 조건의 fallback) |
| 퀴즈 | 퀴즈풀기 | `/api/chat` | `streamGenerateContent` | 1, 퀴즈 태그가 빠지면 1회 재요청 |
| 나 어땠어? | 평가 | `/api/chat` | `streamGenerateContent` | 1, 빈 응답이면 1회 재요청 |
| 교과평어 | 교과평어 만들기 | `/api/chat` | `streamGenerateContent` | 1 |
| 챗봇 관련성 판정 | 챗봇 질문 전송 | `/api/relevance` | `generateContent`(JSON) | 0~1 (주제 핵심어 직접 질문은 로컬 규칙으로 판정해 0) |
| 챗봇 답변 | 챗봇 질문 전송 | `/api/chat` | `streamGenerateContent` | 1 (fallback 조건 동일) |
| 표지판 사진 글자 읽기 | 글자 읽기 | `/api/extract-sign-text` | `generateContent`(이미지+JSON) | 1 |
| 교사 키 연결 확인 | 연결 확인 | `/api/verify-ai-key` | `models.get` (생성 없음) | 1 |
| 학급 만들기·키 교체 | ② 만들기, 지금 키로 교체, 재발급 | `/api/class/create`, `/api/class/update` | `models.get` (생성 없음) | 1 |
| 학급 참여·삭제 | 들어가기, 학급 삭제 | `/api/class/join`, `/api/class/delete` | 호출 안 함 (Upstash만) | 0 |
| 추천 영상 | 분석 완료 | `/api/recommended-videos` | 호출 안 함 (YouTube API) | 0 |
| 사용법 6과정의 분석 체험 | 사용법 3과정 | 없음 | 호출 안 함 (미리 준비된 결과) | 0 |

학생의 AI 요청 1건마다 Upstash 명령이 2~3개(GET 파이프라인 1회, 틀린 코드일 때 INCR·EXPIRE) 쓰인다. Upstash 무료 한도는 연결할 때 확인한다.

### 무료 사용량 보호 장치

- **한 학급의 모든 학생이 교사 키 하나의 무료 한도를 함께 쓴다.** 무료 한도는 키가 아니라 Google Cloud 프로젝트 단위로 적용된다.
- 같은 요청이 진행 중이거나 성공 후 3초 안이면 다시 보내지 않는다(`lib/aiRequestGuard.js`). 실패한 요청은 바로 다시 보낼 수 있다.
- 분석 버튼은 같은 순간의 연속 클릭도 한 번만 처리한다. 챗봇은 답변을 기다리는 동안 새 질문을 보내지 않는다.
- 서버가 code로 분류한 오류(학급 코드, 키, 할당량, 빈도 제한, 안전 차단, 서비스 장애)는 비스트리밍으로 다시 보내지 않는다. fallback은 SSE 차단·네트워크 끊김 같은 전송 문제에만 1회 쓴다.
- 스트리밍이 20자 이상 진행된 뒤 끊기면 다시 생성하지 않고 받은 곳까지로 끝낸다.
- `/api/chat`은 첫 조각을 받은 뒤에 SSE를 시작하므로, 학급·키·할당량 오류가 HTTP 상태로 전달된다.

## 7. 예상되는 오류와 안내

| code | HTTP | 원인 | 학생 화면 안내(한국어) |
|---|---|---|---|
| `class_code_required` | 401 | 학급 코드 없음 | 선생님께 받은 학급 코드를 넣어 주세요 (+ 학급 코드 창) |
| `class_code_invalid` | 401 | 없는 코드, 만료(자정), 삭제됨 | 코드가 맞는지, 오늘 받은 코드인지 확인 (+ 학급 코드 창) |
| `too_many_attempts` | 429 | 10분에 10번 넘게 틀림 | 잠시 후 다시 시도 |
| `class_unavailable` | 503 | Upstash·`CLASS_KEY_SECRET` 미설정·장애 | 선생님께 알려 주세요 |
| `invalid_key` / `missing_key` | 401 | 교사 키가 잘못되었거나 차단됨 | 선생님의 AI 키를 확인할 수 없어요. 선생님께 알려 주세요 |
| `forbidden` | 403 | 관리 토큰 불일치(교사 화면) | 학급을 만든 기기에서 관리해 주세요 |
| `quota_exceeded` | 429 | 교사 프로젝트의 하루 무료 한도 소진(`PerDay`) | 오늘 무료 사용량을 모두 썼어요. 선생님께 알려 주세요 |
| `rate_limited` | 429 | 분당 요청·토큰 한도 초과 | 잠시 후 다시 시도 |
| `unavailable` | 503 | Gemini 5xx, 모델 없음(404) | AI 서비스가 잠시 응답하지 않아요 |
| `safety_blocked` | 400 | 안전 필터 차단 | 학습 도우미가 다루기 어려운 내용이에요 |
| `network` | 502 | Gemini 연결 실패 | 인터넷 연결 확인 |
| `bad_response` | 502 | 빈 응답·JSON 형식 오류 | AI 응답을 읽지 못했어요 |
| `input_too_long` | 400 | 입력 25,000자 초과 | 조사자료를 짧게 줄여 주세요 |

- 하루 무료 한도는 **태평양 시간 자정**(한국 시간 오후 4시 또는 5시)에 초기화된다. 학급 코드 만료(한국 시간 자정)와 시각이 다르다.
- 정확한 RPM·TPM·RPD 수치는 AI Studio에서 확인한다.
- 원본 오류 메시지, 요청 헤더, 키는 브라우저에 돌려주지 않는다.

## 8. 안전 설정

Gemini 2.5·3 계열은 안전 필터 기본값이 꺼져 있다. 초등학생 대상 서비스이므로 [lib/server/ai/safety.js](../lib/server/ai/safety.js)에서 괴롭힘, 혐오 발언, 성적 콘텐츠, 위험한 콘텐츠 네 범주를 `BLOCK_MEDIUM_AND_ABOVE`로 켠다. OpenAI 모드의 `omni-moderation` 입력 검사를 대신한다.

## 9. 환경변수

| 이름 | 필요한 때 | 설명 |
|---|---|---|
| `AI_PROVIDER` | 항상(미설정 시 `gemini`) | `gemini` 또는 `openai`. 빌드 시점에 화면·서버에 주입되므로 바꾸면 재빌드 |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Gemini 모드 | Upstash 콘솔의 REST 주소·토큰. Vercel Marketplace 연결이 만드는 `KV_REST_API_URL` / `KV_REST_API_TOKEN`도 읽는다 |
| `CLASS_KEY_SECRET` | Gemini 모드 | 교사 키 암호화용 서버 비밀값, **32자 이상 무작위 문자열**. 바꾸면 기존 학급 코드가 모두 풀리지 않는다(자정까지 새로 만들어야 함) |
| `CLASS_FAILURE_LIMIT` | 선택 | 10분당 틀린 코드 허용 횟수(기본 10) |
| `OPENAI_API_KEY` | OpenAI 모드 | 롤백용 서버 키 |
| `GEMINI_API_BASE_URL` | **테스트 전용** | 서버의 Gemini 요청을 가짜 서버로 돌린다. 운영 환경에는 설정하지 않는다 |

`CLASS_KEY_SECRET` 만들기 예: `openssl rand -base64 48`. 값은 Vercel 환경변수에만 넣고 Git·채팅·로그에 남기지 않는다.

### 로컬 개발

실제 Upstash 없이 확인하려면 테스트용 가짜 서버를 함께 띄운다.

```
node tests/support/mock-upstash-server.js 3998
UPSTASH_REDIS_REST_URL=http://127.0.0.1:3998 UPSTASH_REDIS_REST_TOKEN=mock-upstash-token \
CLASS_KEY_SECRET=local-only-class-secret-not-for-production-000 npm run dev
```

실제 Gemini 키로 확인하려면 `GEMINI_API_BASE_URL`은 설정하지 않는다.

## 10. OpenAI로 롤백하는 방법

1. 빌드 환경에 `AI_PROVIDER=openai`와 `OPENAI_API_KEY`를 설정한다.
2. **다시 빌드**한다(로컬 dev는 재시작).
3. OpenAI 모드에서는 학급 코드 창과 머리글 버튼이 사라지고, 서버 키로 기존 OpenAI 구현([lib/server/ai/openai.js](../lib/server/ai/openai.js))을 쓴다. 학급 API는 400을 돌려주고, 교사 화면은 "학급 코드가 필요 없다"는 안내만 보여 준다. moderation 정책(chat fail-open, 관련성 판정 fail-closed)은 기존과 같다.
4. 로컬 확인: `AI_PROVIDER=openai npm run build && npx next start` 후 머리글에 학급 코드 버튼이 없고 `/api/verify-ai-key`가 `{"ok":true,"provider":"openai"}`를 돌려주면 된다.

Gemini 모드에서는 `OPENAI_API_KEY`가 없어도 모듈 로드와 빌드가 실패하지 않는다.

## 11. Production 활성화 전 확인

- [ ] Upstash Redis를 공개용 Vercel 프로젝트 `mnm-public`에만 연결한다(원본 `mnm`은 건드리지 않는다). 연결 후 실제 주입된 환경변수 이름을 확인해 이 문서를 갱신한다.
- [ ] `CLASS_KEY_SECRET`(32자 이상)을 `mnm-public` Production에 설정한다.
- [ ] `GEMINI_API_BASE_URL`이 설정되어 있지 않은지 확인한다.
- [ ] `AI_PROVIDER`를 결정한다(미설정 시 `gemini`). 결정 전 배포가 필요하면 `openai`로 두어 기존 동작을 유지한다.
- [ ] Vercel 로그·관측 도구에 요청 헤더가 기록되지 않는지 확인한다.
- [ ] 교사 키 1개로 `/teacher`에서 학급 코드를 만들고, 다른 기기(학생)에서 네 모드·쉬운한국어·챗봇·사진 읽기를 소량 점검한다.
- [ ] AI Studio에서 교사 프로젝트의 무료 한도(RPM·TPM·RPD)를 확인하고 한 반 동시 사용 규모와 비교한다.
- [ ] 학급 코드 창 번역(ko 외 11개 언어) 원어민 검수.

### 보류된 약관 검토

사용자 결정(2026-09-30): 교사 개인 테스트 단계이므로 아래 문제는 나중에 해결한다. 학생 대상 공개 운영 전에는 반드시 다시 검토한다.

1. **연령 요건** — [Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms) (최종 수정 2026-04-28):
   > "You must be 18 years of age or older to use the APIs. You also will not use the Services as part of a website, application, or other service (collectively, "API Clients") that is directed towards or is likely to be accessed by individuals under the age of 18."

   교사가 키를 가진 구조로 바꿔 '18세 이상이 API를 쓴다'는 요건은 교사 쪽에서 충족하지만, 앱을 초등학생이 이용한다는 두 번째 문장은 그대로 남는다.
2. **무료 등급 데이터 사용** — 무료 서비스의 입력·출력은 Google 제품 개선에 쓰이고 사람이 검토할 수 있으며, 개인·민감 정보를 보내지 말라고 명시되어 있다. 학생이 입력하는 조사 자료·질문·사진이 해당할 수 있다.
3. **지역 제한** — EEA·스위스·영국 사용자에게는 유료 서비스만 제공해야 한다.
