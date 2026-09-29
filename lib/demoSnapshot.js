// 오프라인 데모 스냅샷 로더/정규화 — pages/offline-demo.js(getStaticProps)와
// scripts/build-submission-package.js가 함께 사용하므로 CommonJS로 작성한다.
// 빌드 시점(Node)에서만 실행되며 클라이언트 번들에는 포함되지 않는다.

const fs = require('fs');
const path = require('path');

const LOCAL_SNAPSHOT = path.join(process.cwd(), 'submission-demo', 'demo-snapshot.local.json');
const EXAMPLE_SNAPSHOT = path.join(process.cwd(), 'submission-demo', 'demo-snapshot.example.json');

// 저장된 오프라인 데모 대화는 실제 시연 맥락이므로 축약하지 않고 순서대로 보여준다.
// 단, 역할이 user/assistant인 비어 있지 않은 메시지만 통과시켜 화면 깨짐을 막는다.
function normalizeConversation(conversation) {
  const messages = Array.isArray(conversation) ? conversation : [];
  return messages
    .map((msg) => ({
      role: msg?.role === 'user' ? 'user' : 'assistant',
      content: typeof msg?.content === 'string' ? msg.content.trim() : '',
    }))
    .filter((msg) => msg.content);
}

// 스냅샷을 Home(demoMode)이 기대하는 안전한 구조로 정규화한다.
function normalizeSnapshot(raw, isFallback) {
  const session = raw.session || {};
  const topic = raw.topic || session.topic || '';
  return {
    isFallback: !!isFallback,
    exportedAt: raw.exportedAt || '',
    topic,
    session: {
      topic,
      sourceText: session.sourceText || '',
      gradeLevel: session.gradeLevel || 'standard',
      language: session.language || 'ko',
      // 심사 시연은 저장 당시 마지막 탭과 무관하게 학습 흐름의 첫 단계인 이해부터 시작한다.
      activeMode: 'understand',
      notes: session.notes || raw.notes || {},
      analysisByMode: session.analysisByMode || {},
      toolResults: session.toolResults || {},
      conversation: normalizeConversation(session.conversation),
      recommendedVideos: normalizeRecommendedVideos(session.recommendedVideos),
    },
  };
}

// 추천 영상은 승인 채널 정책상 videoId·제목·채널·출처 등 링크 정보만 보관한다.
// 썸네일 이미지(thumbnailUrl)는 파일로도 데이터로도 저장하지 않으므로 여기서 제거한다.
function normalizeRecommendedVideos(list) {
  const videos = Array.isArray(list) ? list : [];
  return videos
    .map((v) => ({
      videoId: typeof v?.videoId === 'string' ? v.videoId : '',
      title: typeof v?.title === 'string' ? v.title : '',
      channelTitle: typeof v?.channelTitle === 'string' ? v.channelTitle : '',
      approvedChannelName: typeof v?.approvedChannelName === 'string' ? v.approvedChannelName : '',
      approvedChannelId: typeof v?.approvedChannelId === 'string' ? v.approvedChannelId : '',
      url: typeof v?.url === 'string' ? v.url : '',
      source: typeof v?.source === 'string' ? v.source : 'YouTube',
      usageType: typeof v?.usageType === 'string' ? v.usageType : 'external-reference-link',
    }))
    // 최소한 videoId나 url 중 하나는 있어야 카드로 표시할 수 있다.
    .filter((v) => v.videoId || v.url);
}

// 우선순위: demo-snapshot.local.json(사용자 실제 세션, gitignore) → demo-snapshot.example.json(구조 예시)
function loadDemoSnapshot() {
  const useLocal = fs.existsSync(LOCAL_SNAPSHOT);
  const file = useLocal ? LOCAL_SNAPSHOT : EXAMPLE_SNAPSHOT;
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return normalizeSnapshot(raw, !useLocal);
}

module.exports = { loadDemoSnapshot, normalizeSnapshot, normalizeConversation, LOCAL_SNAPSHOT, EXAMPLE_SNAPSHOT };
