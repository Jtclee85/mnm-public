# Codex · Claude Code 공용 하네스

이 문서는 VS Code에서 Codex와 Claude Code를 번갈아 사용할 때 작업 맥락과 저장소 상태를 안전하게 이어가기 위한 공통 절차다. 두 에이전트 모두 작업을 시작하기 전에 이 문서와 `CLAUDE.md`, `WORKING_RULES.md`를 읽는다.

## 저장소 경계

- 이 저장소는 공개용 `Jtclee85/mnm-public`이다.
- 원본 심사본 `Jtclee85/mnm`과 `/Users/jinbok/project/mnm`은 조회만 가능하다.
- 원본 저장소에 커밋, 푸시, 브랜치 변경, 파일 수정 또는 병합을 하지 않는다.
- 원본 Vercel 프로젝트 `mnm`, 도메인 `mnm-kappa.vercel.app`, 환경변수와 배포 설정을 변경하지 않는다.
- 공개용 배포는 Vercel 프로젝트 `mnm-public`, 도메인 `mnm-public.vercel.app`만 사용한다.
- 공개용 비밀값은 새 Vercel 프로젝트에만 저장한다. `.env*`, API 키, 토큰은 Git에 넣지 않는다.

## 세션 시작 순서

1. `CLAUDE.md`, `HARNESS.md`, `WORKING_RULES.md`를 읽는다.
2. `git status --short`, 현재 브랜치, `git log -5 --oneline`, `git remote -v`를 확인한다.
3. `git status`에 있는 기존 변경을 사용자 또는 이전 에이전트의 작업으로 간주한다. 출처가 확실하지 않은 변경은 수정·삭제·스테이징하지 않는다.
4. 아래 **현재 작업 인수인계**를 읽고, 이미 끝난 일을 반복하지 않는다.
5. 요청 범위와 수정할 파일을 짧게 밝힌 뒤 작업한다.

## 작업 중 규칙

- 한 번에 한 에이전트만 쓰기 작업을 한다. 다른 에이전트를 열기 전 현재 에이전트의 명령과 테스트가 끝났는지 확인한다.
- 작업 시작 시 아래 인수인계의 `상태`를 `진행 중`으로 바꾸고 담당 에이전트, 목표, 예상 파일을 적는다.
- 다른 에이전트가 `진행 중`으로 표시한 파일은 건드리지 않는다. 꼭 겹치면 먼저 변경 내용을 읽고 사용자에게 충돌 가능성을 알린다.
- 요구사항과 직접 관계없는 리팩터링, 정리, 의존성 업데이트를 섞지 않는다.
- 외부 서비스 변경은 공개용 GitHub 저장소와 공개용 Vercel 프로젝트로 범위를 제한한다.
- 키 값은 터미널, 로그, 채팅, 커밋, 테스트 결과에 출력하지 않는다. 존재 여부와 변수명만 확인한다.

## 작업 종료 순서

1. 관련 테스트와 `tests/smoke.spec.js`를 실행한다. 공용 핵심 파일을 바꿨다면 `CLAUDE.md`의 전체 테스트 기준을 따른다.
2. `git diff --check`, `git status --short`, 비밀값 검사를 실행한다.
3. 아래 인수인계를 실제 상태로 갱신한다. 미완료 항목과 다음 명령을 구체적으로 남긴다.
4. 커밋에는 이번 작업 파일만 포함한다. 커밋 메시지는 영어 명령형 한 줄을 쓴다.
5. 푸시 후 원격 커밋과 배포 상태를 확인한다. 푸시하지 않았다면 그 이유와 로컬 커밋 여부를 기록한다.

## 에이전트 교대 방법

다음 에이전트에게 긴 대화 내용을 복사할 필요는 없다. 새 세션에서 아래처럼 요청한다.

> 이 저장소의 `CLAUDE.md`, `HARNESS.md`, `WORKING_RULES.md`와 현재 git 상태를 먼저 읽고, `HARNESS.md`의 현재 작업 인수인계부터 이어서 작업해.

에이전트는 채팅의 주장보다 Git 상태, 테스트 결과, 배포 API 응답을 우선해 현재 상태를 판단한다.

## 현재 작업 인수인계

