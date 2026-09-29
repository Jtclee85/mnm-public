// 승인 채널에서 검색된 YouTube 후보를 초등학생 학습용으로 2차 필터링한다.
// 서버(/api/recommended-videos)와 테스트에서 함께 사용한다.

export const BLOCKED_VIDEO_IDS = [
  '0uLTQzs2hwU',
];

export const BANNED_KEYWORDS = [
  '쇼츠', 'shorts',
  '더빙', '성우', '목소리', '더빙판',
  '만화', '애니', '애니메이션',
  '키즈', 'kids', 'kid',
  '장난감', '놀이', '상황극',
  '몰카', '충격', '레전드', '실화', '괴담', '공포', '썰',
  '연예인', '아이돌', '논란', '사건', '사고',
  '먹방', '게임', '광고', '투자', '주식', '정치',
  'asmr', '챌린지', '반응', '리액션',
];

export const EDUCATIONAL_KEYWORDS = [
  '설명', '알아보기', '문화유산', '문화재', '역사', '사회', '과학',
  '초등', '수업', '학습', '박물관', '탐방', '강의', '교육',
];

const MAX_RESULTS = 3;
const MIN_DURATION_SECONDS = 90;
const MAX_DURATION_SECONDS = 25 * 60;
const IDEAL_MIN_DURATION_SECONDS = 3 * 60;
const IDEAL_MAX_DURATION_SECONDS = 15 * 60;
const DOLMEN_KEYWORDS = ['고인돌', '지석묘', '선사시대', '청동기', '강화 고인돌', '세계문화유산'];
const DOLMEN_REQUIRED_KEYWORDS = ['고인돌', '지석묘'];
const BROAD_LOCATION_KEYWORDS = new Set([
  '대한민국', '한국', '우리나라',
  '서울', '서울시', '서울특별시',
  '부산', '부산시', '부산광역시',
  '대구', '대구시', '대구광역시',
  '인천', '인천시', '인천광역시',
  '광주', '광주시', '광주광역시',
  '대전', '대전시', '대전광역시',
  '울산', '울산시', '울산광역시',
  '세종', '세종시', '세종특별자치시',
  '경기', '경기도', '강원', '강원도', '강원특별자치도',
  '충북', '충청북도', '충남', '충청남도',
  '전북', '전라북도', '전북특별자치도', '전남', '전라남도',
  '경북', '경상북도', '경남', '경상남도',
  '제주', '제주도', '제주특별자치도',
  '강화', '강화도', '강화군',
]);
const GENERIC_TOPIC_KEYWORDS = new Set([
  '역사', '문화', '문화유산', '국가유산', '문화재', '유적', '유물',
  '관광', '관광지', '여행', '탐방', '소개', '설명', '알아보기',
  '조사', '자료', '학습', '교육', '초등', '사회', '과학',
]);

function hasRequiredFields(video) {
  return !!(video?.videoId && video?.thumbnailUrl && video?.title && video?.channelTitle);
}

function includesText(haystack, needle) {
  return String(haystack || '').toLowerCase().includes(String(needle || '').toLowerCase());
}

