# 익명 학습산출물 수집 설정

이 기능은 학생이 **학습 산출물 공유하기**를 누른 경우에만 학생 작성 필드를 Google Apps Script로 보냅니다. 회원가입, 이름·학번·학교명, IP 저장 필드, 브라우저 fingerprint, AI 답변 전문은 사용하지 않습니다. 기존 공유 링크 생성은 수집 성공 여부와 독립적으로 동작합니다.

## 1. Google Sheet 준비

1. 새 Google Sheet를 만듭니다.
2. 저장할 탭 이름을 정합니다. 예: `artifacts`
3. Sheet URL의 `/d/`와 `/edit` 사이 문자열을 Sheet ID로 기록합니다.
4. 첫 행은 비워 두어도 됩니다. 첫 요청 때 Apps Script가 정해진 헤더를 만들고 고정합니다.
   - 시트의 열 제목은 연구자가 바로 읽을 수 있도록 한국어로 생성됩니다.
   - 이전 코드로 만든 영문 헤더는 새 코드 배포 후 첫 저장 요청 때 한국어로 자동 변경되며, 기존 데이터 행은 유지됩니다.
   - 현재 UI에서 더 이상 제공하지 않는 옛 `자료에서 증거 찾기` 5개 필드는 새 요청에서 수집하지 않습니다. 기존 시트에 값이 있으면 보관 열로 표시하고, 값이 없으면 해당 헤더를 자동으로 비웁니다.

## 2. Apps Script 연결

1. Sheet에서 **확장 프로그램 → Apps Script**를 엽니다.
2. [learning-artifact-collector.gs](../scripts/google-apps-script/learning-artifact-collector.gs)의 전체 코드를 붙여 넣습니다.
3. Apps Script의 **프로젝트 설정 → 스크립트 속성**에 아래 세 값을 추가합니다.
   - `SHEET_ID`: 1단계에서 확인한 Sheet ID
   - `SHEET_NAME`: 저장할 탭 이름
   - `ARTIFACT_APP_ID`: 공개 앱 식별값. 예: `mnm-web`
4. 개인 계정 정보나 API 비밀값은 코드에 넣지 않습니다. `ARTIFACT_APP_ID`는 브라우저에 노출되는 구분값이며 비밀키가 아닙니다.

## 3. 웹 앱 배포

1. Apps Script에서 **배포 → 새 배포 → 웹 앱**을 선택합니다.
2. 실행 사용자는 **나**, 액세스 권한은 학생이 로그인하지 않아도 POST할 수 있는 범위로 설정합니다.
3. 배포하고 권한을 승인한 뒤 `/exec`로 끝나는 웹 앱 URL을 복사합니다.
4. 코드를 고친 경우 새 버전으로 다시 배포합니다. 테스트용 `/dev` URL은 운영 앱에 넣지 않습니다.
5. 브라우저에서 웹 앱 URL을 GET으로 열면 `{ "ok": false, "error": "method_not_allowed" }`만 반환하며 데이터는 노출되지 않습니다.

## 4. Next.js 환경 변수

로컬 `.env.local` 또는 배포 환경에 다음 값을 설정하고 앱을 다시 빌드합니다.

```dotenv
NEXT_PUBLIC_ARTIFACT_ENDPOINT=https://script.google.com/macros/s/배포_ID/exec
NEXT_PUBLIC_ARTIFACT_APP_ID=mnm-web
```

`NEXT_PUBLIC_ARTIFACT_APP_ID`는 Apps Script의 `ARTIFACT_APP_ID`와 같아야 합니다. `NEXT_PUBLIC_ARTIFACT_ENDPOINT`가 비어 있거나 유효한 HTTPS URL이 아니면 수집 요청은 생략되고 기존 공유 기능만 동작합니다.

## 5. 동작 확인

1. 시크릿 창에서 온라인 앱을 열고 개발자 도구의 Application → Local Storage에서 `mw_anonymous_id`가 UUID인지 확인합니다.
2. 네 모드 중 필요한 학생 입력을 작성한 뒤 **학습 산출물 공유하기**를 누릅니다.
3. 기존 공유 링크가 복사되고 공유 페이지가 열리는지 확인합니다.
4. Sheet에 한 행이 추가되었는지 확인합니다.
5. 같은 내용을 다시 공유해 행이 늘지 않는지 확인합니다.
6. 학생 입력 하나를 수정해 다시 공유하면 새 `artifact_id`로 한 행이 추가되는지 확인합니다.
7. endpoint를 일부러 잘못 설정한 빌드에서도 공유 링크가 정상 생성되는지 확인합니다.

Apps Script는 `artifact_id`를 다시 검사하므로 첫 요청의 응답만 유실되어 같은 산출물을 재전송해도 중복 행을 만들지 않습니다. 동시 요청은 `LockService`로 직렬화합니다.
