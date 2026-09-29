# CLAUDE.md

## 프로젝트 요약

이 프로젝트는 Next.js 기반 교육용 웹앱 「뭐냐면」입니다.

「뭐냐면」은 초등 사회과 조사학습과 박물관 학습에서 학생들이 접하는 어려운 조사자료, 전시 설명문, 안내문 등을 AI로 학생 수준에 맞게 재구성해주는 웹앱입니다.

이 앱은 단순 AI 챗봇이 아니라, 학생이 조사자료를 이해하고, 탐구 질문을 만들고, 발표로 표현하고, 자신의 학습을 성찰하도록 돕는 "깊이있는 학습 지원 AI 코스웨어"를 목표로 합니다. 교육용 SW·AI 연구대회 출품과 실제 학교 현장 활용을 목표로 합니다.

**이 파일이 단일 기준 문서다.** 루트의 `HARNESS.md`는 이전 버전 문서로, 이 파일과 내용이 다르면 이 파일이 우선한다.

## 핵심 교육 철학 (하드 룰)

**이해 → 탐구 → 표현 → 성찰**

- AI는 학생 대신 학습하지 않는다.
- AI는 학생이 생각하도록 돕는다.
- 새 기능은 이해·탐구·표현·성찰 중 하나 이상을 지원해야 한다.
- AI 결과물은 학생 사고의 발판이어야 하며, 학생의 최종 산출물을 대체해서는 안 된다.
- 학생이 직접 쓴 생각, 질문, 설명, 성찰이 AI 결과물보다 더 중요하다.
- 네 학습 모드(이해/탐구/발표 준비/글쓰기 준비)는 모두 scaffolding-first — AI가 완성물을 주지 않고 학생이 채우도록 구조를 준다.

## 기술 스택

- Next.js 14.1 **pages router** (app router 아님), React 18, **JavaScript** (TypeScript 아님)
- OpenAI SDK (`openai` v4). 채팅 모델은 [lib/server/chatApiShared.js](lib/server/chatApiShared.js)의 `MODEL` 상수 **한 곳에서만** 관리한다 (현재 `gpt-5.4-mini`). 모델 변경은 이 상수만 수정한다.
- **모든 `pages/api/*` 라우트는 Edge runtime이다.** Node 전용 API(`fs`, `path`, `Buffer` 등) 사용 금지.
- moderation은 `omni-moderation-latest`를 사용하며 chat 계열 라우트가 `chatApiShared.js`의 공통 정책을 공유한다.
- 스타일: `styles/globals.css` 전역 CSS + 일부 CSS Module. CSS 프레임워크 없음.
- 테스트: Playwright E2E만 있다. Vitest는 미설치 (향후 `lib/` 순수 로직 검증에 도입 예정).

## 코드 구조

```
pages/index.js                메인 화면 (입력 폼, 좌우 레이아웃, 상태 관리 — 약 1,600줄)
pages/share.js                학생 산출물 공유 아티팩트 페이지 (한국어 고정, 번역 불필요)
pages/offline-demo.js         오프라인 데모(USB 제출용) 진입 페이지
pages/api/chat.js             OpenAI 스트리밍 채팅 (Edge, SSE)
pages/api/chat-once.js        SSE 차단 환경용 비스트리밍 fallback (Edge)
pages/api/relevance.js        후속 질문 관련성 판단 (Edge)
pages/api/extract-sign-text.js  표지판/안내문 사진 텍스트 추출 (Edge)
pages/api/recommended-videos.js 승인 채널 내 YouTube 추천 영상 검색 (Edge)
lib/server/chatApiShared.js   MODEL 상수·입력 제한·moderation 공통화 (chat/chat-once 공유)
lib/systemPrompt.js           AI 시스템 프롬프트 생성
lib/parseResponse.js          AI 응답 파싱 (태그 기반)
lib/i18n.js                   다국어 UI 텍스트 + 언어별 프롬프트 지시문 (약 2,700줄, ko-easy 포함)
lib/useSessionSave.js         이전 조사 저장/불러오기 (localStorage)
lib/useStudentNotes.js        학생 메모 저장 (localStorage)
lib/approvedYoutubeChannels.js  교사 승인 YouTube 채널 화이트리스트
lib/recommendedSources.js     추천 원본자료 데이터 (JSX 외부 분리)
lib/modeWorksheetFields.js    모드별 생각 워크시트 활동 필드 정의
lib/demoSnapshot.js           오프라인 데모 스냅샷 로딩
lib/submissionMeta.js         제출 패키지 메타데이터 ({{PLACEHOLDER}} 치환용)
components/                   프레젠테이션 컴포넌트 (SectionCard, ResultCanvas, QuizCard 등)
scripts/build-submission-package.js  연구대회 USB 제출 패키지 생성
scripts/resolve-youtube-channel-ids.js  승인 채널 channelId 조회
tests/                        Playwright E2E 테스트 (spec 15개)
submission-template/          제출 패키지 템플릿
submission-demo/              데모 스냅샷 (local.json은 gitignore 대상)
```

