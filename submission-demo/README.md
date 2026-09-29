# 오프라인 데모 snapshot 준비

심사용 오프라인 데모는 실제 React/Next 앱 UI를 그대로 정적 export하고, 아래 snapshot을 초기 데이터로 주입한다.

1. 실제 앱에서 조사자료와 워크시트를 원하는 상태로 완성한다.
2. 크롬 개발자도구 Console에서 `mnm-sessions`, `mnm-student-notes`를 읽어 현재 세션 JSON을 만든다.
3. 결과 JSON을 `submission-demo/demo-snapshot.local.json`으로 저장한다.
4. 시도명, 학교명, 출품자명, 계정명, API key 등 금지 정보가 들어 있지 않은지 확인한다.
5. `npm run build:submission`을 실행한다.
6. 생성된 `dist-submission/` 폴더를 USB에 복사한다.

`demo-snapshot.local.json`은 실제 수업 데이터가 들어갈 수 있으므로 GitHub에 커밋하지 않는다.
레포에는 구조 예시인 `demo-snapshot.example.json`만 포함한다.
