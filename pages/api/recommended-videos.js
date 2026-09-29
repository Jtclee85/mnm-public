import { getActiveApprovedYoutubeChannels } from '../../lib/approvedYoutubeChannels';
import { filterVideosForStudents, getRejectedVideoSamples } from '../../lib/youtubeVideoFilter';

// 조사 주제와 관련된 영상을 승인 채널 안에서 실시간 검색한다. 요청당 YouTube API 호출은
// 최대 3회로 제한하며, 실패해도 200 + 빈 배열로 답해 앱을 깨지 않는다.
export const config = {
  runtime: 'edge',
};

const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

const MAX_CHANNELS = 5;
const MAX_QUERIES = 4;
const MAX_YOUTUBE_API_CALLS = 3;
const MAX_CANDIDATES = 24;

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  // 같은 검색어에 대한 반복 호출을 CDN에서 흡수해 YouTube API 쿼터를 아낀다.
  'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800',
};

function decodeHtmlEntities(text = '') {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function dedupe(list) {
  return [...new Set(list.filter(Boolean))];
}

function getFocusedChannelTags(text) {
  if (/독도/.test(text)) return ['독도', '동북아'];
  if (/독립운동|일제강점기|대한민국 임시정부|임시정부/.test(text)) {
    return ['독립운동', '근현대사'];
  }
  if (/전쟁|임진왜란|6·25|호국/.test(text)) {
    return ['전쟁사', '호국', '근현대사'];
  }
  if (/한국사|사료|조선|대한민국|고구려|발해|세종대왕/.test(text)) {
    return ['한국사', '사료', '동북아'];
  }
  if (/문화유산|국가유산|문화재|국보|보물|사찰|유적|고인돌|지석묘|선사|청동기|석탑|석등|박물관/.test(text)) {
    return ['문화유산', '박물관'];
  }
  if (/과학|광합성|전기|자석|화산|날씨|생물|식물|동물|우주|생태|환경|갯벌/.test(text)) {
    return ['과학', '생태', '환경'];
  }
  return [];
}

function hasAnyTag(channel, tags) {
  return channel.tags?.some(tag => tags.includes(tag));
}

function getFocusedTagRank(channel, focusedTags) {
  const ranks = (channel.tags || [])
    .map(tag => focusedTags.indexOf(tag))
    .filter(index => index !== -1);
  return ranks.length > 0 ? Math.min(...ranks) : 99;
}

function sortChannelsForTopic(channels, focusedTags) {
  return [...channels].sort((a, b) => {
    const aFocused = hasAnyTag(a, focusedTags) ? 0 : 1;
    const bFocused = hasAnyTag(b, focusedTags) ? 0 : 1;
    if (aFocused !== bFocused) return aFocused - bFocused;
    const aFocusedRank = getFocusedTagRank(a, focusedTags);
    const bFocusedRank = getFocusedTagRank(b, focusedTags);
    if (aFocusedRank !== bFocusedRank) return aFocusedRank - bFocusedRank;
    return (a.priority || 99) - (b.priority || 99);
  });
}

export function selectApprovedChannels(topic, sourceText, channels) {
  const text = `${topic || ''} ${sourceText || ''}`;
  const focusedTags = getFocusedChannelTags(text);

  const isHeritage = /문화유산|국가유산|문화재|국보|보물|사찰|유적|고인돌|지석묘|선사|청동기|석탑|석등|박물관|화엄사/.test(text);
  const isHistory = /한국사|역사|사료|독립운동|일제강점기|근현대사|조선|대한민국|독도|고구려|발해|전쟁|임진왜란|6·25|호국|박물관/.test(text);
  const isScience = /과학|광합성|전기|자석|화산|날씨|생물|식물|동물|우주|생태|환경|갯벌/.test(text);

  let selected = [];

  if (isHeritage || isHistory) {
    selected = channels.filter(c =>
      c.tags?.some(tag =>
        [
          '문화유산',
          '국가유산',
          '역사',
          '한국사',
          '사료',
          '근현대사',
          '독립운동',
          '동북아',
          '독도',
          '전쟁사',
          '호국',
          '박물관',
          '사회',
          '교육',
        ].includes(tag)
      )
    );
  } else if (isScience) {
    selected = channels.filter(c =>
      c.tags?.some(tag =>
        ['과학', '생태', '환경'].includes(tag)
      )
    );
    if (selected.length < MAX_CHANNELS) {
      const selectedIds = new Set(selected.map(channel => channel.channelId));
      selected.push(...channels.filter(c =>
        !selectedIds.has(c.channelId) &&
        c.tags?.some(tag => ['교육', '초등'].includes(tag))
      ));
    }
  } else {
    selected = channels.filter(c =>
      c.tags?.some(tag =>
        ['교육', '초등', '사회', '과학', '역사'].includes(tag)
      )
    );
  }

  return sortChannelsForTopic(selected, focusedTags).slice(0, MAX_CHANNELS);
}

// "어린이"를 무조건 넣지 않는다. 키즈/더빙/애니 영상 유입을 줄이기 위해
// 주제 성격에 맞는 구체적인 검색어만 만든다.
export function buildVideoSearchQueries(topic, sourceText = '') {
  const normalized = String(topic || '')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const text = `${topic || ''} ${sourceText || ''}`;
  const queries = [];

  // 강화는 지명이고 세계문화유산은 범위가 넓으므로, 둘만으로 고인돌 주제로 단정하지 않는다.
  const hasDolmen = /고인돌|지석묘|선사|청동기/.test(text);

  if (hasDolmen) {
    queries.push('고인돌');
    queries.push('지석묘');
    queries.push('선사시대 고인돌');
    queries.push('강화 고인돌');
    queries.push('고인돌 문화유산');
  }

  const isHeritage = /문화유산|국가유산|문화재|국보|보물|사찰|유적|역사|석탑|석등|박물관|화엄사/.test(text);
  const isHistory = /한국사|사료|독립운동|일제강점기|근현대사|조선|대한민국|독도|고구려|발해|전쟁|임진왜란|6·25|호국|세종대왕/.test(text);
  const isScience = /과학|광합성|전기|자석|화산|날씨|생물|식물|동물|우주|생태|환경|갯벌/.test(text);

  if (normalized) {
    if (isHeritage) {
      queries.push(normalized);
      queries.push(`${normalized} 문화유산`);
      queries.push(`${normalized} 역사`);
      queries.push(`${normalized} 초등 사회`);
    } else if (isHistory) {
      queries.push(normalized);
      queries.push(`${normalized} 역사`);
      queries.push(`${normalized} 한국사`);
      queries.push(`${normalized} 초등 사회`);
    } else if (isScience) {
      queries.push(normalized);
      queries.push(`${normalized} 과학`);
      queries.push(`${normalized} 초등 과학`);
    } else {
      queries.push(normalized);
      queries.push(`${normalized} 설명`);
      queries.push(`${normalized} 초등`);
    }
  }

  return dedupe(queries).slice(0, MAX_QUERIES);
}

function mapYoutubeItem(item, channel, query) {
  return {
    videoId: item.id?.videoId || '',
    title: decodeHtmlEntities(item.snippet?.title || ''),
    channelTitle: decodeHtmlEntities(item.snippet?.channelTitle || ''),
    description: decodeHtmlEntities(item.snippet?.description || ''),
    thumbnailUrl:
      item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
    url: item.id?.videoId ? `https://www.youtube.com/watch?v=${item.id.videoId}` : '',
    approvedChannelName: channel.name,
    approvedChannelId: channel.channelId,
    matchedQuery: query,
  };
}

async function searchYoutubeWithinChannel({ apiKey, channel, query }) {
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    channelId: channel.channelId,
    q: query,
    maxResults: '5',
    safeSearch: 'strict',
    relevanceLanguage: 'ko',
    regionCode: 'KR',
    videoEmbeddable: 'true',
    key: apiKey,
  });

  const res = await fetch(`${YOUTUBE_SEARCH_URL}?${params.toString()}`);
  if (!res.ok) {
    const retryAfterSeconds = Number(res.headers.get('retry-after') || 0);
    const errorText = await res.text().catch(() => '');
    let errorReason = '';
    try {
      const errorBody = JSON.parse(errorText);
      errorReason = errorBody?.error?.errors?.[0]?.reason || errorBody?.error?.status || '';
    } catch {}
    const quotaLimited =
      res.status === 429 || /quota|rateLimit|dailyLimit/i.test(errorReason);

    console.error(
      'YouTube 승인 채널 검색 오류:',
      channel.name,
      query,
      res.status,
      errorReason || 'unknown',
      retryAfterSeconds > 0 ? `retry-after=${retryAfterSeconds}s` : ''
    );
    return { videos: [], quotaLimited, retryAfterSeconds, status: res.status, errorReason };
  }
  const data = await res.json();
  return {
    videos: (data.items || []).map(item => mapYoutubeItem(item, channel, query)),
    quotaLimited: false,
    retryAfterSeconds: 0,
    status: res.status,
    errorReason: '',
  };
}

