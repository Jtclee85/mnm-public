import { useCallback, useEffect, useRef, useState } from 'react';
import { RECOMMENDED_SOURCES } from '../lib/recommendedSources';

// 설명 말풍선 크기 — 어느 쪽에 펼칠지 계산할 때 쓴다.
const TIP_WIDTH = 200;
const TIP_GAP = 12;

export default function RecommendedSources({ isMobile, isCompact = false }) {
  return (
    <aside
      style={isMobile
        ? styles.wrapMobile
        : { ...styles.wrap, ...(isCompact ? styles.wrapCompact : {}) }}
      aria-label="추천 원본자료 목록"
    >
      <p style={styles.heading}>이런 자료를 찾아봐요</p>
      <div style={styles.list}>
        {RECOMMENDED_SOURCES.map(source => (
          <SourceBanner key={source.id} source={source} isMobile={isMobile} />
        ))}
      </div>
    </aside>
  );
}

function SourceBanner({ source, isMobile }) {
  const [active, setActive] = useState(false);
  // 이 배너가 화면 왼쪽에 있으면 오른쪽으로, 오른쪽 컬럼에 있으면 왼쪽으로 펼친다.
  // 컬럼 위치는 배율·창 크기에 따라 달라지므로 값을 고정하지 않고 그때그때 잰다.
  const [tipSide, setTipSide] = useState('right');
  const cardRef = useRef(null);

  const updateTipSide = useCallback(() => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const roomRight = window.innerWidth - rect.right;
    const roomLeft = rect.left;
    const needed = TIP_WIDTH + TIP_GAP;
    if (roomRight >= needed) setTipSide('right');
    else if (roomLeft >= needed) setTipSide('left');
    else setTipSide(roomLeft > roomRight ? 'left' : 'right');
  }, []);

  // 마우스를 올린 뒤에 방향을 정하면 첫 프레임이 반대쪽에 잡힐 수 있다.
  // 배치가 끝난 직후와 창 크기가 바뀔 때 미리 계산해 둔다.
  useEffect(() => {
    if (isMobile) return undefined;
    updateTipSide();
    window.addEventListener('resize', updateTipSide);
    return () => window.removeEventListener('resize', updateTipSide);
  }, [isMobile, updateTipSide]);

  const showTip = () => {
    updateTipSide();
    setActive(true);
  };

  return (
    <div style={styles.cardWrap}>
      <a
        ref={cardRef}
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...styles.card, ...(active ? styles.cardActive : {}) }}
        onMouseEnter={showTip}
        onMouseLeave={() => setActive(false)}
        onFocus={showTip}
        onBlur={() => setActive(false)}
        aria-describedby={!isMobile ? `tip-${source.id}` : undefined}
        aria-label={`${source.name}, ${source.org}. ${source.tip}. 새 탭에서 열립니다.`}
      >
        <span style={styles.badge} aria-hidden="true">{source.name.slice(0, 1)}</span>
        <span style={styles.textCol}>
          <span style={styles.name}>{source.name}</span>
          <span style={styles.org}>{source.org}</span>
          {isMobile && <span style={styles.tipInline}>{source.tip}</span>}
        </span>
      </a>

      {!isMobile && (
        <div
          id={`tip-${source.id}`}
          data-testid={`source-tip-${source.id}`}
          role="tooltip"
          style={{
            ...styles.tip,
            ...(tipSide === 'left' ? styles.tipLeft : styles.tipRight),
            ...(active ? styles.tipVisible : styles.tipHidden),
          }}
        >
          <span
            style={tipSide === 'left' ? styles.tipArrowRightEdge : styles.tipArrow}
            aria-hidden="true"
          />
          {source.tip}
        </div>
      )}
    </div>
  );
}

const styles = {
  // 오른쪽 자료 조사 나침반(340px)과 같은 폭 — 랜딩 3컬럼 좌우 대칭 유지
  wrap:       { width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  wrapCompact: { width: 270 },
  wrapMobile: { width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 },
  heading:    { fontSize: 13, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 2px 2px' },
  list:       { display: 'flex', flexDirection: 'column', gap: 10 },

  cardWrap: { position: 'relative' },
  card: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14,
    padding: '12px 14px', minHeight: 60, boxSizing: 'border-box',
    textDecoration: 'none', color: 'inherit', outline: 'none',
    boxShadow: '0 2px 8px rgba(var(--color-text-rgb),0.08)', transition: 'all 0.15s ease',
  },
  cardActive: {
    border: '1px solid var(--color-primary)', boxShadow: '0 8px 20px rgba(var(--color-primary-rgb),0.14)', transform: 'translateY(-1px)',
  },
  badge: {
    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
    background: 'color-mix(in srgb, var(--color-accent-teal) 16%, var(--color-surface))', border: '1.5px solid var(--color-accent-teal)', color: 'var(--color-text)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 15,
  },
  textCol: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  name: { fontSize: 12, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.3 },
  org:  { fontSize: 12, color: 'var(--color-text-sub)', fontWeight: 600 },
  tipInline: { fontSize: 12, color: 'var(--color-text-sub)', lineHeight: 1.45, marginTop: 2 },

  tip: {
    position: 'absolute', top: '50%',
    background: 'var(--color-primary-dark)', color: 'var(--color-surface)', borderRadius: 12,
    padding: '10px 14px', fontSize: 13, lineHeight: 1.5, width: TIP_WIDTH, boxSizing: 'border-box',
    boxShadow: '0 8px 20px rgba(var(--color-primary-dark-rgb),0.25)', zIndex: 50, pointerEvents: 'none',
    transition: 'opacity 0.18s ease, transform 0.18s ease',
  },
  tipRight: { left: `calc(100% + ${TIP_GAP}px)` },
  tipLeft:  { right: `calc(100% + ${TIP_GAP}px)` },
  // 숨어 있을 때도 절대 위치 박스는 스크롤 폭에 잡힌다. 오른쪽 컬럼에서 가로
  // 스크롤이 생기지 않도록, 보이지 않는 동안에는 배너 안쪽에 접어 둔다.
  tipHidden: {
    opacity: 0, visibility: 'hidden', left: 0, right: 'auto',
    transform: 'translateY(-50%)',
  },
  tipVisible: { opacity: 1, visibility: 'visible', transform: 'translateY(-50%) translateX(0)' },
  tipArrow: {
    position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)',
    width: 0, height: 0,
    borderTop: '6px solid transparent', borderBottom: '6px solid transparent',
    borderRight: '6px solid var(--color-primary-dark)',
  },
  tipArrowRightEdge: {
    position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)',
    width: 0, height: 0,
    borderTop: '6px solid transparent', borderBottom: '6px solid transparent',
    borderLeft: '6px solid var(--color-primary-dark)',
  },
};
