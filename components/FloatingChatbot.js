import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import ChatBubble from './ChatBubble';

const OFFLINE_DEMO_MODE = process.env.NEXT_PUBLIC_OFFLINE_DEMO_MODE === 'true';

const POPUP_CSS = `
  @keyframes chatbot-pop-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes chatbot-slide-up {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes chatbot-loading-dot {
    0%, 80%, 100% { opacity: 0.35; transform: translateY(0); }
    40% { opacity: 1; transform: translateY(-3px); }
  }
  .chatbot-loading-dot { animation: chatbot-loading-dot 1s ease-in-out infinite; }
  .chatbot-loading-dot:nth-child(2) { animation-delay: 0.14s; }
  .chatbot-loading-dot:nth-child(3) { animation-delay: 0.28s; }
  .chatbot-fab:hover {
    transform: translateY(-3px);
    box-shadow: 0 14px 32px rgba(var(--color-primary-rgb),0.35);
  }
  .chatbot-fab:active { transform: translateY(0) scale(0.95); }
  .chatbot-fab:focus-visible {
    outline: 3px solid var(--color-primary);
    outline-offset: 3px;
  }
  .chatbot-fab[aria-expanded="true"] {
    border-color: var(--color-primary);
    box-shadow: 0 6px 18px rgba(var(--color-primary-rgb),0.30);
  }
  .chatbot-fab-tooltip {
    position: absolute;
    right: 0;
    bottom: calc(100% + 10px);
    padding: 6px 12px;
    border-radius: 10px;
    background: var(--color-text);
    color: var(--color-surface);
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 0.15s, transform 0.15s;
  }
  .chatbot-fab:hover .chatbot-fab-tooltip,
  .chatbot-fab:focus-visible .chatbot-fab-tooltip {
    opacity: 1;
    transform: translateY(0);
  }
  @media (prefers-reduced-motion: reduce) {
    .chatbot-anim, .chatbot-loading-dot { animation: none !important; transition: none !important; }
    .chatbot-fab:hover, .chatbot-fab:active { transform: none !important; }
  }
`;

/**
 * 우하단 플로팅 챗봇 버튼 + 팝업.
 * 기존 왼쪽 패널 '대화' 탭에 있던 채팅 상태/전송 로직(conversation, chatInput,
 * onSend 등)은 pages/index.js가 그대로 들고 있고, 이 컴포넌트는 그 위에 UI만 얹는다.
 */