## 실행 모드 3종

같은 코드베이스가 환경변수에 따라 세 가지로 동작한다. 기능 수정 시 세 모드 모두에서 깨지지 않는지 생각해야 한다.

1. **온라인 (기본)** — OpenAI·YouTube API를 실제 호출. `npm run dev` / Vercel 배포.
2. **오프라인 데모** — `NEXT_PUBLIC_OFFLINE_DEMO_MODE=true`. 정적 export(`output: 'export'`, `distDir: '.next-offline'`)로 `file://`에서 열린다. API를 일절 호출하지 않고 `submission-demo/` 스냅샷만 사용한다.
3. **심사 제출** — `NEXT_PUBLIC_SUBMISSION_MODE`로 제어. `npm run build:submission`이 오프라인 데모를 포함한 USB 패키지를 `dist-submission/`에 생성한다.

환경변수 (`.env.local`, 코드에 직접 넣지 않는다):

- `OPENAI_API_KEY` — 필수
- `YOUTUBE_API_KEY` — 추천 영상 기능용, 선택
- `NEXT_PUBLIC_OFFLINE_DEMO_MODE`, `NEXT_PUBLIC_SUBMISSION_MODE` — 빌드 스크립트가 설정

## 명령어

- `npm run dev` — 개발 서버 (localhost:3000)
- `npm run test:e2e` — Playwright E2E 전체 실행
- `npx playwright test tests/<파일명>` — 개별 spec 실행
- `npm run build:offline-demo` — 오프라인 데모 정적 빌드
- `npm run build:submission` — 제출 패키지 생성 (금지어 검사 포함)
- `npm run youtube:channels` — 승인 채널 channelId 후보 조회

## 코드 작성 관례

- 코드 주석, UI 문자열, 커밋 외 문서는 **한국어**로 쓴다. 주석은 "무엇"보다 "왜"를 적는다 (기존 코드 참고).
- 새 UI는 `components/`에 컴포넌트로 분리한다. `pages/index.js`에 기능을 계속 쌓지 않는다.
- 프롬프트 관련 코드는 `lib/systemPrompt.js`, 응답 파싱은 `lib/parseResponse.js`, UI 문자열·언어별 지시문은 `lib/i18n.js`에서 관리한다.
- 외부 링크·교육자료 데이터는 JSX에 직접 박지 말고 별도 데이터 파일로 분리한다 (`lib/recommendedSources.js` 참고).
- 기존 기능을 깨지 않도록 최소 침습적으로 수정한다. 요청받지 않은 리팩토링을 끼워 넣지 않는다.
- 불필요한 라이브러리를 추가하지 않는다. 새 의존성은 사전에 필요성을 설명하고 확인받는다.
- 쉬운한국어(ko-easy) 관련 로직은 다른 모드와 충돌하지 않도록 독립성을 유지한다.

## 학습 모드별 설계 원칙

### 이해 모드
- 어려운 자료를 학생 수준에 맞게 이해하도록 돕는다. 쉬운 설명, 낱말 풀이, 핵심 내용 정리에 초점.
- 원문의 의미를 왜곡하지 않는다.

### 탐구 모드
- 정답 찾기보다 질문 만들기와 사고 확장에 초점. 탐구 질문은 개방성·토론 가능성·전이 가능성을 가져야 한다.
- AI가 탐구를 대신 끝내지 않고 학생이 더 조사하도록 돕는다.

### 발표 준비 모드
- 발표 제목, 발표 구조, 예상 질문, 핵심 메시지를 지원한다.
- 발표문을 대신 완성해주지 않는다. 학생이 자기 말로 발표하도록 유도한다.

### 글쓰기 준비 모드
- 개요(outline)와 체크리스트로 학생의 글쓰기를 돕는다. 글을 대신 써주지 않는다.

### 쉬운한국어 모드 (하드 룰)

쉬운한국어는 [lib/i18n.js](lib/i18n.js)의 `ko-easy` 언어 옵션으로 구현된 **핵심 보호 기능**이다. 한국어 사용 수준이 낮은 다문화 학습자, KSL 초기 학습자를 위한 모드로, 단순 요약이 아니라 **원문의 의미를 유지하면서 언어 난도를 크게 낮추는 기능**이다.

