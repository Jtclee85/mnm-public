# 뭐냐면 (공개용)

초등 사회과 조사학습·박물관 학습 자료를 학생 수준에 맞게 재구성하는 AI 코스웨어입니다.
공개용은 생성형 AI 공급자로 **Google Gemini**(`gemini-3.5-flash`)를 기본 사용합니다. **교사**가 자기 Gemini API 키로 학급 코드를 만들고, **학생**은 학급 코드만 넣어 AI 기능을 씁니다. 학생 화면에는 키가 보이지 않습니다.

## 🚀 시작 방법 (로컬)

1. `.env.local.example`을 `.env.local`로 복사합니다.
2. 실제 Upstash 없이 확인하려면 테스트용 가짜 저장소를 함께 띄웁니다.
   ```
   npm install
   node tests/support/mock-upstash-server.js 3998
   UPSTASH_REDIS_REST_URL=http://127.0.0.1:3998 UPSTASH_REDIS_REST_TOKEN=mock-upstash-token \
   CLASS_KEY_SECRET=local-only-class-secret-not-for-production-000 npm run dev
   ```
3. 교사: `http://localhost:3000/teacher`에서 [Google AI Studio](https://aistudio.google.com/apikey) 키를 등록하고 학급 코드(예: `해원초-4821`)를 만듭니다.
4. 학생: `http://localhost:3000`에서 사용법을 본 뒤 학급 코드를 넣습니다.

## 🏫 교사 키와 학급 코드

- 교사 키는 교사 브라우저에 저장됩니다(기본 `sessionStorage`, '이 기기에 저장'을 고르면 `localStorage`).
- 학급 코드를 만들면 키를 AES-GCM으로 암호화해 Upstash에 **발급한 날 한국 시간 자정까지만** 보관합니다. 학생 요청을 처리할 때만 서버에서 풀어 씁니다.
- 학급 관리(키 교체·코드 재발급·삭제)는 학급을 만든 기기에서만 할 수 있습니다.
- 틀린 학급 코드는 접속자별로 10분에 10번까지만 허용합니다.
- 모델 선택 근거, 호출 기능 목록, 오류 안내, 환경변수, 롤백 방법, **Production 활성화 전 확인 사항(보류된 약관 검토 포함)** 은 [docs/GEMINI_OPERATIONS.md](docs/GEMINI_OPERATIONS.md)를 봅니다.

## ↩️ OpenAI로 되돌리기

`AI_PROVIDER=openai`와 `OPENAI_API_KEY`를 설정하고 다시 빌드합니다. 학급 코드 창이 사라지고 서버 키로 기존 OpenAI 구현을 씁니다.

## ☁️ Vercel 배포

1. 공개용 Vercel 프로젝트(`mnm-public`)에 저장소를 연결합니다. 원본 프로젝트 `mnm`은 건드리지 않습니다.
2. 환경변수
   - `AI_PROVIDER`: 미설정 시 `gemini`. 롤백할 때만 `openai`
   - Gemini 모드: Upstash Redis 연결(`UPSTASH_REDIS_REST_URL`/`TOKEN` 또는 `KV_REST_API_URL`/`TOKEN`), `CLASS_KEY_SECRET`(32자 이상)
   - `OPENAI_API_KEY`: OpenAI 모드에서만 필요
   - `YOUTUBE_API_KEY`: 추천 영상 기능을 쓸 때
   - `GEMINI_API_BASE_URL`은 테스트 전용이므로 설정하지 않습니다.
3. 공개 사이트에서 켜기 전에 [운영 문서의 확인 항목](docs/GEMINI_OPERATIONS.md#11-production-활성화-전-확인)을 먼저 확인합니다.

## YouTube 추천 영상 기능

추천 영상은 YouTube API로 승인 채널 안에서 실시간 검색합니다. 한 요청에서 YouTube
검색 API는 최대 3회까지만 호출하고, 같은 주제의 GET 응답은 CDN과 브라우저가 재사용합니다.

1. Vercel 또는 `.env.local`에 `YOUTUBE_API_KEY`를 설정합니다.
2. `lib/approvedYoutubeChannels.js`에 승인 후보 채널의 `name`/`searchName`/`handle`을 입력합니다.
3. `npm run youtube:channels` 명령으로 `channelId` 후보를 조회합니다.
4. 교사가 결과를 확인한 뒤 정확한 `channelId`만 `approvedYoutubeChannels.js`에 복사합니다.
5. `channelId`가 비어 있는 채널은 추천 검색에서 제외됩니다.

### 온라인 / 오프라인(심사) 동작

- **온라인 배포본**: `/api/recommended-videos`가 승인 채널 안에서 최대 3회의 실시간 검색을 실행합니다. 승인 채널 밖 영상은 표시하지 않고, 조건을 만족하는 영상이 없으면 안내 이미지를 보여줍니다.
- **오프라인 데모 / 심사 제출본**: YouTube API를 호출하지 않고 snapshot의 `recommendedVideos`만 사용합니다. `videoId`가 있으면 사용자가 눌렀을 때만 `youtube-nocookie` 미리보기를 로드하고(자동재생 없음), 없으면 텍스트 링크 카드만 보여줍니다. 네트워크가 없어도 제목·채널명·출처·링크는 항상 표시됩니다.

### snapshot `recommendedVideos` 구조

```json
{
  "videoId": "교사가_승인한_VIDEO_ID",
  "title": "영상 제목",
  "channelTitle": "채널명",
  "approvedChannelName": "국가유산채널(K-Heritage Channel)",
  "approvedChannelId": "UCRO-l6Fli7rtpY2O9Y5NIzw",
  "url": "https://www.youtube.com/watch?v=교사가_승인한_VIDEO_ID",
  "source": "YouTube",
  "usageType": "external-reference-link"
}
```

`thumbnailUrl`(썸네일 이미지)은 snapshot에 저장하지 않습니다. 실제 심사용 `submission-demo/demo-snapshot.local.json`은 `.gitignore` 대상이며, 교사가 승인한 `videoId`만 넣습니다.

### 저작권 안내

본 소프트웨어의 ‘함께 보면 좋은 영상’ 기능은 YouTube 영상 및 썸네일 이미지를 프로그램 내부에 저장·복제·재배포하지 않고, 교사가 사전에 승인한 공공·교육기관 공식 YouTube 채널의 원본 영상 정보를 YouTube 공식 API 또는 임베드 기능을 통해 연결하는 방식으로 구현하였습니다. 영상 제목, 채널명, 출처를 화면에 명시하였으며, 동영상 파일·음원·자막·썸네일 이미지 파일을 제출물에 포함하지 않았습니다. 오프라인 실행 환경에서는 YouTube API를 호출하지 않고, 저장된 예시의 `videoId`와 원본 링크를 통해 외부 참고자료임을 표시합니다.
