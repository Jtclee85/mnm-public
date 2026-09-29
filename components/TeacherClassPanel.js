import { useState } from 'react';
import AiKeySettingsDialog from './AiKeySettingsDialog';
import { useAiKey, maskAiKey } from '../lib/useAiKey';
import { useTeacherClasses } from '../lib/useTeacherClasses';
import { TEACHER_TEXT as T } from '../lib/teacherText';

// 교사용 설정: ① 교사 Gemini 키(이 기기에만 저장) → ② 오늘의 학급 코드 만들기 → 이 기기에서
// 만든 학급 관리(복사·키 교체·재발급·삭제). 학생에게는 학급 코드만 알려 준다.
export default function TeacherClassPanel({ isMobile }) {
  const teacherKey = useAiKey();
  const { classes, createClass, rotateKey, removeClass, reissueClass } = useTeacherClasses();
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [busyAction, setBusyAction] = useState('');
  // { tone: 'ok' | 'error', text }
  const [notice, setNotice] = useState(null);
  const [copiedCode, setCopiedCode] = useState('');

  const errorText = (code) => T.errors[code] || T.errors.unavailable;
  const isBusy = !!busyAction;

  const requireKey = () => {
    if (teacherKey.hasKey) return true;
    setNotice({ tone: 'error', text: T.needKeyFirst });
    setKeyDialogOpen(true);
    return false;
  };

  const run = async (actionId, task) => {
    if (isBusy) return;
    setBusyAction(actionId);
    setNotice(null);
    try {
      await task();
    } finally {
      setBusyAction('');
    }
  };

  const handleCreate = (event) => {
    event.preventDefault();
    if (!requireKey()) return;
    run('create', async () => {
      const result = await createClass({ schoolName, apiKey: teacherKey.apiKey });
      setNotice(result.ok ? { tone: 'ok', text: T.created } : { tone: 'error', text: errorText(result.code) });
    });
  };

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(''), 2000);
    } catch {}
  };

  const handleRotate = (item) => {
    if (!requireKey()) return;
    run(`rotate:${item.code}`, async () => {
      const result = await rotateKey({ item, apiKey: teacherKey.apiKey });
      setNotice(result.ok ? { tone: 'ok', text: T.rotated } : { tone: 'error', text: errorText(result.code) });
    });
  };

  const handleReissue = (item) => {
    if (!requireKey()) return;
    run(`reissue:${item.code}`, async () => {
      const result = await reissueClass({ item, apiKey: teacherKey.apiKey });
      setNotice(result.ok ? { tone: 'ok', text: T.reissued } : { tone: 'error', text: errorText(result.code) });
    });
  };

  const handleRemove = (item) => {
    if (!window.confirm(T.removeConfirm)) return;
    run(`remove:${item.code}`, async () => {
      const result = await removeClass({ item });
      setNotice(result.ok ? { tone: 'ok', text: T.removed } : { tone: 'error', text: errorText(result.code) });
    });
  };

  return (
    <div style={{ ...s.wrap, ...(isMobile ? s.wrapMobile : {}) }}>
      <section style={s.card} aria-labelledby="teacher-key-heading">
        <h2 id="teacher-key-heading" style={s.sectionTitle}>{T.keySection}</h2>
        {teacherKey.hasKey ? (
          <p style={s.keyLine} data-testid="teacher-key-status">
            {T.keySaved}: <code style={s.mono}>{maskAiKey(teacherKey.apiKey)}</code>
          </p>
        ) : (
          <p style={s.keyLine} data-testid="teacher-key-status">{T.keyNone}</p>
        )}
        <button type="button" data-testid="teacher-open-key-dialog" style={s.secondaryBtn} onClick={() => setKeyDialogOpen(true)}>
          {teacherKey.hasKey ? T.keyChange : T.keyOpen}
        </button>
      </section>

      <section style={s.card} aria-labelledby="teacher-class-heading">
        <h2 id="teacher-class-heading" style={s.sectionTitle}>{T.classSection}</h2>
        <form onSubmit={handleCreate} style={s.form}>
          <label htmlFor="teacher-school-input" style={s.label}>{T.schoolLabel}</label>
          <div style={s.row}>
            <input
              id="teacher-school-input"
              data-testid="teacher-school-input"
              value={schoolName}
              onChange={e => setSchoolName(e.target.value)}
              placeholder={T.schoolPlaceholder}
              maxLength={20}
              aria-describedby="teacher-school-hint"
              style={s.input}
              disabled={isBusy}
            />
            <button type="submit" data-testid="teacher-create-class" style={{ ...s.primaryBtn, ...(isBusy ? s.disabled : {}) }} disabled={isBusy}>
              {busyAction === 'create' ? T.creating : T.create}
            </button>
          </div>
          <span id="teacher-school-hint" style={s.hint}>{T.schoolHint}</span>
        </form>

        <div
          role="status"
          aria-live="polite"
          data-testid="teacher-notice"
          data-tone={notice?.tone || ''}
          style={notice ? (notice.tone === 'error' ? s.noticeError : s.noticeOk) : s.noticeEmpty}
        >
          {notice?.text || ''}
        </div>
      </section>

      <section style={s.card} aria-labelledby="teacher-list-heading">
        <h2 id="teacher-list-heading" style={s.sectionTitle}>{T.listSection}</h2>
        {classes.length === 0 ? (
          <p style={s.hint} data-testid="teacher-class-empty">{T.listEmpty}</p>
        ) : (
          <ul style={s.list}>
            {classes.map(item => (
              <li key={item.code} style={s.listItem} data-testid="teacher-class-item">
                <div style={s.codeBlock}>
                  <strong style={s.code} data-testid="teacher-class-code">{item.code}</strong>
                  <span style={s.hint}>{T.expiresTonight}</span>
                </div>
                <div style={s.itemActions}>
                  <button type="button" data-testid="teacher-copy-code" style={s.secondaryBtn} onClick={() => handleCopy(item.code)}>
                    {copiedCode === item.code ? T.copied : T.copy}
                  </button>
                  <button type="button" data-testid="teacher-rotate-key" style={s.secondaryBtn} disabled={isBusy} onClick={() => handleRotate(item)}>
                    {busyAction === `rotate:${item.code}` ? T.working : T.rotateKey}
                  </button>
                  <button type="button" data-testid="teacher-reissue-code" style={s.secondaryBtn} disabled={isBusy} onClick={() => handleReissue(item)}>
                    {busyAction === `reissue:${item.code}` ? T.working : T.reissue}
                  </button>
                  <button type="button" data-testid="teacher-remove-class" style={s.dangerBtn} disabled={isBusy} onClick={() => handleRemove(item)}>
                    {busyAction === `remove:${item.code}` ? T.working : T.remove}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={s.noticeCard} aria-labelledby="teacher-notes-heading">
        <h2 id="teacher-notes-heading" style={s.sectionTitle}>{T.noticeTitle}</h2>
        <ul style={s.noteList}>
          {T.notices.map(note => <li key={note} style={s.noteItem}>{note}</li>)}
        </ul>
      </section>

      <AiKeySettingsDialog
        isOpen={keyDialogOpen}
        text={T.keyDialog}
        savedKeyMask={maskAiKey(teacherKey.apiKey)}
        savedRemember={teacherKey.remember}
        isMobile={isMobile}
        onSave={teacherKey.saveKey}
        onDelete={teacherKey.clearKey}
        onClose={() => setKeyDialogOpen(false)}
      />
    </div>
  );
}

const s = {
  wrap: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, alignItems: 'start' },
  wrapMobile: { gridTemplateColumns: '1fr' },
  card: {
    background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16,
    padding: 20, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0,
  },
  noticeCard: {
    background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 16,
    padding: 20, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0,
  },
  sectionTitle: { margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--color-text)' },
  keyLine: { margin: 0, fontSize: 16, color: 'var(--color-text)' },
  mono: { letterSpacing: 1 },
  form: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 15, fontWeight: 800, color: 'var(--color-text)' },
  row: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  input: {
    flex: '1 1 180px', minWidth: 0, fontSize: 17, padding: '11px 12px', borderRadius: 10,
    border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
  },
  hint: { fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-sub)' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  listItem: {
    display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 12,
    border: '1px solid var(--color-border)', background: 'var(--color-surface-alt)',
  },
  codeBlock: { display: 'flex', flexDirection: 'column', gap: 2 },
  code: { fontSize: 28, fontWeight: 900, color: 'var(--color-text)', letterSpacing: 1, wordBreak: 'break-all' },
  itemActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  noteList: { margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 },
  noteItem: { fontSize: 15, lineHeight: 1.6, color: 'var(--color-text)' },
  noticeEmpty: { minHeight: 0 },
  noticeOk: {
    fontSize: 15, fontWeight: 700, lineHeight: 1.6, color: 'var(--color-text)', padding: '10px 12px', borderRadius: 10,
    background: 'color-mix(in srgb, var(--color-accent-teal) 12%, var(--color-surface))',
    border: '1px solid rgba(var(--color-accent-teal-rgb),0.45)',
  },
  // 실패 상태(빨강 계열)는 의미 전달용이라 의도적으로 코랄 톤을 사용
  noticeError: {
    fontSize: 15, fontWeight: 700, lineHeight: 1.6, color: 'var(--color-text)', padding: '10px 12px', borderRadius: 10,
    background: 'color-mix(in srgb, var(--color-coral) 14%, var(--color-surface))',
    border: '1px solid rgba(var(--color-coral-rgb),0.5)',
  },
  primaryBtn: {
    border: 'none',
    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
    color: 'var(--color-surface)', fontWeight: 800, fontSize: 15, padding: '10px 18px', minHeight: 44, borderRadius: 12, cursor: 'pointer',
  },
  secondaryBtn: {
    alignSelf: 'flex-start',
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
    fontWeight: 700, fontSize: 14, padding: '8px 14px', minHeight: 40, borderRadius: 10, cursor: 'pointer',
  },
  dangerBtn: {
    border: '1px solid rgba(var(--color-coral-rgb),0.6)', background: 'var(--color-surface)', color: 'var(--color-text)',
    fontWeight: 700, fontSize: 14, padding: '8px 14px', minHeight: 40, borderRadius: 10, cursor: 'pointer',
  },
  disabled: { opacity: 0.6, cursor: 'wait' },
};
