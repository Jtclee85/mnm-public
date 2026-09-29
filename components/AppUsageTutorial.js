import { useEffect, useMemo, useRef, useState } from 'react';

// 화면에 보이는 과정은 6개지만, 모드별 활동과 챗봇 사용법은 작은 장면으로 나눠
// 학생이 한 번에 한 가지 조작만 하도록 한다.
export const APP_TUTORIAL_SCENES = [
  { id: 'topic', chapter: 1, selector: '[data-testid="topic-input"]', contentKey: 'topic' },
  { id: 'source', chapter: 2, selector: '[data-testid="source-textarea"]', contentKey: 'source' },
  { id: 'analyze', chapter: 3, selector: '[data-testid="analyze-button"]', contentKey: 'analyze', actionOnly: true },
  { id: 'easyExplanation', chapter: 4, selector: '[data-testid="tutorial-easy-explanation"]', contentKey: 'easyExplanation' },
  { id: 'understand', chapter: 4, substep: 1, selector: '[data-testid="tutorial-worksheet-understand"]', contentKey: 'understand' },
  { id: 'inquiry', chapter: 4, substep: 2, selector: '[data-testid="tutorial-worksheet-inquiry"]', contentKey: 'inquiry' },
  { id: 'presentation', chapter: 4, substep: 3, selector: '[data-testid="tutorial-worksheet-presentation"]', contentKey: 'presentation' },
  { id: 'writing', chapter: 4, substep: 4, selector: '[data-testid="tutorial-worksheet-writing"]', contentKey: 'writing' },
  { id: 'chatbotOpen', chapter: 5, substep: 1, selector: '[data-testid="chatbot-toggle-button"]', contentKey: 'chatbotOpen', actionOnly: true },
  { id: 'chatbotAsk', chapter: 5, substep: 2, selector: '[data-testid="chatbot-input"]', contentKey: 'chatbotAsk' },
  { id: 'share', chapter: 6, selector: '[data-testid="share-artifact-button"]', contentKey: 'share' },
];

