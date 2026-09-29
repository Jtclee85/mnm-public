// 3차 구조 개편 — 모드(이해/탐구/발표준비/글쓰기준비) 안에 흡수된 워크시트 입력칸.
// 여러 모드에서 공통으로 쓰는 label + textarea 한 세트. 자동 저장은 호출부에서
// updateNote(key, value)로 처리하고, 이 컴포넌트는 렌더링만 담당한다.
export default function WorksheetField({ id, label, value, onChange, placeholder, isMobile, rows = 3 }) {
  return (
    <div style={s.field}>
      {label && <label htmlFor={id} style={s.label}>{label}</label>}
      <textarea
        id={id}
        style={{ ...s.textarea, ...(isMobile ? s.textareaMobile : {}) }}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
        onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; }}
      />
    </div>
  );
}

const s = {
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12.5, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.5 },
  textarea: {
    width: '100%', boxSizing: 'border-box', minHeight: 56,
    border: '1.5px solid var(--color-border)', borderRadius: 10,
    padding: '9px 11px', fontSize: 13.5, lineHeight: 1.7,
    background: 'var(--color-surface)', color: 'var(--color-text)',
    fontFamily: 'inherit', resize: 'vertical', outline: 'none',
    transition: 'border-color 0.15s',
  },
  textareaMobile: { fontSize: 16, minHeight: 52 },
};