function normalizeSpaces(text) {
  return String(text || '').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripTopicParticle(token) {
  return String(token || '').replace(/(에서|으로|부터|까지|처럼|보다|에게|한테|와|과|은|는|이|가|을|를|의|에)$/u, '');
}

function uniq(list) {
  return [...new Set(list.filter(Boolean))];
}

function isDolmenTopic(topic, sourceText = '') {
  return /고인돌|지석묘|청동기|선사시대|강화 고인돌/.test(`${topic || ''} ${sourceText || ''}`);
}

function getLocationScopedCoreKeywords(topic) {
  const topicTokens = normalizeSpaces(topic)
    .split(/[\s,./·:;!?[\]{}'"“”‘’]+/)
    .map(stripTopicParticle)
    .filter(token => token.length >= 2);

  if (!topicTokens.some(token => BROAD_LOCATION_KEYWORDS.has(token))) return [];

  return uniq(topicTokens.filter(token =>
    !BROAD_LOCATION_KEYWORDS.has(token) && !GENERIC_TOPIC_KEYWORDS.has(token)
  ));
}

function getTopicKeywords(topic, sourceText = '') {
  const normalizedTopic = normalizeSpaces(topic);
  const topicTokens = normalizedTopic
    .split(/[\s,./·:;!?[\]{}'"“”‘’]+/)
    .map(w => w.trim())
    .filter(w => w.length >= 2);

  const haystack = `${topic || ''} ${sourceText || ''}`;
  const domainKeywords = [
    '문화유산', '문화재', '국보', '보물', '사찰', '유적', '역사', '석탑', '석등', '박물관',
    '과학', '광합성', '전기', '자석', '화산', '날씨', '생물', '식물', '동물', '우주', '생태', '환경', '갯벌',
    '세종대왕', '독도', '신석기',
  ].filter(keyword => haystack.includes(keyword));

  return uniq([
    ...(isDolmenTopic(topic, sourceText) ? DOLMEN_KEYWORDS : []),
    normalizedTopic,
    ...topicTokens,
    ...domainKeywords,
  ]);
}

function findKeyword(video, keywords) {
  const haystack = `${video.title} ${video.description || ''} ${video.channelTitle}`.toLowerCase();
  return keywords.find(k => haystack.includes(k.toLowerCase())) || null;
}

function getVideoText(video) {
  // 승인 채널명은 신뢰성 판단에는 쓰지만 주제 관련성 근거로 삼지 않는다.
  // 채널명의 '교육·역사·과학' 같은 일반어가 무관한 영상을 통과시킬 수 있기 때문이다.
  return `${video.title || ''} ${video.description || ''}`;
}

function matchesAnyKeyword(text, keywords) {
  return keywords.some(keyword => includesText(text, keyword));
}

function reject(reason) {
  return { accepted: false, reason };
}

export function scoreVideoForStudents(video, topic, sourceText = '') {
  if (!hasRequiredFields(video)) return reject('required field missing');
  if (!video.approvedChannelId) return reject('missing approved channel');
  if (BLOCKED_VIDEO_IDS.includes(video.videoId)) return reject(`blocked videoId: ${video.videoId}`);

  const bannedKeyword = findKeyword(video, BANNED_KEYWORDS);
  if (bannedKeyword) return reject(`banned keyword: ${bannedKeyword}`);

  const durationSeconds = Number(video.durationSeconds || 0);
  if (durationSeconds > 0 && durationSeconds < MIN_DURATION_SECONDS) return reject('duration too short');
  if (durationSeconds > MAX_DURATION_SECONDS) return reject('duration too long');

  const topicKeywords = getTopicKeywords(topic, sourceText);
  const videoText = getVideoText(video);
  const title = video.title || '';
  const description = video.description || '';

  // 넓은 지역명만 겹치는 다른 명소가 통과하지 않도록, 지역명 뒤의 세부 조사 대상을 확인한다.
  const locationScopedCoreKeywords = getLocationScopedCoreKeywords(topic);
  if (
    locationScopedCoreKeywords.length > 0 &&
    !locationScopedCoreKeywords.every(keyword => includesText(videoText, keyword))
  ) {
    return reject(`location-scoped core keyword not found: ${locationScopedCoreKeywords.join(', ')}`);
  }

  // '강화'는 장소명인 동시에 "역량 강화"처럼 흔히 쓰이는 말이다. 고인돌 조사에서는
  // 이 모호한 낱말만 겹치는 개항·학생부 영상을 제외하고 핵심 대상이 명시된 영상만 쓴다.
  if (isDolmenTopic(topic, sourceText) && !matchesAnyKeyword(videoText, DOLMEN_REQUIRED_KEYWORDS)) {
    return reject('dolmen core keyword not found');
  }

  const hasTopicKeyword = topicKeywords.length === 0 || matchesAnyKeyword(videoText, topicKeywords);

  if (!hasTopicKeyword) return reject('topic keyword not found');

  const normalizedTopic = normalizeSpaces(topic);
  const exactTopicInTitle = normalizedTopic && includesText(title, normalizedTopic);
  const topicKeywordInTitle = topicKeywords.some(keyword => includesText(title, keyword));
  const topicKeywordInDescription = topicKeywords.some(keyword => includesText(description, keyword));
  const educationalKeywordMatched = findKeyword(video, EDUCATIONAL_KEYWORDS);
  const viewCount = Number(video.viewCount || 0);

  let score = 0;
  if (video.approvedChannelId) score += 10;
  if (exactTopicInTitle) score += 6;
  if (topicKeywordInTitle) score += 4;
  if (topicKeywordInDescription) score += 2;
  if (educationalKeywordMatched) score += 2;
  if (durationSeconds >= IDEAL_MIN_DURATION_SECONDS && durationSeconds <= IDEAL_MAX_DURATION_SECONDS) score += 2;
  if (viewCount > 1000) score += 1;

  if (score < 8) return reject(`score too low: ${score}`);

  return {
    accepted: true,
    score,
    video: {
      ...video,
      reason: '조사 주제와 관련된 승인 채널 영상이에요',
    },
  };
}

// 승인 채널 후보 배열에서 학습용 영상을 점수순으로 골라 최대 3개 반환한다.
export function filterVideosForStudents(videos, topic, sourceText = '') {
  const scored = (videos || [])
    .map(video => scoreVideoForStudents(video, topic, sourceText))
    .filter(result => result.accepted);

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(item => item.video);
}

export function getRejectedVideoSamples(videos, topic, sourceText = '', limit = 5) {
  return (videos || [])
    .map(video => ({ video, result: scoreVideoForStudents(video, topic, sourceText) }))
    .filter(item => !item.result.accepted)
    .slice(0, limit)
    .map(({ video, result }) => ({
      title: video?.title || '',
      channelTitle: video?.channelTitle || '',
      reason: result.reason,
    }));
}
