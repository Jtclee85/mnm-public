import { useEffect, useState } from 'react';
import { RESEARCH_TIPS, pickNextTipIndex } from '../lib/researchTips';

// 모드별 로딩 안내 문구 — 지금 무엇을 만들고 있는지 알려준다.
const MODE_LOADING_TITLES = {
  understand: '쉬운 설명을 준비하고 있어요...',
  inquiry: '탐구 질문을 만들고 있어요...',
  presentation: '발표 준비 자료를 정리하고 있어요...',
  writing: '글쓰기 준비 자료를 정리하고 있어요...',
};

const TIP_ROTATE_MS = 3800;

// 분석 로딩 중 자료조사 꿀팁을 돌아가며 보여주는 카드.
// 기존 로딩 스피너 영역 안에 들어가는 형태라 전체화면 모달이 아니다.
export default function ResearchLoadingTips({ mode, t, isMobile }) {
  const [tipIndex, setTipIndex] = useState(() => pickNextTipIndex(-1));

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex(prev => pickNextTipIndex(prev));
    }, TIP_ROTATE_MS);
    return () => clearInterval(interval);
  }, []);

  const loadingTitle =
    MODE_LOADING_TITLES[mode] || t?.loadingTipPreparing || '자료를 살펴보고 있어요...';
  const tipTitle = t?.loadingTipTitle || '오늘의 자료조사 꿀팁';

  return (
    <div data-testid="research-loading-tips" style={styles.wrap}>
      <div style={styles.spinner} aria-hidden="true" />
      <p style={styles.loadingTitle} role="status">{loadingTitle}</p>

      <div style={{ ...styles.tipCard, ...(isMobile ? styles.tipCardMobile : {}) }}>
        <span style={styles.tipBadge}>💡 {tipTitle}</span>
        {/* key로 문장이 바뀔 때마다 부드러운 페이드 인 애니메이션을 다시 적용한다 */}
        <p key={tipIndex} className="research-tip-text" style={styles.tipText}>
          {RESEARCH_TIPS[tipIndex]}
        </p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes research-tip-fade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .research-tip-text { animation: research-tip-fade 0.4s ease; }
        @media (prefers-reduced-motion: reduce) {
          .research-tip-text { animation: none; }
        }
      ` }} />
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '48px 20px', gap: 16, textAlign: 'center',
  },
  spinner: {
    width: 36, height: 36,
    border: '4px solid var(--color-border)', borderTop: '4px solid var(--color-primary)',
    borderRadius: '50%', animation: 'cv-spin 1s linear infinite',
  },
  loadingTitle: { color: 'var(--color-text-sub)', fontSize: 14, fontWeight: 700, margin: 0 },
  tipCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    background: 'color-mix(in srgb, var(--color-gold) 10%, var(--color-surface))',
    border: '1px solid color-mix(in srgb, var(--color-gold) 45%, var(--color-border))',
    borderRadius: 14, padding: '14px 18px', maxWidth: 420, boxSizing: 'border-box',
  },
  tipCardMobile: { maxWidth: '100%', padding: '12px 14px' },
  tipBadge: { fontSize: 12, fontWeight: 800, color: 'var(--color-text)' },
  tipText: {
    margin: 0, color: 'var(--color-text)', fontSize: 14, lineHeight: 1.7,
    wordBreak: 'keep-all', minHeight: 44,
  },
};
