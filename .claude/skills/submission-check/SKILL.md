---
name: submission-check
description: 연구대회 제출 패키지를 빌드하고 제출 제약을 전수 검증한다. 제출/심사/오프라인 데모/USB 관련 작업 후, 또는 제출 전 최종 점검 요청 시 사용한다.
---

# submission-check — 제출 패키지 빌드·검증

## 트리거
- "제출 패키지 만들어/확인해", "심사용 점검", "오프라인 데모 확인", 제출 관련 코드 수정 직후.

## 입력
- 없음. 현재 코드베이스 기준으로 실행한다.

## 단계

1. `npm run build:offline-demo` — 정적 export가 성공하는지 확인한다.
2. `npm run build:submission` — 패키지 생성과 내장 금지어 검사가 통과하는지 확인한다.
3. `npx playwright test tests/offline-demo.spec.js` 실행.
4. `dist-submission/` 산출물 전수 검사:
   - 시도명/학교명/출품자명 문자열 grep — 스크립트 검사와 별개로 이중 확인
   - 이미지·영상·음원·자막 파일이 포함되지 않았는지 (YouTube 썸네일 포함 금지)
   - snapshot JSON에 `thumbnailUrl` 키가 없는지
   - YouTube 임베드가 `youtube-nocookie` + 자동재생 없음인지
5. git 검사:
   - `submission-demo/demo-snapshot.local.json`이 추적되고 있지 않은지 (`git ls-files`)
   - `dist-submission/`이 커밋 대상에 없는지
6. 오프라인 동작 원칙 확인: 오프라인 코드 경로에서 OpenAI/YouTube API 호출이 없는지 (`NEXT_PUBLIC_OFFLINE_DEMO_MODE` 분기 확인).

## 출력
- 항목별 통과/실패 체크리스트. 실패 항목은 원인 파일과 수정 제안을 함께 보고한다.
- 전부 통과 시에만 "제출 가능" 판정을 내린다.
