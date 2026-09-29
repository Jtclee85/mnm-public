import { useEffect, useRef, useState } from 'react';
import { AI_KEY_HEADER, GEMINI_KEY_ISSUE_URL } from '../lib/aiProviderConfig';

// Gemini API 키 설정 창. 사용법을 마친 뒤, 키 없이 AI 기능을 누른 뒤, 머리글의
// 'AI 키 설정' 버튼으로 열린다. 입력한 키는 연결 확인에 성공한 뒤에만 저장한다.
// 저장된 키는 부모가 끝 4자리만 남겨 넘겨주며, 전체 키를 화면에 다시 그리지 않는다.
export default function AiKeySettingsDialog({
  isOpen,
  text,
  savedKeyMask,
  savedRemember,
  requiredNotice = '',
  isMobile,
  onSave,
  onDelete,
  onClose,
}) {
  const [draft, setDraft] = useState('');
  const [reveal, setReveal] = useState(false);
  const [remember, setRemember] = useState(false);
  // idle | verifying | success | error | deleted
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const inputRef = useRef(null);

  // 창이 새로 열릴 때만 초기화한다. 저장 직후 savedRemember가 바뀌어도 성공 안내가 지워지지 않게
  // 의존성에서 뺀다.
  useEffect(() => {
    if (!isOpen) return;
    setDraft('');
    setReveal(false);
    setRemember(!!savedRemember);
    setStatus('idle');
    setMessage('');
    // 창이 열리면 바로 붙여 넣을 수 있게 입력칸에 초점을 둔다.
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape' && status !== 'verifying') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, status, onClose]);

  if (!isOpen) return null;

  const isVerifying = status === 'verifying';

  const handleVerify = async (event) => {
    event?.preventDefault();
    if (isVerifying) return;
    const candidate = draft.trim();
    if (!candidate) {
      setStatus('error');
      setMessage(text.emptyInput);
      return;
    }

    setStatus('verifying');
    setMessage('');
    let data = {};
    let ok = false;
    try {
      const res = await fetch('/api/verify-ai-key', {
        method: 'POST',
        headers: { [AI_KEY_HEADER]: candidate },
      });
      data = await res.json().catch(() => ({}));
      ok = res.ok && data.ok === true;
    } catch {
      data = { code: 'network' };
    }

    if (!ok) {
      setStatus('error');
      setMessage(text.errors[data.code] || text.errors.invalid_key);
      return;
    }

    onSave?.(candidate, { remember });
    setDraft('');
    setReveal(false);
    setStatus('success');
    setMessage(text.statusSuccess);
  };

  const handleDelete = () => {
    onDelete?.();
    setDraft('');
    setRemember(false);
    setStatus('deleted');
    setMessage(text.statusDeleted);
  };

  return (
    <div style={s.overlay} data-testid="ai-key-dialog-overlay">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-key-dialog-title"
        data-testid="ai-key-dialog"
        style={{ ...s.box, ...(isMobile ? s.boxMobile : {}) }}
      >
        <div style={s.headerBar}>
          <h2 id="ai-key-dialog-title" style={s.title}>{text.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={text.close}
            title={text.close}
            style={s.closeBtn}
            disabled={isVerifying}
          >✕</button>
        </div>

        <div style={s.body}>
          {requiredNotice && (
            <p role="alert" data-testid="ai-key-required-notice" style={s.requiredNotice}>{requiredNotice}</p>
          )}
          <p style={s.intro}>{text.intro}</p>
          <ul style={s.noteList}>
            {text.notes.map(note => <li key={note} style={s.noteItem}>{note}</li>)}
          </ul>
          <a
            href={GEMINI_KEY_ISSUE_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="ai-key-issue-link"
            style={s.issueLink}
          >
            {text.issueLink} ↗
          </a>

          {savedKeyMask && (
            <div style={s.savedBox} data-testid="ai-key-saved">
              <span style={s.savedLabel}>{text.savedLabel}</span>
              <code style={s.savedValue}>{savedKeyMask}</code>
              <span style={s.savedWhere}>{savedRemember ? text.savedOnDevice : text.savedInSession}</span>
            </div>
          )}

          <form onSubmit={handleVerify} style={s.form}>
            <label htmlFor="ai-key-input" style={s.inputLabel}>{text.inputLabel}</label>
            <div style={s.inputRow}>
              <input
                ref={inputRef}
                id="ai-key-input"
                data-testid="ai-key-input"
                type={reveal ? 'text' : 'password'}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder={text.inputPlaceholder}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={isVerifying}
                style={s.input}
              />
              <button
                type="button"
                data-testid="ai-key-reveal-toggle"
                onClick={() => setReveal(v => !v)}
                aria-pressed={reveal}
                aria-controls="ai-key-input"
                style={s.revealBtn}
              >
                {reveal ? text.hide : text.show}
              </button>
            </div>

            <label style={s.checkboxRow}>
              <input
                type="checkbox"
                data-testid="ai-key-remember"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                disabled={isVerifying}
                style={s.checkbox}
              />
              <span>
                <strong>{text.rememberLabel}</strong>
                <span style={s.checkboxHint}>{text.rememberHint}</span>
              </span>
            </label>

            <div
              role="status"
              aria-live="polite"
              data-testid="ai-key-status"
              data-status={status}
              style={status === 'error' ? s.statusError : (message ? s.statusOk : s.statusEmpty)}
            >
              {isVerifying ? text.verifying : message}
            </div>

            <div style={s.actions}>
              {savedKeyMask && (
                <button type="button" data-testid="ai-key-delete" onClick={handleDelete} style={s.deleteBtn} disabled={isVerifying}>
                  {text.delete}
                </button>
              )}
              <button type="button" data-testid="ai-key-later" onClick={onClose} style={s.secondaryBtn} disabled={isVerifying}>
                {savedKeyMask ? text.close : text.later}
              </button>
              <button type="submit" data-testid="ai-key-verify" style={{ ...s.primaryBtn, ...(isVerifying ? s.disabled : {}) }} disabled={isVerifying}>
                {isVerifying ? text.verifying : text.verify}
              </button>
            </div>
          </form>
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
    width: 'min(560px, 100%)', maxHeight: '92vh', overflowY: 'auto',
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
  noteList: { margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 },
  noteItem: { fontSize: 15, lineHeight: 1.6, color: 'var(--color-text)' },
  issueLink: {
    alignSelf: 'flex-start', fontSize: 15, fontWeight: 800, color: 'var(--color-primary-dark)',
    textDecoration: 'underline', textUnderlineOffset: 3,
  },
  savedBox: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12,
    background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
  },
  savedLabel: { fontSize: 14, fontWeight: 800, color: 'var(--color-text)' },
  savedValue: { fontSize: 15, color: 'var(--color-text)', letterSpacing: 1 },
  savedWhere: { fontSize: 13, color: 'var(--color-text-sub)' },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  inputLabel: { fontSize: 15, fontWeight: 800, color: 'var(--color-text)' },
  inputRow: { display: 'flex', gap: 8 },
  input: {
    flex: 1, minWidth: 0, fontSize: 16, padding: '11px 12px', borderRadius: 10,
    border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
  },
  revealBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
    fontWeight: 700, fontSize: 14, padding: '0 14px', minHeight: 44, borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  checkboxRow: { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 15, lineHeight: 1.5, color: 'var(--color-text)', cursor: 'pointer' },
  checkbox: { width: 20, height: 20, marginTop: 2, flexShrink: 0 },
  checkboxHint: { display: 'block', fontSize: 13, color: 'var(--color-text-sub)' },
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
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  secondaryBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
    fontWeight: 700, fontSize: 15, padding: '10px 16px', minHeight: 44, borderRadius: 12, cursor: 'pointer',
  },
  deleteBtn: {
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
};