반드시 지켜야 할 원칙:

- 한 문장에는 한 가지 정보만 담는다.
- 문장은 가능하면 30자 이내로 짧게 작성한다.
- 쉬운 낱말을 사용한다. 어려운 한자어와 추상어를 줄인다.
- 어려운 낱말은 바로 풀어서 설명한다.
- 수동 표현보다 능동 표현을 사용한다.
- 대명사 사용을 줄이고, 핵심어를 반복해도 좋다.
- "~해요", "~예요" 문체를 사용한다.
- 의미를 삭제하거나 왜곡하지 않고, 난도만 낮춘다.
- 어린아이 말투로 과도하게 단순화하지 않는다.
- 역사적·사회적 사실을 틀리게 바꾸지 않는다.
- 쉬운한국어 모드를 단순 요약 기능으로 축소하지 않는다.
- 낱말 풀이 대상 용어는 쉬운 재작성 문장 안에 **원형 그대로** 남긴다 (인라인 낱말 클릭 기능이 문자열 매칭에 의존한다).

## UI/UX 원칙

- 주 사용 환경은 **1920×1080 PC/교실 환경**이다. 모바일은 보조 지원 (결과 캔버스가 풀스크린 오버레이로 전환).
- 카드형 UI를 유지한다. `SectionCard`와 기존 컴포넌트 구조를 존중한다.
- 전자칠판/교실 PC에서 보이도록 가독성을 확보한다. 초등학생과 교사가 직관적으로 쓸 수 있어야 한다.
- 새 기능은 기존 학습 흐름을 방해하지 않아야 한다. 사이드 패널은 PC에서 본문을 가리지 않고, 모바일에서는 접이식으로 한다.

## 테스트 원칙과 관례

- Playwright는 실제 사용자 흐름 검증용. 기본 viewport 1920×1080 단일 project (`chromium-desktop-1920`). 모바일 테스트는 spec 파일에서 `test.use()`로 개별 오버라이드한다.
- **실제 OpenAI API를 테스트에서 호출하지 않는다.** `page.route('**/api/chat', ...)` mock을 사용한다 ([tests/smoke.spec.js](tests/smoke.spec.js) 참고).
- **playwright.config.js가 `storageState`로 `mnmHistoryResearchTutorialSeen=true`를 기본 주입한다.** 첫 방문 튜토리얼 모달이 클릭을 가로채지 않게 하기 위함이다. 첫 방문 동작 자체를 검증하려면 [tests/research-onboarding.spec.js](tests/research-onboarding.spec.js)처럼 storageState를 비워 오버라이드한다.
- 새 기능에는 관련 테스트를 추가하거나 기존 테스트 영향 여부를 확인한다.
- 외부 링크에는 `target="_blank"`와 `rel="noopener noreferrer"`, 유효한 `href`가 있어야 한다. 빈 링크(`#`) 금지.

## 작업 절차

1. 작업 목표 재진술
2. 구현 계획 설명
3. 영향받는 파일 목록 설명
4. 코드 수정
5. 테스트 실행 또는 테스트 불가 사유 설명
6. 변경사항 요약
7. commit/push 제안

추가 원칙:

- 큰 구조 변경은 바로 수정하지 말고 먼저 계획을 설명하고 확인을 요청한다.
- 기존 기능 제거나 UI 대폭 변경은 반드시 사전 확인을 받는다.
- 테스트가 실패하면 원인을 설명하고 수정한다. 실행할 수 없으면 이유를 설명한다.

## 실행 규율 (모델 공통)

어떤 모델이 작업하든 아래를 지킨다:

- 수정 전에 대상 파일을 실제로 읽는다. 기억이나 추측으로 코드를 쓰지 않는다.
- 요청 범위 밖의 코드를 바꾸지 않는다. diff는 목표 달성에 필요한 최소로 유지한다.
- 작업지시서에 "하지 마라" 항목이 있으면 구현 후 `git diff`로 위반 0건을 자기검사한다.
- 확실하지 않은 관례는 지어내지 말고 기존 코드에서 같은 패턴을 찾아 따른다 (예: `SectionCard` 사용법, i18n 키 구조).
- UI 문자열을 추가하면 [lib/i18n.js](lib/i18n.js)의 12개 언어 + ko-easy 전부에 추가한다. 한 언어만 추가하고 끝내지 않는다.
- 테스트를 실행하지 않았으면 "완료"라고 말하지 않는다. 실패는 실패라고 정직하게 보고한다.
- 에러가 나면 임의로 우회하지 말고 원인을 찾는다. 같은 명령 단순 재시도는 1회까지.
- 반복 작업은 `.claude/skills/`의 스킬을 따른다: `ship`(커밋·푸시), `spec`(작업지시서 실행), `submission-check`(제출 패키지 검증), `protect`(회귀 점검).

