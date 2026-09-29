import { useEffect, useState } from 'react';

// 모델이 혹시 "□ "/"- " 같은 글머리표를 그대로 남겨 보내더라도 체크박스와
// 중복되어 보이지 않도록 제거하고 순수한 질문 문장만 남긴다.
const stripBullet = (line) => line.replace(/^[□☐\-•*]\s*/, '').trim();

export default function WritingChecklist({ items, isMobile, emptyText }) {
  const cleanedItems = (items || []).map(stripBullet).filter(Boolean);
  const [checked, setChecked] = useState(() => cleanedItems.map(() => false));

  // 글쓰기 결과가 다시 생성되면(항목 개수/내용이 바뀌면) 체크 상태를 초기화한다.
  useEffect(() => {
    setChecked(cleanedItems.map(() => false));
  }, [cleanedItems.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (cleanedItems.length === 0) {
    return (
      <p style={{ margin: 0, color: 'var(--color-text-sub)', lineHeight: 1.7, fontSize: isMobile ? 14 : 15 }}>
        {emptyText}
      </p>
    );
  }

  const toggle = (idx) => {
    setChecked(prev => prev.map((v, i) => (i === idx ? !v : v)));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {cleanedItems.map((line, idx) => (
        <label
          key={`${line}-${idx}`}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
            padding: isMobile ? '8px 10px' : '9px 12px', borderRadius: 10,
            background: checked[idx] ? 'color-mix(in srgb, var(--color-accent-teal) 12%, var(--color-surface))' : 'var(--color-surface-alt)',
            border: `1px solid ${checked[idx] ? 'rgba(var(--color-accent-teal-rgb),0.5)' : 'var(--color-border)'}`,
            transition: 'all 0.15s ease',
          }}
        >
          <input
            type="checkbox"
            checked={checked[idx]}
            onChange={() => toggle(idx)}
            style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, accentColor: 'var(--color-accent-teal)', cursor: 'pointer' }}
          />
          <span style={{
            fontSize: isMobile ? 13 : 14, lineHeight: 1.6, color: 'var(--color-text)',
            textDecoration: checked[idx] ? 'line-through' : 'none',
            opacity: checked[idx] ? 0.65 : 1,
          }}>
            {line}
          </span>
        </label>
      ))}
    </div>
  );
}
