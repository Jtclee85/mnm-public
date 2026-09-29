# GPT 챗봇 (Simple Template)

## 🚀 시작 방법

1. `.env.local.example` 파일을 `.env.local`로 복사하고 OpenAI 키 입력
2. 로컬에서:
   ```
   npm install
   npm run dev
   ```
3. 브라우저에서 `http://localhost:3000` 접속 → 챗봇 테스트

## ☁️ Vercel 배포

1. 저장소를 Vercel에 연결
2. 환경변수 `OPENAI_API_KEY` 등록
   - 추천 영상 기능을 쓰려면 `YOUTUBE_API_KEY`도 등록
3. Deploy → 생성된 URL로 접속하면 ✅ 바로 챗봇 사용 가능

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
