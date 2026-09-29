# 뭐냐면 공개용 배포

이 저장소는 심사본 `Jtclee85/mnm`과 분리된 공개용 복사본입니다.

- 기준: 원본 `main`의 `ab57064f12e6e4bd17eb9dc2787b853b2a86e277`
- 공개용 저장소: `Jtclee85/mnm-public`
- 공개용 Vercel 프로젝트: `mnm-public`
- 원본 Git 이력, 로컬 미커밋 변경, 환경변수, 배포 연결 파일은 복사하지 않았습니다.
- 원본 저장소를 원격으로 추가하거나 원본 Vercel 프로젝트에 연결하지 않습니다.

## 공개용 환경변수

새 프로젝트에서만 설정합니다. 심사본 키와 수집 서버를 공유하지 않습니다.

- `OPENAI_API_KEY`: 사용자가 준비한 공개용 별도 키
- `YOUTUBE_API_KEY`: 선택 사항, 공개용 별도 키
- `NEXT_PUBLIC_SUBMISSION_MODE=false`
- `NEXT_PUBLIC_OFFLINE_DEMO_MODE=false`
- `NEXT_PUBLIC_ARTIFACT_APP_ID=mnm-public`
- `NEXT_PUBLIC_ARTIFACT_ENDPOINT`: 별도 수집 서버를 준비하기 전에는 미설정

Gemini 전환은 포함하지 않았으며 AI 기능은 기존 OpenAI 구현을 사용합니다. 키 변경은 재배포해야 적용됩니다.

## 원본 보존

원본 저장소의 커밋·브랜치·작업 파일과 기존 Vercel 환경변수·도메인·배포 설정은 변경하지 않습니다. 제출용 메타데이터의 기존 URL은 원본 코드에 남아 있으나 공개용에서는 제출 모드를 끕니다.
