import { useEffect, useState } from 'react';

// 분석 완료 후 좌측 패널 하단에 보여주는 관련 YouTube 영상 추천.
//
// 정책 (교사 승인 채널 기반 외부 참고 링크):
//  - 온라인 모드: 승인 채널 안에서 YouTube API로 실시간 검색한 결과를 표시한다.
//    썸네일은 원본 URL로만 표시하고 파일로 저장하지 않는다.
//  - 오프라인 데모 / 심사(submission) 모드: API를 호출하지 않고 snapshot의
//    recommendedVideos만 사용한다. videoId가 있으면 youtube-nocookie 미리보기를
//    (사용자가 눌렀을 때) 보여줄 수 있고, 없으면 텍스트 링크 카드만 보여준다.
//  - 어떤 모드에서도 YouTube 썸네일/영상/음원/자막 파일을 저장하지 않는다.
//  - autoplay 금지. 링크는 새 탭. 카드에는 채널명·승인 채널·출처(YouTube)를 표시한다.
//  - 추천할 영상이 없으면 사용자가 제공한 안내 이미지를 보여준다.

// 관련성 판정 규칙이 바뀌면 이전 오탐 결과를 다시 쓰지 않도록 버전을 올린다.
const RECOMMENDATION_VERSION = '5';
const CACHE_PREFIX = `mnm-recommended-videos:v${RECOMMENDATION_VERSION}:`;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24시간
const EMPTY_CACHE_TTL_MS = 15 * 60 * 1000; // 결과 없음 재검색은 15분 뒤
const QUOTA_LIMIT_CACHE_TTL_MS = 30 * 60 * 1000; // 429 연쇄 호출 방지

function readCache(topic) {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${topic}`);
    if (!raw) return null;
    const { videos, savedAt, ttlMs } = JSON.parse(raw);
    if (!Array.isArray(videos) || Date.now() - savedAt > (ttlMs || CACHE_TTL_MS)) return null;
    return videos;
  } catch {
    return null;
  }
}

function writeCache(topic, videos, ttlMs = CACHE_TTL_MS) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${topic}`, JSON.stringify({ videos, savedAt: Date.now(), ttlMs }));
  } catch {}
}

// watch?v=, youtu.be/, embed/ 형태의 URL에서 videoId를 뽑는다.
function extractYouTubeVideoId(url = '') {
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{6,})/,
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{6,})/,
  ];
  for (const re of patterns) {
    const match = String(url || '').match(re);
    if (match) return match[1];
  }
  return '';
}

// 온라인 API 응답과 오프라인 snapshot 데이터를 같은 UI에서 쓰도록 정규화한다.
function normalizeVideo(video) {
  if (!video) return null;
  const videoId = video.videoId || extractYouTubeVideoId(video.url);
  const url = video.url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');
  if (!videoId && !url) return null;

  return {
    videoId,
    title: video.title || '추천 영상',
    channelTitle: video.channelTitle || video.approvedChannelName || '승인 채널',
    approvedChannelName: video.approvedChannelName || video.channelTitle || '',
    approvedChannelId: video.approvedChannelId || '',
    url,
    source: video.source || 'YouTube',
    usageType: video.usageType || 'external-reference-link',
    // 오프라인 snapshot에는 썸네일을 저장하지 않는다(정책). 온라인 API 응답에만 존재.
    thumbnailUrl: video.thumbnailUrl || '',
    reason: video.reason || '',
  };
}

function normalizeVideos(list) {
  return (Array.isArray(list) ? list : []).map(normalizeVideo).filter(Boolean);
}

