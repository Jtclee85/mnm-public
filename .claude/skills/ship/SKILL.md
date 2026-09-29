---
name: ship
description: 변경사항을 검증한 뒤 커밋·푸시한다. 사용자가 "커밋", "푸시", "커밋푸시", "ㄱㄱ", "올려" 등으로 요청하면 이 스킬을 따른다.
---

# ship — 검증 후 커밋·푸시

## 트리거
- "커밋 푸시", "커밋푸시해", "ㄱㄱ", "푸시해" 등 커밋/푸시 요청 전부.

## 입력
- 현재 워킹 트리의 변경사항. 별도 입력 불필요.

## 단계

1. `git status`와 `git diff`로 변경 파일을 확인한다. 아래가 스테이징 대상에 있으면 **제외하고 사용자에게 알린다**:
   - `.env*`, API 키·토큰이 포함된 파일
   - `submission-demo/demo-snapshot.local.json`
   - `dist-submission/`, `.next*/`, `test-results/`
2. CLAUDE.md "완료의 정의" 게이트를 실행한다:
   - 변경 영향을 받는 spec + `tests/smoke.spec.js`
   - 공용 파일(`parseResponse.js`, `systemPrompt.js`, `i18n.js`, `chatApiShared.js`, `index.js` 레이아웃) 수정 시 `npm run test:e2e` 전체
   - 오프라인/제출 모드 영향 시 `tests/offline-demo.spec.js` 추가
3. 테스트 실패 시: **커밋하지 않는다.** 원인을 보고하고 수정 후 재실행한다.
4. diff에서 시도명/학교명/출품자명·API 키가 없는지 최종 확인한다.
5. 커밋 메시지는 **영어 명령형 한 줄, prefix 없음** (예: `Restrict YouTube recommendations to approved channels`).
6. `main`에 푸시한다 (사용자가 브랜치를 지정했으면 그 브랜치).

## 출력
- 실행한 테스트와 결과, 커밋 해시와 메시지, 푸시 결과를 3줄 이내로 보고한다.
- 이미 이 대화에서 같은 변경에 대해 게이트를 통과했다면 테스트를 중복 실행하지 않고 그 사실만 명시한다.