export function buildYoutubeSearchPlan(channels = [], queries = []) {
  const plan = [];
  for (const query of queries.slice(0, MAX_QUERIES)) {
    for (const channel of channels.slice(0, MAX_CHANNELS)) {
      plan.push({ channel, query });
      if (plan.length >= MAX_YOUTUBE_API_CALLS) return plan;
    }
  }
  return plan;
}

async function collectApprovedChannelCandidates({ apiKey, channels, queries }) {
  const candidateMap = new Map();
  const usedSearches = [];
  let quotaLimited = false;
  let retryAfterSeconds = 0;

  // 가장 구체적인 검색어를 우선순위가 높은 승인 채널 3곳에 적용한다.
  for (const { channel, query } of buildYoutubeSearchPlan(channels, queries)) {
    const outcome = await searchYoutubeWithinChannel({ apiKey, channel, query });
    usedSearches.push({
      channelName: channel.name,
      channelId: channel.channelId,
      query,
      count: outcome.videos.length,
      status: outcome.status,
      errorReason: outcome.errorReason,
    });

    for (const video of outcome.videos) {
      if (video.videoId && !candidateMap.has(video.videoId)) {
        candidateMap.set(video.videoId, video);
      }
    }

    // 일일 검색 한도나 순간 호출 제한은 뒤의 요청도 똑같이 실패한다. 첫 제한 응답에서
    // 즉시 멈춰 오류 로그와 불필요한 추가 호출이 연쇄적으로 발생하지 않게 한다.
    if (outcome.quotaLimited) {
      quotaLimited = true;
      retryAfterSeconds = outcome.retryAfterSeconds;
      break;
    }
    if (candidateMap.size >= MAX_CANDIDATES) break;
  }

  return {
    candidates: [...candidateMap.values()],
    usedSearches,
    rawCount: usedSearches.reduce((sum, item) => sum + item.count, 0),
    quotaLimited,
    retryAfterSeconds,
  };
}