export default function RecommendedVideos({
  topic,
  enabled,
  demoMode,
  submissionMode,
  demoVideos,
  allowEmbed = true,
  t,
  isMobile,
}) {
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const trimmedTopic = (topic || '').trim();

  // 오프라인 데모·심사 제출본에서는 절대 API를 호출하지 않는다.
  const isStaticVideoMode =
    demoMode || submissionMode || process.env.NEXT_PUBLIC_SUBMISSION_MODE === 'true';

  useEffect(() => {
    if (!enabled || !trimmedTopic) return;

    if (isStaticVideoMode) {
      const staticVideos = normalizeVideos(demoVideos);
      if (staticVideos.length === 0) {
        console.warn('[recommended-videos] 승인 채널 예시 영상이 없어 안내 이미지를 표시합니다.', { topic: trimmedTopic });
      }
      setVideos(staticVideos);
      setIsLoading(false);
      return;
    }

    const cached = readCache(trimmedTopic);
    if (cached) {
      setVideos(normalizeVideos(cached));
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    // 주제만 GET 쿼리에 담아 동일 주제 요청을 CDN이 공용 캐시할 수 있게 한다.
    // API는 승인 채널 안에서 실시간 검색하며, 서버가 YouTube 호출을 최대 3회로 제한한다.
    fetch(`/api/recommended-videos?v=${RECOMMENDATION_VERSION}&topic=${encodeURIComponent(trimmedTopic)}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        const list = normalizeVideos(data?.videos);
        if (list.length === 0) {
          console.warn('[recommended-videos] 승인 채널에서 추천 영상을 찾지 못했습니다.', { topic: trimmedTopic });
        }
        setVideos(list);
        if (list.length > 0) {
          writeCache(trimmedTopic, list);
        } else {
          // 한도 초과 때 빈 결과도 잠시 기억해야 같은 브라우저에서 화면을 다시 열 때
          // 실패 요청을 즉시 반복하지 않는다. 일반적인 결과 없음은 더 짧게 보관한다.
          const ttlMs = data?.quotaLimited
            ? Math.max(QUOTA_LIMIT_CACHE_TTL_MS, Number(data?.retryAfterSeconds || 0) * 1000)
            : EMPTY_CACHE_TTL_MS;
          writeCache(trimmedTopic, [], ttlMs);
        }
      })
      .catch(error => {
        console.warn('[recommended-videos] 불러오기 실패 (안내 이미지 표시):', error);
        if (!cancelled) setVideos([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
    // sourceText/gradeLevel은 영상 요청에 보내지 않아 학생 자료가 URL·서버 로그에 남지 않는다.
  }, [enabled, trimmedTopic, isStaticVideoMode]);

  if (!enabled || !trimmedTopic) return null;

  const title = t?.recommendedVideosTitle || '함께 보면 좋은 영상';
  const subtitle = t?.recommendedVideosSubtitle || '믿을 수 있는 교육·공공 채널에서 관련 영상을 골라봤어요.';
  const unavailableText = t?.recommendedVideosUnavailable || '관련 영상을 불러오지 못했어요.';
  const openLabel = t?.recommendedVideosOpen || 'YouTube에서 보기';
  const sourceLabel = t?.recommendedVideosSource || '출처';
  const disclaimer =
    t?.recommendedVideosDisclaimer ||
    '※ 추천 영상은 교사가 승인한 공식 YouTube 채널의 외부 참고 링크입니다. 영상·썸네일 파일은 프로그램에 저장되지 않습니다.';

  return (
    <aside data-testid="recommended-videos" style={styles.wrap} aria-label={title}>
      <p style={styles.heading}>🎬 {title}</p>
      <p style={styles.subheading}>{!isLoading && videos.length === 0 ? unavailableText : subtitle}</p>

      {isLoading ? (
        <div style={styles.list} aria-label={t?.recommendedVideosLoading || '관련 영상을 찾고 있어요...'}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ ...styles.card, ...styles.skeletonCard }}>
              <div style={{ ...styles.thumbWrap, ...styles.skeletonBlock }} />
              <div style={styles.textCol}>
                <div style={{ ...styles.skeletonBlock, height: 14, width: '80%' }} />
                <div style={{ ...styles.skeletonBlock, height: 12, width: '50%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : videos.length > 0 ? (
        <div style={styles.list}>
          {videos.map((video, idx) => (
            <VideoCard
              key={video.videoId || video.url || idx}
              video={video}
              staticMode={isStaticVideoMode}
              allowEmbed={allowEmbed}
              openLabel={openLabel}
              sourceLabel={sourceLabel}
              isMobile={isMobile}
            />
          ))}
        </div>
      ) : (
        <div data-testid="recommended-videos-fallback" style={styles.fallbackCard}>
          {/* 사용자가 제공한 자체 안내 이미지이며 외부 영상·썸네일 파일이 아니다. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/youtube_not_found_nbg.webp"
            alt={unavailableText}
            style={styles.fallbackImage}
          />
        </div>
      )}

      {videos.length > 0 && <p style={styles.disclaimer}>{disclaimer}</p>}
    </aside>
  );
}

// 온라인 모드: 썸네일 + 텍스트를 하나의 링크 카드로. (기존 동작 유지)
// 오프라인/심사 모드: 텍스트 링크 카드가 기본이고, videoId가 있으면
//   '미리보기 보기'를 눌렀을 때만 youtube-nocookie iframe을 로드한다(autoplay 없음).
function VideoCard({ video, staticMode, allowEmbed, openLabel, sourceLabel, isMobile }) {
  const [showEmbed, setShowEmbed] = useState(false);
  const canEmbed = staticMode && allowEmbed && !!video.videoId;

  const infoBlock = (
    <>
      <span style={styles.title}>{video.title}</span>
      <span style={styles.channel}>{video.channelTitle}</span>
      {video.approvedChannelName && (
        <span style={styles.approvedChannel}>공식/교육 채널 · {video.approvedChannelName}</span>
      )}
      <span style={styles.sourceLine}>{sourceLabel}: {video.source}</span>
      {video.reason && <span style={styles.reasonBadge}>{video.reason}</span>}
    </>
  );

  // 온라인 모드(썸네일 있음, embed 아님): 카드 전체가 새 탭 링크 — 기존 UI/테스트 유지.
  if (!staticMode) {
    return (
      <a
        href={video.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}
        aria-label={`${video.title}, ${video.channelTitle}. 새 탭에서 YouTube가 열립니다.`}
      >
        <span style={{ ...styles.thumbWrap, ...(isMobile ? styles.thumbWrapMobile : {}) }}>
          {video.thumbnailUrl ? (
            // YouTube 썸네일은 외부 호스트라 next/image 대신 img로 실시간 표시(저장 안 함)
            // eslint-disable-next-line @next/next/no-img-element
            <img src={video.thumbnailUrl} alt={`${video.title} 썸네일`} style={styles.thumb} loading="lazy" />
          ) : (
            <span style={styles.thumbPlaceholder} aria-hidden="true">🎬</span>
          )}
        </span>
        <span style={styles.textCol}>
          {infoBlock}
          <span style={styles.openLink}>{openLabel} ↗</span>
        </span>
      </a>
    );
  }

  // 오프라인/심사 모드: 미리보기(iframe)는 선택적으로만 로드. iframe이 없거나
  // 네트워크가 없어도 제목/채널/출처/링크는 항상 보인다.
  return (
    <div style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
      <div style={{ ...styles.thumbWrap, ...(isMobile ? styles.thumbWrapMobile : {}) }}>
        {canEmbed && showEmbed ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=0&rel=0`}
            title={video.title}
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={styles.iframe}
          />
        ) : canEmbed ? (
          <button
            type="button"
            onClick={() => setShowEmbed(true)}
            style={styles.previewBtn}
            aria-label={`${video.title} 미리보기 열기`}
          >
            ▶ 미리보기
          </button>
        ) : (
          <span style={styles.thumbPlaceholder} aria-hidden="true">🎬</span>
        )}
      </div>
      <div style={styles.textCol}>
        {infoBlock}
        <a href={video.url} target="_blank" rel="noopener noreferrer" style={styles.openLink}>
          {openLabel} ↗
        </a>
        {canEmbed && (
          <span style={styles.embedHint}>온라인 연결 시 YouTube 공식 플레이어로 미리보기가 표시됩니다.</span>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 },
  heading: { fontSize: 13, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 0 2px' },
  subheading: { fontSize: 12, color: 'var(--color-text-sub)', margin: '0 0 2px 2px' },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  fallbackCard: {
    width: '100%', display: 'flex', justifyContent: 'center', boxSizing: 'border-box',
    padding: '8px 0', background: 'transparent',
  },
  fallbackImage: { width: '100%', maxWidth: 500, height: 'auto', display: 'block' },

  card: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14,
    padding: 10, boxSizing: 'border-box',
    textDecoration: 'none', color: 'inherit',
    boxShadow: '0 2px 8px rgba(var(--color-text-rgb),0.08)',
  },
  cardMobile: { flexDirection: 'column', alignItems: 'stretch' },

  thumbWrap: {
    width: 120, height: 68, flexShrink: 0, borderRadius: 10, overflow: 'hidden',
    background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  thumbWrapMobile: { width: '100%', height: 'auto', aspectRatio: '16 / 9' },
  thumb: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  iframe: { width: '100%', height: '100%', border: 0, display: 'block' },
  thumbPlaceholder: { fontSize: 24 },
  previewBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)',
    color: 'var(--color-primary)', fontWeight: 800, fontSize: 12,
    borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
  },

  textCol: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 },
  title: {
    fontSize: 13, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.4,
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },
  channel: {
    fontSize: 12, color: 'var(--color-text-sub)', fontWeight: 600,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  approvedChannel: {
    fontSize: 11, color: 'var(--color-primary)', fontWeight: 800,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  sourceLine: { fontSize: 11, color: 'var(--color-text-sub)', fontWeight: 600 },
  reasonBadge: {
    alignSelf: 'flex-start', fontSize: 11, fontWeight: 700,
    color: 'var(--color-text)', lineHeight: 1.4,
    background: 'color-mix(in srgb, var(--color-accent-teal) 14%, var(--color-surface))',
    border: '1px solid color-mix(in srgb, var(--color-accent-teal) 50%, var(--color-border))',
    borderRadius: 8, padding: '2px 8px',
  },
  openLink: { fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', marginTop: 1, textDecoration: 'none' },
  embedHint: { fontSize: 10, color: 'var(--color-text-sub)', lineHeight: 1.4 },
  disclaimer: { fontSize: 10, color: 'var(--color-text-sub)', lineHeight: 1.5, margin: '4px 0 0 2px' },

  skeletonCard: { pointerEvents: 'none' },
  skeletonBlock: { background: 'var(--color-border)', borderRadius: 8, opacity: 0.5 },
};
