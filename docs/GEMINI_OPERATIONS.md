# Gemini 공급자 운영 문서

공개용 뭐냐면(`mnm-public`)의 생성형 AI 공급자를 OpenAI에서 Gemini로 바꾼 구조와 운영 기준을 정리한다.
원본 심사본(`Jtclee85/mnm`)과 원본 Vercel 프로젝트 `mnm`에는 적용하지 않는다.

> **현재 상태 (2026-09-29)**: 로컬 구현과 테스트만 끝났다. Vercel 환경변수 변경, Production 배포, 공개 사이트 활성화는 하지 않았다.
> 아래 [Production 활성화 전 확인](#production-활성화-전-확인)의 **차단 요건**을 해결하기 전에는 공개 사이트에서 Gemini 모드를 켜지 않는다.

## 1. 선택한 모델

| 항목 | 값 |
|---|---|
| 모델 코드 | `gemini-3.5-flash` |
| 설정 위치 | [lib/server/ai/gemini.js](../lib/server/ai/gemini.js)의 `GEMINI_MODEL` (이 상수만 바꾸면 전체가 바뀐다) |
| 호출 방식 | Gemini REST API `v1beta` (`generateContent`, `streamGenerateContent?alt=sse`, `models.get`) |

### 선택 근거 (2026-09-29 Google 공식 문서 확인)

- [모델 목록](https://ai.google.dev/gemini-api/docs/models): `gemini-3.5-flash`는 **Stable**(안정) 모델로 표시되어 있다. Preview·Experimental이 아니다.
- [가격표](https://ai.google.dev/gemini-api/docs/pricing): `gemini-3.5-flash`의 **무료 등급(Free Tier)** 입력·출력이 "Free of charge"로 제공된다.
- [모델 상세](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash): 텍스트·이미지 입력, 구조화 출력(Structured outputs), 입력 1,048,576 토큰, 출력 65,536 토큰을 지원한다. 표지판 사진 읽기(이미지 입력)와 관련성 판정(구조화 출력)을 한 모델로 처리할 수 있다.
- 작업지시의 기본 후보가 품질 우선의 `gemini-3.5-flash`였고, 위 조건(안정 버전, 무료 등급 제공)을 모두 만족해 그대로 채택했다.

참고: 같은 문서에서 `gemini-3.5-flash`는 "legacy Flash model"로 소개되고, 더 새로운 안정 모델(`gemini-3.6-flash`, `gemini-3.7-flash`, `gemini-3.8-flash`)도 무료 등급으로 제공된다. 실제 학생 자료로 품질·속도·무료 한도를 비교한 뒤 `GEMINI_MODEL`만 바꿔 교체할 수 있다. 교체하면 이 절을 갱신한다.

### SDK 대신 REST를 쓰는 이유

모든 `pages/api/*` 라우트는 Edge runtime이다. 공식 `@google/genai` SDK가 Next.js 14.2 Edge 번들에서 문제없이 동작하는지 확실히 확인할 수 없었고, 새 의존성을 추가하지 않는다는 프로젝트 규칙도 있다. 그래서 `fetch`로 REST API를 직접 호출한다. Node 전용 API는 쓰지 않는다.

## 2. 구조

```
lib/aiProviderConfig.js      공급자 선택(AI_PROVIDER), 키 헤더 이름, 오류 code — 화면·서버 공용
lib/server/ai/provider.js    현재 공급자 선택과 공통 인터페이스, 요청 헤더에서 키 꺼내기
lib/server/ai/gemini.js      Gemini 요청·스트리밍·오류 분류 (GEMINI_MODEL)
lib/server/ai/openai.js      기존 OpenAI 구현 보존 (롤백용)
lib/server/ai/messages.js    OpenAI 형식 messages → Gemini contents/systemInstruction 변환
lib/server/ai/errors.js      공급자 오류 → 앱 공통 오류(code, HTTP 상태, 안내문)
lib/server/ai/safety.js      입력 검증(길이·형식·이미지 제한), 키 형식 검사, Gemini 안전 설정
lib/useAiKey.js              브라우저 키 보관 hook
lib/aiRequestGuard.js        브라우저 중복 요청 방지
components/AiKeySettingsDialog.js   키 설정 창
pages/api/verify-ai-key.js   '연결 확인' 전용 라우트
```

공통 인터페이스: `generateStream`, `generateOnce`, `generateStructured`, `analyzeImage`, `validateCredential`.

## 3. 키 발급과 입력 흐름

1. 사용자가 [Google AI Studio 키 발급 페이지](https://aistudio.google.com/apikey)에서 Gemini API 키를 만든다.
2. 첫 방문: 기존 사용법 6과정을 본다. 사용법이 끝나면(완료·나중에 보기·다시 보지 않기 모두) 키 설정 창이 열린다.
   - 마지막 과정에서 '자료조사 주의점'으로 가면, 그 안내를 닫은 뒤에 키 설정 창이 열린다.
3. 키를 붙여 넣고 **연결 확인**을 누르면 `/api/verify-ai-key`가 `models.get`으로 키를 확인한다. 답변 생성 요청은 보내지 않는다.
4. 확인에 성공한 경우에만 키를 저장한다. 실패하면 이유를 보여 주고 저장하지 않는다.
5. 키가 없으면 분석·모드 전환·퀴즈·평가·교과평어·챗봇·사진 글자 읽기를 시작하지 않고 키 설정 창을 연다. 입력한 조사 주제와 자료, 챗봇 입력은 그대로 남는다.
6. 키가 저장돼 있으면 다음 방문부터 키 설정 창을 건너뛴다.
7. 머리글의 **🔑 AI 키 설정** 버튼으로 언제든 키를 바꾸거나 지울 수 있다.
8. 사용법의 '다시 보지 않기'(`mnmAppUsageTutorialSeen`)와 키 저장(`mnmGeminiApiKey`)은 서로 다른 저장소 값으로 따로 관리된다.

오프라인 데모(`NEXT_PUBLIC_OFFLINE_DEMO_MODE=true`)는 API를 호출하지 않으므로 키를 요구하지 않는다.

## 4. 브라우저 저장 방식

| 선택 | 저장소 | 유지 기간 |
|---|---|---|
| 기본 | `sessionStorage['mnmGeminiApiKey']` | 이 탭(창)을 닫으면 사라짐 |
| '이 기기에 저장' 체크 | `localStorage['mnmGeminiApiKey']` | 삭제할 때까지 유지 |

- 앞뒤 공백을 지운 뒤 저장한다. 두 저장소 중 한 곳에만 둔다.
- 저장 뒤에는 끝 4자리만 화면에 보인다(`••••••••1234`). 입력칸의 표시·숨김 버튼은 입력 중인 값에만 적용된다.
- 키는 AI 요청마다 전용 헤더(`lib/aiProviderConfig.js`의 `AI_KEY_HEADER`)로만 보낸다. URL·query string·쿠키·콘솔·익명 산출물 전송에는 넣지 않는다.
- 서버는 요청을 처리하는 동안 지역 변수로만 키를 쓰고, 데이터베이스·파일·캐시·전역 변수에 저장하지 않는다. Google로 보낼 때도 URL이 아니라 `x-goog-api-key` 헤더를 쓴다.
- 서버 로그에는 분류된 오류 code와 HTTP 상태만 남긴다. 원본 오류 객체, 요청 본문, 이미지, 키는 기록하지 않는다.

### 공용 PC에서 키 삭제 방법

1. 머리글의 **🔑 AI 키 설정**을 누른다.
2. **키 삭제**를 누른다. `sessionStorage`와 `localStorage` 양쪽에서 지워진다.
3. '이 기기에 저장'을 쓰지 않았다면 브라우저 탭을 닫아도 지워진다.

## 5. Gemini를 호출하는 기능

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
| 키 연결 확인 | 연결 확인 | `/api/verify-ai-key` | `models.get` (생성 없음) | 1 |
| 추천 영상 | 분석 완료 | `/api/recommended-videos` | 호출 안 함 (YouTube API) | 0 |
| 사용법 6과정의 분석 체험 | 사용법 3과정 | 없음 | 호출 안 함 (미리 준비된 결과) | 0 |

### 무료 사용량 보호 장치

- 같은 요청이 진행 중이거나 성공 후 3초 안이면 다시 보내지 않는다(`lib/aiRequestGuard.js`). 실패한 요청은 바로 다시 보낼 수 있다.
- 분석 버튼은 같은 순간의 연속 클릭도 한 번만 처리한다. 챗봇은 답변을 기다리는 동안 새 질문을 보내지 않는다.
- 서버가 code로 분류한 오류(키, 할당량, 빈도 제한, 안전 차단, 서비스 장애)는 비스트리밍으로 다시 보내지 않는다. fallback은 SSE 차단·네트워크 끊김 같은 전송 문제에만 1회 쓴다.
- 스트리밍이 20자 이상 진행된 뒤 끊기면 다시 생성하지 않고 받은 곳까지로 끝낸다(중복 비용과 내용 변형 방지).
- `/api/chat`은 첫 조각을 받은 뒤에 SSE를 시작한다. 그래서 키·할당량 오류가 HTTP 상태로 전달되고 불필요한 fallback이 생기지 않는다.

## 6. 예상되는 오류와 안내

| code | HTTP | 원인 | 화면 안내(한국어) |
|---|---|---|---|
| `missing_key` | 401 | 키 없음 | 키 설정에서 먼저 키를 넣어 주세요 (+ 키 설정 창) |
| `invalid_key` | 401 | 잘못되었거나 차단된 키, 권한 없음 | 키 설정에서 키를 다시 확인해 주세요 (+ 키 설정 창) |
| `quota_exceeded` | 429 | 하루 무료 한도 소진(`PerDay` 할당량) | 오늘 무료 사용량을 모두 썼어요. 내일 다시 |
| `rate_limited` | 429 | 분당 요청·토큰 한도 초과 | 잠시 후 다시 시도해 주세요 |
| `unavailable` | 503 | Gemini 5xx, 모델 없음(404) | AI 서비스가 잠시 응답하지 않아요 |
| `safety_blocked` | 400 | 안전 필터 차단 | 학습 도우미가 다루기 어려운 내용이에요 |
| `network` | 502 | Gemini 연결 실패 | 인터넷 연결을 확인해 주세요 |
| `bad_response` | 502 | 빈 응답·JSON 형식 오류 | AI 응답을 읽지 못했어요 |
| `input_too_long` | 400 | 입력 25,000자 초과 | 조사자료를 짧게 줄여 주세요 |

- 무료 한도는 **API 키가 아니라 Google Cloud 프로젝트 단위**로 적용되고, 하루 한도는 **태평양 시간 자정**에 초기화된다(한국 시간 오후 4시 또는 5시).
- 정확한 RPM·TPM·RPD 수치는 공식 문서에 고정값으로 나오지 않고 AI Studio에서 확인해야 한다. 한 반이 같은 프로젝트의 키를 나눠 쓰면 한도를 함께 쓴다.
- 원본 오류 메시지, 요청 헤더, 키는 브라우저에 돌려주지 않는다.

## 7. 안전 설정

Gemini 2.5·3 계열은 안전 필터 기본값이 꺼져 있다. 초등학생 대상 서비스이므로 [lib/server/ai/safety.js](../lib/server/ai/safety.js)에서 괴롭힘, 혐오 발언, 성적 콘텐츠, 위험한 콘텐츠 네 범주를 `BLOCK_MEDIUM_AND_ABOVE`로 켠다. OpenAI 모드의 `omni-moderation` 입력 검사를 대신한다.

- 관련성 판정: 주제 핵심어 직접 질문은 로컬 규칙으로 허용하고, 이어지는 답변 요청이 안전 설정을 거친다.
- 스트리밍 도중 안전 차단: 이미 보낸 부분까지로 끝낸다(재요청하지 않음).

## 8. OpenAI로 롤백하는 방법

1. 빌드 환경에 `AI_PROVIDER=openai`와 `OPENAI_API_KEY`를 설정한다(로컬은 `.env.local`, 배포는 해당 Vercel 프로젝트 환경변수).
2. **다시 빌드**한다. `AI_PROVIDER`는 [next.config.js](../next.config.js)의 `env`로 빌드 시점에 화면과 서버에 함께 주입되므로 재빌드(로컬 dev는 재시작)가 필요하다.
3. OpenAI 모드에서는 키 설정 창과 머리글 버튼이 사라지고, 서버 키로 기존 OpenAI 구현([lib/server/ai/openai.js](../lib/server/ai/openai.js))을 쓴다. moderation 정책(chat fail-open, 관련성 판정 fail-closed)은 기존과 같다.
4. 로컬 확인: `AI_PROVIDER=openai npm run build && npx next start` 후 머리글에 키 설정 버튼이 없고 `/api/verify-ai-key`가 `{"ok":true,"provider":"openai"}`를 돌려주면 된다.

Gemini 모드에서는 `OPENAI_API_KEY`가 없어도 모듈 로드와 빌드가 실패하지 않는다(OpenAI 클라이언트는 첫 사용 때 만든다).

## Production 활성화 전 확인

### 차단 요건 — 해결 전에는 공개 사이트에서 켜지 않는다

1. **연령 요건 (Gemini API 추가 이용약관)**
   [Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms) (최종 수정 2026-04-28)에 다음 조항이 있다.
   > "You must be 18 years of age or older to use the APIs. You also will not use the Services as part of a website, application, or other service (collectively, "API Clients") that is directed towards or is likely to be accessed by individuals under the age of 18."

   뭐냐면은 초등학생이 주 사용자이므로, 지금 구조(학생이 AI Studio 키를 발급해 앱에 넣는 방식) 그대로는 이 조항과 충돌할 가능성이 높다. 활성화 전에 다음을 검토해야 한다.
   - Google Workspace for Education, Vertex AI 등 교육기관·미성년자 사용을 허용하는 다른 계약 조건이 있는지
   - 교사(성인)만 사용하는 구조로 바꿀 수 있는지
   - 학교·교육청의 외부 AI 서비스 이용 지침

2. **무료 등급 데이터 사용**
   같은 약관에 따르면 무료 서비스(Unpaid Services)의 입력과 출력은 Google 제품·기계학습 기술 개선에 사용되고, 사람이 검토할 수 있다. 약관은 무료 서비스에 "민감하거나 기밀이거나 개인적인 정보"를 보내지 말라고 명시한다. 학생이 입력하는 조사 자료, 챗봇 질문, 안내판 사진이 여기에 해당할 수 있으므로 개인정보 처리 방침과 학교 지침을 먼저 확인한다. 유료 등급에서는 개선에 사용하지 않는다고 되어 있다.

3. **지역 제한**
   약관상 EEA·스위스·영국 사용자에게는 유료 서비스만 제공해야 한다. 국내 학교 사용에는 직접 해당하지 않지만, 해외 접속 가능성이 있으면 확인한다.

### 운영 확인 항목

- [ ] 위 차단 요건에 대한 결정과 근거 문서
- [ ] 공개용 Vercel 프로젝트 `mnm-public`에서 `AI_PROVIDER` 값 결정(미설정 시 코드 기본값 `gemini`). 원본 `mnm` 프로젝트는 건드리지 않는다.
- [ ] Gemini 모드에서는 서버에 Gemini 키를 두지 않는다. 사용자 키를 Vercel 환경변수로 저장하지 않는다.
- [ ] Vercel 로그에 요청 헤더가 기록되지 않는지(로그 드레인·관측 도구 설정 포함) 확인
- [ ] 실제 무료 키 1개로 네 학습 모드, 쉬운한국어, 챗봇, 표지판 사진 읽기를 소량 수동 점검하고 출력 태그·쉬운한국어 규칙 준수 확인
- [ ] AI Studio에서 해당 프로젝트의 무료 한도(RPM·TPM·RPD) 확인 후 한 반 동시 사용 규모와 비교
- [ ] `lib/i18n.js`의 키 설정 창 번역(ko 외 11개 언어) 원어민 검수