const SPOTLIGHT_PADDING = 8;
const CARD_WIDTH = 370;
const CARD_HEIGHT_ESTIMATE = 245;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function paddedRect(rect) {
  const left = clamp(rect.left - SPOTLIGHT_PADDING, 0, window.innerWidth);
  const top = clamp(rect.top - SPOTLIGHT_PADDING, 0, window.innerHeight);
  const right = clamp(rect.right + SPOTLIGHT_PADDING, 0, window.innerWidth);
  const bottom = clamp(rect.bottom + SPOTLIGHT_PADDING, 0, window.innerHeight);
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export default function AppUsageTutorial({
  isOpen,
  step,
  canAdvance,
  isBusy,
  onNext,
  onPrev,
  onSkip,
  onDontShowAgain,
  onClose,
  onResearchTips,
  onFillTopic,
  onFillSource,
  topicExample,
  sourceExample,
  isMobile,
  text,
  scenes = APP_TUTORIAL_SCENES,
  showDontShowAgain = true,
}) {
  const [targetRect, setTargetRect] = useState(null);
  const [isTypingTopic, setIsTypingTopic] = useState(false);
  const [isPastingSource, setIsPastingSource] = useState(false);
  const animationHandlersRef = useRef({ onFillTopic, onFillSource });
  animationHandlersRef.current = { onFillTopic, onFillSource };
  const scene = scenes[step];

  // 제목은 실제 입력처럼 한 글자씩 보여주고, 조사자료는 Ctrl+V 키를 누른 뒤
  // 한 번에 붙여넣는다. 콜백은 ref로 읽어 부모 재렌더링 때 애니메이션이 재시작되지 않게 한다.
  useEffect(() => {
    if (!isOpen || !scene) return undefined;

    let typingTimer = null;
    let pasteTimer = null;
    let pasteEndTimer = null;

    if (scene.id === 'topic') {
      let characterIndex = 0;
      setIsTypingTopic(true);
      setIsPastingSource(false);
      animationHandlersRef.current.onFillTopic('');
      typingTimer = window.setInterval(() => {
        characterIndex += 1;
        const nextValue = topicExample.slice(0, characterIndex);
        animationHandlersRef.current.onFillTopic(nextValue);
        const input = document.querySelector(scene.selector);
        input?.focus();
        input?.setSelectionRange?.(nextValue.length, nextValue.length);
        if (characterIndex >= topicExample.length) {
          window.clearInterval(typingTimer);
        }
      }, 180);
    } else if (scene.id === 'source') {
      setIsTypingTopic(false);
      setIsPastingSource(true);
      animationHandlersRef.current.onFillSource('');
      pasteTimer = window.setTimeout(() => {
        animationHandlersRef.current.onFillSource(sourceExample);
        const textarea = document.querySelector(scene.selector);
        textarea?.focus();
        textarea?.setSelectionRange?.(sourceExample.length, sourceExample.length);
      }, 700);
      pasteEndTimer = window.setTimeout(() => setIsPastingSource(false), 1450);
    } else {
      setIsTypingTopic(false);
      setIsPastingSource(false);
    }

    return () => {
      if (typingTimer) window.clearInterval(typingTimer);
      if (pasteTimer) window.clearTimeout(pasteTimer);
      if (pasteEndTimer) window.clearTimeout(pasteEndTimer);
    };
  }, [isOpen, scene?.id, sourceExample, topicExample]);

  useEffect(() => {
    if (!isOpen || !scene) return undefined;

    let target = null;
    let resizeObserver = null;
    let frame = null;

    const updateTarget = () => {
      target = document.querySelector(scene.selector);
      if (!target) {
        setTargetRect(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setTargetRect(paddedRect(rect));
    };

    const revealTarget = () => {
      target = document.querySelector(scene.selector);
      if (target) target.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
      frame = requestAnimationFrame(() => requestAnimationFrame(updateTarget));
    };

    revealTarget();
    const mutationObserver = new MutationObserver(updateTarget);
    mutationObserver.observe(document.body, { childList: true, subtree: true, attributes: true });
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateTarget);
      resizeObserver.observe(document.body);
    }
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, true);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
    };
  }, [isOpen, scene]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const cardPosition = useMemo(() => {
    if (!targetRect) {
      return { left: 12, right: 12, bottom: 12, width: 'auto' };
    }
    if (isMobile) {
      return targetRect.top > window.innerHeight * 0.52
        ? { left: 12, right: 12, top: 12, width: 'auto' }
        : { left: 12, right: 12, bottom: 12, width: 'auto' };
    }
    const width = Math.min(CARD_WIDTH, window.innerWidth - 32);
    const roomLeft = targetRect.left;
    const roomRight = window.innerWidth - targetRect.right;
    const verticalTop = clamp(targetRect.top, 16, window.innerHeight - CARD_HEIGHT_ESTIMATE - 16);
    // 워크시트처럼 큰 영역을 강조할 때는 설명 카드가 내용을 덮지 않도록
    // 비어 있는 좌우 공간을 먼저 사용한다.
    if (roomLeft >= width + 32) return { left: 16, top: verticalTop, width };
    if (roomRight >= width + 32) return { right: 16, top: verticalTop, width };
    const left = clamp(targetRect.left + (targetRect.width - width) / 2, 16, window.innerWidth - width - 16);
    const roomBelow = window.innerHeight - targetRect.bottom;
    if (roomBelow >= CARD_HEIGHT_ESTIMATE + 20) {
      return { left, top: targetRect.bottom + 16, width };
    }
    return { left, bottom: window.innerHeight - targetRect.top + 16, width };
  }, [isMobile, targetRect]);

  if (!isOpen || !scene) return null;

  const content = text.scenes[scene.contentKey];
  const isLast = step === scenes.length - 1;
  const substepTotal = scene.substepTotal || (scene.chapter === 4 ? 4 : 2);
  const modeProgress = scene.chapter === 4 && scene.substep
    ? `${text.modeLabel} ${scene.substep} / ${substepTotal}`
    : scene.chapter === 5 && scene.substep
      ? `${text.substepLabel} ${scene.substep} / ${substepTotal}`
      : null;

  return (
    <div data-testid="app-usage-tutorial" aria-live="polite">
      <style>{`
        @keyframes aut-pulse {
          0%, 100% { box-shadow: 0 0 0 3px var(--color-gold), 0 0 0 8px rgba(var(--color-gold-rgb),0.28); }
          50% { box-shadow: 0 0 0 4px var(--color-gold), 0 0 0 14px rgba(var(--color-gold-rgb),0.12); }
        }
        @keyframes aut-card-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes aut-paste-key {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.78); }
          35%, 72% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes aut-caret {
          0%, 45% { opacity: 1; }
          46%, 100% { opacity: 0; }
        }
        .aut-spotlight { animation: aut-pulse 1.6s ease-in-out infinite; }
        .aut-card { animation: aut-card-in 180ms ease-out; }
        .aut-paste-key { animation: aut-paste-key 1.45s ease-out both; }
        .aut-typing-caret { animation: aut-caret 0.7s steps(1, end) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .aut-spotlight, .aut-card, .aut-paste-key, .aut-typing-caret { animation: none !important; }
        }
      `}</style>

      {targetRect ? (
        <>
          <div aria-hidden="true" style={{ ...s.dim, left: 0, top: 0, right: 0, height: targetRect.top }} />
          <div aria-hidden="true" style={{ ...s.dim, left: 0, top: targetRect.top, width: targetRect.left, height: targetRect.height }} />
          <div aria-hidden="true" style={{ ...s.dim, left: targetRect.right, top: targetRect.top, right: 0, height: targetRect.height }} />
          <div aria-hidden="true" style={{ ...s.dim, left: 0, top: targetRect.bottom, right: 0, bottom: 0 }} />
          <div
            data-testid="app-tutorial-spotlight"
            className="aut-spotlight"
            aria-hidden="true"
            style={{ ...s.spotlight, ...targetRect }}
          />
        </>
      ) : (
        <div aria-hidden="true" style={{ ...s.dim, inset: 0 }} />
      )}

      {isTypingTopic && targetRect && (
        <span
          data-testid="app-tutorial-typing-caret"
          className="aut-typing-caret"
          aria-hidden="true"
          style={{ ...s.typingCaret, left: targetRect.right - 22, top: targetRect.top + targetRect.height / 2 }}
        >▌</span>
      )}

      {isPastingSource && targetRect && (
        <div
          data-testid="app-tutorial-paste-animation"
          className="aut-paste-key"
          aria-hidden="true"
          style={{ ...s.pasteAnimation, left: targetRect.left + targetRect.width / 2, top: targetRect.top + targetRect.height / 2 }}
        >
          <kbd style={s.keycap}>Ctrl</kbd><span style={s.keyPlus}>+</span><kbd style={s.keycap}>V</kbd>
        </div>
      )}

      <section
        role="dialog"
        aria-label={text.name}
        data-testid="app-tutorial-coach"
        className="aut-card"
        style={{ ...s.card, ...cardPosition, ...(isMobile ? s.cardMobile : {}) }}
      >
        <div style={s.cardHeader}>
          <div>
            <div style={s.progress}>{text.processLabel} {scene.chapter} / 6</div>
            {modeProgress && <div style={s.subProgress}>{modeProgress}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label={text.close} style={s.closeBtn}>✕</button>
        </div>

        <h2 style={s.title}>{content.title}</h2>
        <p style={s.body}>{content.body}</p>

        {!targetRect && <p style={s.waiting}>{text.waiting}</p>}
        {scene.actionOnly && targetRect && <p style={s.actionHint}>☝️ {text.useHighlighted}</p>}
        {!scene.actionOnly && !canAdvance && <p style={s.requirement}>✏️ {content.requirement}</p>}

        {/* 마지막 과정은 '마치기' 하나가 아니라 다음 행동 두 가지로 나눠 제시한다.
            오프라인 시연(onResearchTips 없음)은 기존 '시연 마치기' 버튼을 그대로 쓴다. */}
        {isLast && onResearchTips && (
          <div style={s.finalChoices}>
            <button
              type="button"
              data-testid="app-tutorial-back-to-start"
              onClick={onResearchTips}
              style={s.finalChoiceBtn}
            >
              {text.backToStart}
            </button>
            <button
              type="button"
              data-testid="app-tutorial-explore-results"
              onClick={onNext}
              disabled={isBusy}
              style={{ ...s.finalChoiceBtn, ...s.finalChoicePrimary, ...(isBusy ? s.disabledBtn : {}) }}
            >
              {isBusy ? text.preparing : text.exploreResults}
            </button>
          </div>
        )}

        <div style={s.actions}>
          <button type="button" onClick={onSkip} style={s.skipBtn}>{text.skip}</button>
          <div style={s.actionRight}>
            {step > 0 && (
              <button type="button" onClick={onPrev} disabled={isBusy} style={s.secondaryBtn}>{text.previous}</button>
            )}
            {!scene.actionOnly && !(isLast && onResearchTips) && (
              <button
                type="button"
                onClick={onNext}
                disabled={!canAdvance || isBusy || !targetRect}
                style={{ ...s.primaryBtn, ...((!canAdvance || isBusy || !targetRect) ? s.disabledBtn : {}) }}
              >
                {isBusy ? text.preparing : (isLast ? text.finish : text.next)}
              </button>
            )}
          </div>
        </div>

        {showDontShowAgain && (
          <button type="button" onClick={onDontShowAgain} style={s.dontShowBtn}>{text.dontShowAgain}</button>
        )}
      </section>
    </div>
  );
}

const s = {
  dim: {
    position: 'fixed', zIndex: 1400, background: 'rgba(var(--color-text-rgb),0.72)',
    backdropFilter: 'blur(1px)',
  },
  spotlight: {
    position: 'fixed', zIndex: 1401, borderRadius: 14, pointerEvents: 'none',
  },
  typingCaret: {
    position: 'fixed', zIndex: 1403, transform: 'translate(-50%, -50%)',
    color: 'var(--color-primary-dark)', fontSize: 24, fontWeight: 900, pointerEvents: 'none',
  },
  pasteAnimation: {
    position: 'fixed', zIndex: 1403, transform: 'translate(-50%, -50%)',
    display: 'flex', alignItems: 'center', gap: 9, pointerEvents: 'none',
    padding: '14px 18px', borderRadius: 16,
    background: 'rgba(var(--color-text-rgb),0.9)',
    boxShadow: '0 14px 36px rgba(var(--color-text-rgb),0.34)',
  },
  keycap: {
    minWidth: 46, padding: '8px 11px', borderRadius: 9, textAlign: 'center',
    border: '2px solid var(--color-border)', borderBottomWidth: 5,
    background: 'var(--color-surface)', color: 'var(--color-text)',
    fontFamily: 'inherit', fontSize: 17, fontWeight: 900,
  },
  keyPlus: { color: 'var(--color-surface)', fontSize: 19, fontWeight: 900 },
  card: {
    position: 'fixed', zIndex: 1402, boxSizing: 'border-box',
    border: '2px solid var(--color-primary)', borderRadius: 20,
    background: 'var(--color-surface)', boxShadow: '0 20px 55px rgba(var(--color-text-rgb),0.34)',
    padding: '20px 22px 16px', color: 'var(--color-text)',
  },
  cardMobile: { maxHeight: '46vh', overflowY: 'auto', borderRadius: 18, padding: '17px 18px 14px' },
  cardHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  progress: { fontSize: 14, fontWeight: 900, color: 'var(--color-primary-dark)' },
  subProgress: { marginTop: 3, fontSize: 12.5, fontWeight: 800, color: 'var(--color-text-sub)' },
  closeBtn: {
    width: 34, height: 34, flexShrink: 0, border: '1px solid var(--color-border)', borderRadius: 10,
    background: 'var(--color-surface)', color: 'var(--color-text-sub)', fontSize: 15, cursor: 'pointer',
  },
  title: { margin: '12px 0 6px', fontSize: 22, lineHeight: 1.4, fontWeight: 900 },
  body: { margin: 0, fontSize: 16, lineHeight: 1.7, color: 'var(--color-text-sub)', whiteSpace: 'pre-line' },
  waiting: { margin: '12px 0 0', fontSize: 14, fontWeight: 800, color: 'var(--color-primary-dark)' },
  actionHint: {
    margin: '12px 0 0', padding: '9px 12px', borderRadius: 10,
    background: 'rgba(var(--color-accent-teal-rgb),0.12)', color: 'var(--color-primary-dark)',
    fontSize: 14, fontWeight: 900,
  },
  requirement: { margin: '10px 0 0', fontSize: 13.5, fontWeight: 800, color: 'var(--color-text-sub)' },
  // 마지막 과정의 두 갈래 — 좁은 카드에서 나란히 두면 글자가 줄바꿈되므로 세로로 쌓는다.
  finalChoices: { marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 },
  finalChoiceBtn: {
    display: 'block', width: '100%', padding: '11px 14px',
    border: '1px solid rgba(var(--color-accent-teal-rgb),0.5)', borderRadius: 12,
    background: 'rgba(var(--color-accent-teal-rgb),0.12)', color: 'var(--color-primary-dark)',
    fontSize: 14, fontWeight: 900, lineHeight: 1.45, textAlign: 'center', cursor: 'pointer',
  },
  finalChoicePrimary: {
    border: 'none',
    background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
    color: 'var(--color-surface)',
  },
  actions: { marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  actionRight: { display: 'flex', gap: 8 },
  skipBtn: {
    border: 'none', background: 'transparent', color: 'var(--color-text-sub)',
    fontSize: 13.5, fontWeight: 700, padding: '10px 4px', cursor: 'pointer',
  },
  secondaryBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
    borderRadius: 11, padding: '10px 14px', fontSize: 14, fontWeight: 800, cursor: 'pointer',
  },
  primaryBtn: {
    border: 'none', borderRadius: 11, padding: '10px 17px',
    background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
    color: 'var(--color-surface)', fontSize: 14.5, fontWeight: 900, cursor: 'pointer',
  },
  disabledBtn: { opacity: 0.45, cursor: 'not-allowed' },
  dontShowBtn: {
    display: 'block', margin: '8px auto 0', border: 'none', background: 'transparent',
    color: 'var(--color-text-sub)', fontSize: 12, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer',
  },
};