export default function FloatingChatbot({
  isOpen, onOpen, onClose,
  conversation, chatInput, setChatInput, onSend,
  isChatLoading, isMobile, topic, t,
}) {
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const popupRef = useRef(null);

  // 데스크탑 팝업 위치. null이면 기본 위치(우하단 버튼 위), 드래그하면 {x, y}로 고정된다.
  const [dragPos, setDragPos] = useState(null);

  const handleHeaderPointerDown = (e) => {
    if (isMobile || e.button !== 0 || e.target.closest('button')) return;
    const popup = popupRef.current;
    if (!popup) return;
    e.preventDefault();
    const rect = popup.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    const onMove = (ev) => {
      setDragPos({
        x: Math.min(Math.max(ev.clientX - offsetX, 8), window.innerWidth - rect.width - 8),
        y: Math.min(Math.max(ev.clientY - offsetY, 8), window.innerHeight - rect.height - 8),
      });
    };
    const onUp = () => window.removeEventListener('pointermove', onMove);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation, isOpen, isChatLoading]);

  useEffect(() => {
    if (isOpen && !isChatLoading && inputRef.current) {
      try { inputRef.current.focus({ preventScroll: true }); }
      catch { inputRef.current.focus(); }
    }
  }, [isOpen, isChatLoading]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleSubmit = () => {
    onSend();
  };

  const popupBody = (
    <>
      <div
        style={{ ...s.header, ...(isMobile ? {} : s.headerDraggable) }}
        onPointerDown={handleHeaderPointerDown}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.headerTitle}>{t.chatbotTitle}</div>
          {topic && (
            <div style={s.headerTopic}>{topic}</div>
          )}
        </div>
        <button onClick={onClose} aria-label={t.close} style={s.closeBtn}>✕</button>
      </div>

      <div ref={bodyRef} style={{ ...s.body, ...(isMobile ? s.bodyMobile : {}) }}>
        {conversation.map((msg, idx) => (
          <ChatBubble
            key={`${msg.role}-${idx}-${msg.content.slice(0, 10)}`}
            role={msg.role}
            content={msg.content}
            isMobile={isMobile}
          />
        ))}
        {isChatLoading && (
          <div
            data-testid="chatbot-loading-indicator"
            role="status"
            aria-live="polite"
            style={s.loadingRow}
          >
            <div style={{ ...s.loadingBubble, ...(isMobile ? s.loadingBubbleMobile : {}) }}>
              <span aria-hidden="true" style={s.loadingDots}>
                <span className="chatbot-loading-dot" style={s.loadingDot} />
                <span className="chatbot-loading-dot" style={s.loadingDot} />
                <span className="chatbot-loading-dot" style={s.loadingDot} />
              </span>
              <span>{t.sending}</span>
            </div>
          </div>
        )}
      </div>

      <div style={s.inputRow}>
        <textarea
          ref={inputRef}
          data-testid="chatbot-input"
          style={{ ...s.textarea, ...(isMobile ? s.textareaMobile : {}) }}
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          placeholder={t.chatPlaceholder}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
          }}
          disabled={isChatLoading}
        />
        <button
          data-testid="chatbot-send-button"
          style={s.sendBtn}
          onClick={handleSubmit}
          disabled={isChatLoading}
        >
          {isChatLoading ? t.sending : t.sendQuestion}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* SSR 시 텍스트 자식의 따옴표가 &quot;로 이스케이프되어 hydration 불일치가
          나므로(데모 랜딩에서 서버 렌더됨) dangerouslySetInnerHTML로 넣는다. */}
      <style dangerouslySetInnerHTML={{ __html: POPUP_CSS }} />

      {/* 모바일에서 팝업이 열려 있을 때는 바텀시트가 버튼 자리를 덮으므로,
          팝업 헤더의 닫기 버튼과 겹치지 않게 플로팅 버튼을 숨긴다. */}
      {!(isMobile && isOpen) && (
        <button
          type="button"
          data-testid="chatbot-toggle-button"
          aria-label={t.chatbotButtonLabel}
          aria-expanded={isOpen}
          onClick={() => (isOpen ? onClose() : onOpen())}
          className="chatbot-anim chatbot-fab"
          style={{ ...s.fab, ...(isMobile ? s.fabMobile : {}) }}
        >
          {OFFLINE_DEMO_MODE ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="../assets/chatbot-mascot.png"
              alt=""
              aria-hidden="true"
              width={isMobile ? 64 : 144}
              height={isMobile ? 64 : 144}
              style={s.fabImage}
            />
          ) : (
            <Image
              src="/chatbot-mascot.png"
              alt=""
              aria-hidden="true"
              width={isMobile ? 64 : 144}
              height={isMobile ? 64 : 144}
              style={s.fabImage}
            />
          )}
          {!isMobile && (
            <span className="chatbot-fab-tooltip" aria-hidden="true">
              {t.chatbotButtonLabel}
            </span>
          )}
        </button>
      )}

      {isOpen && !isMobile && (
        <div
          ref={popupRef}
          role="dialog"
          aria-label={t.chatbotTitle}
          data-testid="chatbot-popup"
          className="chatbot-anim"
          style={{
            ...s.popupDesktop,
            ...(dragPos
              ? { left: dragPos.x, top: dragPos.y, right: 'auto', bottom: 'auto' }
              : {}),
          }}
        >
          {popupBody}
        </div>
      )}

      {isOpen && isMobile && (
        <>
          <div
            onClick={onClose}
            aria-hidden="true"
            style={s.overlay}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.chatbotTitle}
            data-testid="chatbot-popup"
            className="chatbot-anim"
            style={s.popupMobile}
          >
            {popupBody}
          </div>
        </>
      )}
    </>
  );
}