## 완료의 정의

commit을 제안하기 전에 아래를 모두 통과해야 한다:

1. **변경 영향을 받는 spec + `tests/smoke.spec.js`** 를 실행해 통과. 구조 변경이나 공용 파일(`parseResponse.js`, `systemPrompt.js`, `i18n.js`, `chatApiShared.js`, `index.js` 레이아웃) 수정 시에는 `npm run test:e2e` **전체** 실행.
2. 보호 기능 목록(아래)의 기능이 깨지지 않았는지 확인.
3. API 키·민감정보가 diff에 없는지 확인.
4. 오프라인 데모/제출 모드에 영향 주는 변경이면 해당 모드 동작도 확인 (`tests/offline-demo.spec.js`).
5. 테스트 통과 전에는 commit/push를 제안하지 않는다.

## Git 원칙

- 커밋 메시지는 **영어 명령형 한 줄**로, 변경의 의도가 드러나게 쓴다. prefix(`feat:` 등)는 쓰지 않는다.
  - 좋은 예: `Restrict YouTube recommendations to approved channels`, `Add non-streaming fallback for blocked SSE responses`
  - 나쁜 예: `update`, `fix`, `수정`
- 큰 기능은 새 브랜치에서 작업한다. 작업 전 `git status`를 확인한다.
- commit과 push는 사용자의 확인 후 진행한다.

## 절대 금지 사항

- 학생 대신 탐구보고서·수행평가 산출물을 완성해주는 기능
- 정답만 제공하고 사고를 요구하지 않는 기능
- 기존 기능을 이유 없이 삭제하는 수정
- UI 전체를 사용자 동의 없이 갈아엎는 수정
- 테스트 없이 큰 변경을 push하는 작업
- API 키나 민감정보를 코드에 직접 넣는 작업
- 쉬운한국어 모드에서 원문의 사실을 왜곡하거나, 단순 요약 기능으로 축소하는 수정
- 실제 OpenAI API를 테스트에서 반복 호출하는 구조
- 승인 채널 화이트리스트 밖의 YouTube 영상을 추천에 노출하는 수정

## 연구대회 제출 제약

- 제출 산출물(`dist-submission/`)에 시도명/학교명/출품자명이 들어가면 안 된다. `build:submission` 스크립트가 금지어를 검사한다.
- `submission-demo/demo-snapshot.local.json`은 실제 사용 데이터라 gitignore 대상이다. 커밋하지 않는다.
- YouTube 썸네일 이미지·영상 파일·음원·자막을 snapshot이나 제출물에 저장하지 않는다. `videoId`와 원본 링크만 저장하고, 임베드는 `youtube-nocookie` + 자동재생 없음으로만 한다.
- 오프라인 실행 환경에서는 YouTube API를 호출하지 않는다.

## 보호 기능 목록

다음 기능은 향후 수정에서 깨지지 않아야 한다:

- 이해 / 탐구 / 발표 준비 / 글쓰기 준비 모드
- 쉬운한국어 모드 (ko-easy)
- 다국어 지원 (12개 언어, [lib/i18n.js](lib/i18n.js))
- 후속 질문 채팅 (플로팅 마스코트 챗봇, SSE + 비스트리밍 fallback)
- 생각 워크시트 (모드별 학생 활동 입력)
- 퀴즈 생성 및 선택지 클릭
- 학습 평가 (나 어땠어?) / 교과평어 생성
- 결과 복사 / 학생 산출물 공유 아티팩트 페이지 (share.js)
- 이전 조사 불러오기·삭제, 학생 메모 (localStorage)
- 추천 원본자료 배너 / 승인 채널 기반 추천 영상
- 표지판·안내문 사진 텍스트 읽기 (SignTextReader)
- 리서치 컴퍼스 / 첫 방문 튜토리얼 퀘스트
- 오프라인 데모 및 제출 패키지 빌드 흐름
- 응답 파싱 로직 ([lib/parseResponse.js](lib/parseResponse.js)) / 프롬프트 생성 로직 ([lib/systemPrompt.js](lib/systemPrompt.js))
- 1920×1080 PC 좌우 2단 레이아웃 / 모바일 풀스크린 오버레이 레이아웃