- 상태: 완료 — 사용자 승인으로 교사용 Gemini/OpenAI 선택 변경을 `gemini-provider` 브랜치에 커밋·푸시. main 병합·Production 배포·Vercel 설정 변경은 하지 않음.
- 마지막 담당: Codex
- 기준 브랜치: `main` (Production은 여전히 OpenAI 버전 `b527fd9`)
- 마지막 완료 작업: `/teacher`에서 Gemini/OpenAI 선택 → 해당 공급자 키 연결 확인 → 학급 코드 생성. 키는 공급자별 브라우저 저장소로 분리하고, 암호화된 학급 레코드에 공급자를 함께 저장. 네 AI 라우트가 학급의 공급자·교사 키를 사용하며 학생 공급자 헤더는 무시. 기존 학급은 Gemini로 호환. 키 교체 시 공급자도 함께 변경 가능. OpenAI 클라이언트는 요청마다 생성하고 자동 재시도 없음. 잔액 부족은 `billing_required`로 구분(학생 12개 언어 안내 포함).
- 보류된 약관 검토: 사용자 결정(2026-09-30)으로 교사 개인 테스트 단계에서는 Gemini 연령 요건·무료 등급 데이터 사용 문제를 나중에 해결한다. 학생 대상 공개 운영 전 반드시 재검토(`docs/GEMINI_OPERATIONS.md` 마지막 절).
- 공개 URL: `https://mnm-public.vercel.app`
- 보호 대상: 원본 `Jtclee85/mnm`, 원본 Vercel 프로젝트 `mnm`
- 알려진 설정: 공개용 `OPENAI_API_KEY`와 `YOUTUBE_API_KEY`가 Vercel Production에 저장됨. `YOUTUBE_API_KEY`는 원본 심사본과 **같은 키**라 YouTube 일일 할당량을 공유한다. `AI_PROVIDER`·Upstash·`CLASS_KEY_SECRET`은 Vercel에 아직 없음 — 이 브랜치를 그대로 배포하면 코드 기본값 `gemini`가 되고 저장소가 없어 학급 기능이 `class_unavailable`로 동작하지 않는다. 기존 동작을 유지하려면 배포 전에 `AI_PROVIDER=openai`를 설정해야 한다. Preview 배포는 Vercel 로그인 보호가 걸려 있어 외부 검증에 쓸 수 없다.
- 검증 상태 (2026-10-31): 전체 Playwright 191 통과 / 실패 0 / 11 skip. 서버 단위 39개 별도 통과. `npm run build`와 `npm run build:offline-demo` 성공(오프라인 뒤 일반 빌드 복원). 실제 외부 AI·Upstash 대신 mock 사용. 비밀값 검사와 `git diff --check` 통과.
- 주의: `npm run build:offline-demo` 뒤에는 `.next/required-server-files.json`이 덮어써지므로, `next start`로 확인하려면 일반 빌드를 다시 한다. 테스트 첫 실행 때 개발 서버가 `/teacher`를 컴파일하느라 느릴 수 있어 `tests/class-code.spec.js`에 미리 부르는 `beforeAll`이 있다.
- 오프라인 테스트 수정: `tests/offline-demo.spec.js`가 `loadDemoSnapshot()`으로 앱과 동일한 스냅샷을 읽어 주제·원문·영상·대화를 확인하도록 변경. 공개본에 없는 개인 고인돌 스냅샷을 가정하던 기존 실패 2개 해소. 실제 개인 데이터나 앱 동작은 바꾸지 않음.
- 알려진 빌드 경고: Edge 라우트에서 `openai/core.mjs`의 `process.version/platform/arch` 사용 경고. 실제 Edge 실행은 정상 확인됨.
- 남은 보안 경고: `npm audit` 2건(next critical, postcss high). next 관련 권고는 34건에서 23건으로 감소. 남은 권고는 주로 App Router, Server Components/Actions, 미들웨어, rewrites, 자체 호스팅 이미지 최적화 대상이며 이 앱(Pages Router, 미들웨어·rewrites 없음, Vercel 호스팅)과 직접 관련이 적다. 완전 해결은 `next@16`(주 버전 2단계 상승, React 19 필요 가능성) 업그레이드가 필요하므로 사용자 확인 후 별도 브랜치에서 진행한다.
- 남은 확인: 학급 코드 창 번역(ko 외 11개 언어) 원어민 검수, 실제 교사 키로 `/teacher`에서 코드를 만들고 학생 기기에서 네 모드·쉬운한국어·챗봇·사진 읽기 소량 수동 점검.
- 다음 에이전트 시작점: `gemini-provider` 브랜치의 커밋·원격 상태를 확인한다. 기존 사용자 파일인 미추적 `.agents/`는 수정·스테이징하지 않는다. 실제 교사 키 품질 점검과 Upstash 연결은 아직 안 함. 사용자 승인 없이 main 병합·Production 활성화·Vercel 환경변수 변경 금지.

작업을 마칠 때 위 항목을 덮어써서 최신 상태만 유지한다. 과거 이력이 필요하면 Git 로그를 사용한다.