const s = {
  fab: {
    position: 'fixed', right: 20, bottom: 20, zIndex: 950,
    width: 144, height: 144,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid var(--color-border)', borderRadius: 999,
    background: 'var(--color-surface)',
    padding: 4, cursor: 'pointer',
    boxShadow: '0 10px 26px rgba(var(--color-text-rgb),0.18)',
    transition: 'box-shadow 0.15s, transform 0.15s, border-color 0.15s',
  },
  fabMobile: {
    right: 14, bottom: 'calc(14px + env(safe-area-inset-bottom))',
    width: 64, height: 64,
  },
  fabImage: {
    width: '100%', height: '100%', objectFit: 'contain',
    transform: 'scale(1.04)', pointerEvents: 'none',
  },

  overlay: {
    position: 'fixed', inset: 0, zIndex: 945, background: 'rgba(0,0,0,0.3)',
  },

  popupDesktop: {
    position: 'fixed', right: 28, bottom: 176, zIndex: 951,
    width: 360, height: 480, maxHeight: 'calc(100vh - 200px)',
    display: 'flex', flexDirection: 'column',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 18, boxShadow: '0 18px 48px rgba(0,0,0,0.25)', overflow: 'hidden',
    opacity: 1, transform: 'translateY(0) scale(1)',
    animation: 'chatbot-pop-in 180ms ease',
  },
  popupMobile: {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 946,
    height: '78vh',
    display: 'flex', flexDirection: 'column',
    background: 'var(--color-surface)',
    borderRadius: '18px 18px 0 0',
    boxShadow: '0 -8px 32px rgba(0,0,0,0.2)', overflow: 'hidden',
    animation: 'chatbot-slide-up 180ms ease',
  },

  header: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '12px 14px', borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface-alt)', flexShrink: 0,
  },
  headerDraggable: { cursor: 'grab', userSelect: 'none', touchAction: 'none' },
  headerTitle: { fontWeight: 900, fontSize: 14, color: 'var(--color-text)' },
  headerTopic: {
    fontSize: 11, color: 'var(--color-text-sub)', marginTop: 1,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  closeBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-sub)',
    borderRadius: 8, width: 28, height: 28, cursor: 'pointer', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, fontWeight: 700, padding: 0,
  },

  body: { flex: 1, overflowY: 'auto', padding: 14, background: 'var(--color-bg)' },
  bodyMobile: { padding: 10 },
  loadingRow: { display: 'flex', justifyContent: 'flex-start', marginBottom: 10 },
  loadingBubble: {
    display: 'inline-flex', alignItems: 'center', gap: 9,
    border: '1px solid var(--color-border)', borderRadius: 16,
    padding: '11px 14px', background: 'var(--color-surface)',
    color: 'var(--color-text-sub)', fontSize: 14, fontWeight: 800,
    boxShadow: '0 6px 18px rgba(var(--color-text-rgb),0.06)',
  },
  loadingBubbleMobile: { padding: '10px 12px', fontSize: 13 },
  loadingDots: { display: 'inline-flex', alignItems: 'center', gap: 3 },
  loadingDot: {
    display: 'block', width: 6, height: 6, borderRadius: 999,
    background: 'var(--color-primary)',
  },

  inputRow: {
    display: 'flex', flexDirection: 'column', gap: 8,
    padding: 12, borderTop: '1px solid var(--color-border)', flexShrink: 0,
    background: 'var(--color-surface)',
  },
  textarea: {
    width: '100%', minHeight: 56, maxHeight: 120, border: '1px solid var(--color-border)',
    borderRadius: 12, padding: '10px 12px', fontSize: 14, lineHeight: 1.6,
    resize: 'vertical', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', color: 'var(--color-text)', background: 'var(--color-surface)',
  },
  textareaMobile: { minHeight: 48, fontSize: 16, padding: '10px 12px' },
  sendBtn: {
    border: 'none', background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
    color: 'var(--color-surface)', fontWeight: 800, padding: '10px 16px', borderRadius: 12,
    cursor: 'pointer', fontSize: 13,
  },
};