function buildDebugBody({ topic, activeChannelCount, selectedChannels, queries, usedSearches, rawCount, candidates, videos, sourceText }) {
  return {
    topic,
    activeChannelCount,
    selectedChannels: selectedChannels.map(channel => ({
      name: channel.name,
      channelId: channel.channelId,
      tags: channel.tags || [],
      priority: channel.priority,
    })),
    queries,
    usedSearches,
    rawCount,
    dedupedCount: candidates.length,
    filteredCount: videos.length,
    selectedCount: videos.length,
    rejectedSamples: getRejectedVideoSamples(candidates, topic, sourceText),
  };
}

export default async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ videos: [], error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  let input = {};
  if (req.method === 'GET') {
    const url = new URL(req.url);
    input = {
      topic: url.searchParams.get('topic') || '',
      debug: url.searchParams.get('debug') === 'true',
    };
  } else {
    input = await req.json();
  }

  const { topic = '', sourceText = '', debug = false } = input;
  const trimmedTopic = String(topic).trim();
  const trimmedSourceText = String(sourceText || '');

  if (!trimmedTopic) {
    return new Response(JSON.stringify({ videos: [] }), { status: 200, headers: jsonHeaders });
  }

  try {
    const activeChannels = getActiveApprovedYoutubeChannels();
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ videos: [], source: 'live', error: 'YOUTUBE_API_KEY가 설정되어 있지 않습니다.' }),
        { status: 200, headers: jsonHeaders }
      );
    }

    const selectedChannels = selectApprovedChannels(trimmedTopic, trimmedSourceText, activeChannels);
    const queries = buildVideoSearchQueries(trimmedTopic, trimmedSourceText).slice(0, MAX_QUERIES);

    if (selectedChannels.length === 0 || queries.length === 0) {
      const body = debug === true
        ? {
            videos: [],
            debug: buildDebugBody({
              topic: trimmedTopic,
              activeChannelCount: activeChannels.length,
              selectedChannels,
              queries,
              usedSearches: [],
              rawCount: 0,
              candidates: [],
              videos: [],
              sourceText: trimmedSourceText,
            }),
          }
        : { videos: [] };

      return new Response(JSON.stringify(body), { status: 200, headers: jsonHeaders });
    }

    const { candidates, usedSearches, rawCount, quotaLimited, retryAfterSeconds } = await collectApprovedChannelCandidates({
      apiKey,
      channels: selectedChannels,
      queries,
    });
    const videos = filterVideosForStudents(candidates, trimmedTopic, trimmedSourceText);

    const body = debug === true
      ? {
          videos,
          quotaLimited,
          retryAfterSeconds,
          debug: buildDebugBody({
            topic: trimmedTopic,
            activeChannelCount: activeChannels.length,
            selectedChannels,
            queries,
            usedSearches,
            rawCount,
            candidates,
            videos,
            sourceText: trimmedSourceText,
          }),
        }
        : { videos, quotaLimited, retryAfterSeconds, source: 'live' };

    return new Response(JSON.stringify(body), { status: 200, headers: jsonHeaders });
  } catch (error) {
    console.error('추천 영상 검색 오류:', error);
    return new Response(
      JSON.stringify({ videos: [], error: '추천 영상을 불러오지 못했어요.' }),
      { status: 200, headers: jsonHeaders }
    );
  }
}
