import { useEffect, useRef, useState } from 'react';

// 학생용 학급 코드 입력 창. 사용법을 마친 뒤, 학급 없이 AI 기능을 누른 뒤, 머리글의
// '학급 코드' 버튼으로 열린다. 학생 화면에는 AI 키를 보여주지 않고 학급 코드만 받는다.
export default function ClassCodeDialog({
  isOpen,
  text,
  session,
  requiredNotice = '',
  isMobile,
  onJoin,
  onLeave,
  onClose,
}) {
  const [draft, setDraft] = useState('');
  // idle | joining | success | error | left
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    setDraft('');
    setStatus('idle');
    setMessage('');
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && status !== 'joining') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, status, onClose]);

  if (!isOpen) return null;

  const isJoining = status === 'joining';

  const handleJoin = async (event) => {
    event?.preventDefault();
    if (isJoining) return;
    if (!draft.trim()) {
      setStatus('error');
      setMessage(text.emptyInput);
      return;
    }
    setStatus('joining');
    setMessage('');
    const result = await onJoin?.(draft);
    if (!result?.ok) {
      setStatus('error');
      setMessage(text.errors[result?.code] || text.errors.class_code_invalid);
      return;
    }
    setDraft('');
    setStatus('success');
    setMessage(text.statusJoined);
  };

  const handleLeave = () => {
    onLeave?.();
    setStatus('left');
    setMessage(text.statusLeft);
  };

  return (
    <div style={s.overlay} data-testid="class-code-dialog-overlay">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-code-dialog-title"
        data-testid="class-code-dialog"
        style={{ ...s.box, ...(isMobile ? s.boxMobile : {}) }}
      >
        <div style={s.headerBar}>
          <h2 id="class-code-dialog-title" style={s.title}>{text.title}</h2>
          <button type="button" onClick={onClose} aria-label={text.close} title={text.close} style={s.closeBtn} disabled={isJoining}>✕</button>
        </div>

        <div style={s.body}>
          {requiredNotice && (
            <p role="alert" data-testid="class-code-required-notice" style={s.requiredNotice}>{requiredNotice}</p>
          )}
          <p style={s.intro}>{text.intro}</p>

          {session && (
            <div style={s.savedBox} data-testid="class-code-current">
              <span style={s.savedLabel}>{text.joinedLabel}</span>
              <strong style={s.savedValue}>{session.code}</strong>
              <span style={s.savedWhere}>{text.expiresNote}</span>
            </div>
          )}

          <form onSubmit={handleJoin} style={s.form}>
            <label htmlFor="class-code-input" style={s.inputLabel}>{text.inputLabel}</label>
            <input
              ref={inputRef}
              id="class-code-input"
              data-testid="class-code-input"
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={text.inputPlaceholder}
              aria-describedby="class-code-example"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={isJoining}
              style={s.input}
            />
            <span id="class-code-example" style={s.example}>{text.example}</span>

            <div
              role="status"
              aria-live="polite"
              data-testid="class-code-status"
              data-status={status}
              style={status === 'error' ? s.statusError : (message ? s.statusOk : s.statusEmpty)}
            >
              {isJoining ? text.joining : message}
            </div>

            <div style={s.actions}>
              {session && (
                <button type="button" data-testid="class-code-leave" onClick={handleLeave} style={s.leaveBtn} disabled={isJoining}>
                  {text.leave}
                </button>
              )}
              <button type="button" data-testid="class-code-later" onClick={onClose} style={s.secondaryBtn} disabled={isJoining}>
                {session ? text.close : text.later}
              </button>
              <button type="submit" data-testid="class-code-join" style={{ ...s.primaryBtn, ...(isJoining ? s.disabled : {}) }} disabled={isJoining}>
                {isJoining ? text.joining : text.join}
              </button>
            </div>
          </form>

          <a href="/teacher" data-testid="class-code-teacher-link" style={s.teacherLink}>{text.teacherLink} →</a>
        </div>
      </section>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1500,
    background: 'rgba(var(--color-text-rgb),0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  box: {
    width: 'min(520px, 100%)', maxHeight: '92vh', overflowY: 'auto',
    background: 'var(--color-surface)', borderRadius: 20,
    boxShadow: '0 24px 60px rgba(var(--color-text-rgb),0.3)',
  },
  boxMobile: { borderRadius: 16 },
  headerBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: '14px 18px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-alt)',
  },
  title: { margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--color-text)' },
  closeBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-sub)',
    width: 32, height: 32, borderRadius: 8, fontSize: 14, lineHeight: 1, cursor: 'pointer', flexShrink: 0,
  },
  body: { padding: 18, display: 'flex', flexDirection: 'column', gap: 12 },
  requiredNotice: {
    margin: 0, padding: '10px 14px', borderRadius: 12, fontSize: 15, fontWeight: 700, lineHeight: 1.5,
    color: 'var(--color-text)',
    background: 'color-mix(in srgb, var(--color-gold) 18%, var(--color-surface))',
    border: '1px solid rgba(var(--color-gold-rgb),0.6)',
  },
  intro: { margin: 0, fontSize: 16, lineHeight: 1.6, color: 'var(--color-text)', fontWeight: 700 },
  savedBox: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12,
    background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
  },
  savedLabel: { fontSize: 14, fontWeight: 800, color: 'var(--color-text)' },
  savedValue: { fontSize: 17, color: 'var(--color-text)' },
  savedWhere: { fontSize: 13, color: 'var(--color-text-sub)', flexBasis: '100%' },
  form: { display: 'flex', flexDirection: 'column', gap: 8 },
  inputLabel: { fontSize: 15, fontWeight: 800, color: 'var(--color-text)' },
  input: {
    width: '100%', boxSizing: 'border-box', fontSize: 20, fontWeight: 700, padding: '12px 14px', borderRadius: 10,
    border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
  },
  example: { fontSize: 13, color: 'var(--color-text-sub)' },
  statusEmpty: { minHeight: 0 },
  statusOk: {
    margin: 0, fontSize: 14, lineHeight: 1.6, fontWeight: 700, color: 'var(--color-text)', padding: '10px 12px', borderRadius: 10,
    background: 'color-mix(in srgb, var(--color-accent-teal) 12%, var(--color-surface))',
    border: '1px solid rgba(var(--color-accent-teal-rgb),0.45)',
  },
  // 실패 상태(빨강 계열)는 의미 전달용이라 의도적으로 코랄 톤을 사용
  statusError: {
    margin: 0, fontSize: 14, lineHeight: 1.6, fontWeight: 700, color: 'var(--color-text)', padding: '10px 12px', borderRadius: 10,
    background: 'color-mix(in srgb, var(--color-coral) 14%, var(--color-surface))',
    border: '1px solid rgba(var(--color-coral-rgb),0.5)',
  },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 4 },
  secondaryBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
    fontWeight: 700, fontSize: 15, padding: '10px 16px', minHeight: 44, borderRadius: 12, cursor: 'pointer',
  },
  leaveBtn: {
    marginRight: 'auto',
    border: '1px solid rgba(var(--color-coral-rgb),0.6)', background: 'var(--color-surface)', color: 'var(--color-text)',
    fontWeight: 700, fontSize: 15, padding: '10px 16px', minHeight: 44, borderRadius: 12, cursor: 'pointer',
  },
  primaryBtn: {
    border: 'none',
    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
    color: 'var(--color-surface)', fontWeight: 800, fontSize: 15, padding: '10px 18px', minHeight: 44, borderRadius: 12, cursor: 'pointer',
  },
  disabled: { opacity: 0.6, cursor: 'wait' },
  teacherLink: {
    alignSelf: 'flex-start', fontSize: 14, fontWeight: 700, color: 'var(--color-primary-dark)',
    textDecoration: 'underline', textUnderlineOffset: 3,
  },
};
