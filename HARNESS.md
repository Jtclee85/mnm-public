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

- 상태: 완료
- 마지막 담당: Claude Code
- 기준 브랜치: `main` (작업 브랜치 `security-deps-update`는 main에 fast-forward 병합됨)
- 마지막 완료 작업: npm 보안 경고 대응. 패치 버전 의존성 갱신(form-data, nanoid, mdast-util-to-hast, sharp)과 Next.js 14.1.0 → 14.2.35 업그레이드. 이 변경은 공개본에만 적용했고 원본 `mnm`은 14.1.0 그대로 둠.
- 공개 URL: `https://mnm-public.vercel.app`
- 보호 대상: 원본 `Jtclee85/mnm`, 원본 Vercel 프로젝트 `mnm`
- 알려진 설정: 공개용 `OPENAI_API_KEY`와 `YOUTUBE_API_KEY`가 Vercel Production에 저장됨. `YOUTUBE_API_KEY`는 원본 심사본과 **같은 키**라 YouTube 일일 할당량을 공유한다. Preview 배포는 Vercel 로그인 보호가 걸려 있고 API 키도 없어 외부 API 검증에 쓸 수 없다.
- 검증 상태 (2026-09-29): 전체 E2E 123 통과 / 2 실패 / 11 skip, `npm run build`와 `npm run build:offline-demo` 성공. 프로덕션 배포 후 `/`, `/share` 200, `/api/chat` SSE 스트리밍, `/api/chat-once`, `/api/recommended-videos` 실제 응답 확인(각 1회 호출).
- 알려진 실패 (의존성 변경과 무관, 기존부터 존재): `tests/offline-demo.spec.js`의 `[demo-reviewer-guide]`, `[demo-starts-on-input-screen]` 2개. 테스트가 원본에만 있는 gitignore 파일 `submission-demo/demo-snapshot.local.json`(주제 "강화 고인돌")을 가정하지만, 공개본에는 없어 `demo-snapshot.example.json`(성덕대왕신종)이 쓰인다. 실제 사용 데이터이므로 복사하지 않는다. 수정하려면 테스트가 스냅샷 주제를 파일에서 읽게 바꿔야 한다.
- 알려진 빌드 경고: Edge 라우트에서 `openai/core.mjs`의 `process.version/platform/arch` 사용 경고. 실제 Edge 실행은 정상 확인됨.
- 남은 보안 경고: `npm audit` 2건(next critical, postcss high). next 관련 권고는 34건에서 23건으로 감소. 남은 권고는 주로 App Router, Server Components/Actions, 미들웨어, rewrites, 자체 호스팅 이미지 최적화 대상이며 이 앱(Pages Router, 미들웨어·rewrites 없음, Vercel 호스팅)과 직접 관련이 적다. 완전 해결은 `next@16`(주 버전 2단계 상승, React 19 필요 가능성) 업그레이드가 필요하므로 사용자 확인 후 별도 브랜치에서 진행한다.
- 다음 에이전트 시작점: 사용자 요청을 확인한다. Next 16 업그레이드 요청 시 공식 마이그레이션 가이드와 React 버전 요구사항부터 확인한다.

작업을 마칠 때 위 항목을 덮어써서 최신 상태만 유지한다. 과거 이력이 필요하면 Git 로그를 사용한다.
