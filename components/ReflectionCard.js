/**
 * ReflectionCard — "✍️ 내가 생각해보기" 학생 입력 카드
 *
 * AI 결과 카드(흰 배경, 실선)와 시각적으로 구분되도록
 * 따뜻한 노란 배경 + 점선 테두리로 디자인
 */

import { useState } from 'react';
import { getUiText } from '../lib/i18n';

export default function ReflectionCard({ fields, notes, onUpdate, saveStatus, onShare, isMobile, t = getUiText('ko') }) {
  const [copied, setCopied] = useState(false);

  const handleShareClick = async () => {
    if (!onShare) return;
    const url = onShare();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <div style={{ ...s.card, ...(isMobile ? s.cardMobile : {}) }}>
      <div style={{ ...s.header, ...(isMobile ? s.headerMobile : {}) }}>
        <div style={s.headerLeft}>
          <span style={s.pencil}>✍️</span>
          <span style={{ ...s.title, ...(isMobile ? s.titleMobile : {}) }}>
            {t.reflectionTitle}
          </span>
        </div>
        <div style={s.headerRight}>
          {onShare && (
            <button
              onClick={handleShareClick}
              style={{ ...s.shareBtn, ...(copied ? s.shareBtnCopied : {}) }}
              title={t.shareTitle}
            >
              {copied ? t.copiedLink : t.share}
            </button>
          )}
          <SaveBadge status={saveStatus} isMobile={isMobile} t={t} />
        </div>
      </div>

      <div style={{ ...s.body, ...(isMobile ? s.bodyMobile : {}) }}>
        {fields.map(({ key, label, placeholder }, idx) => (
          <div
            key={key}
            style={{ ...s.fieldGroup, ...(idx === fields.length - 1 ? { marginBottom: 0 } : {}) }}
          >
            <label style={{ ...s.label, ...(isMobile ? s.labelMobile : {}) }}>
              {label}
            </label>
            <textarea
              style={{ ...s.textarea, ...(isMobile ? s.textareaMobile : {}) }}
              value={notes[key] || ''}
              onChange={e => onUpdate(key, e.target.value)}
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SaveBadge({ status, isMobile, t }) {
  const cfg = {
    idle:   { text: t.saveIdle,   color: 'var(--color-text-sub)', bg: 'transparent', border: 'none' },
    saving: { text: t.saveSaving, color: 'var(--color-text)',     bg: 'color-mix(in srgb, var(--color-gold) 30%, var(--color-surface))', border: '1px solid rgba(var(--color-gold-rgb),0.6)' },
    // 정답/저장 완료의 초록은 의미 전달용이라 그대로 유지
    saved:  { text: t.saveSaved,  color: '#065f46', bg: '#d1fae5',     border: '1px solid #6ee7b7' },
  }[status] ?? { text: t.saveIdle, color: 'var(--color-text-sub)', bg: 'transparent', border: 'none' };

  return (
    <div style={{
      fontSize: isMobile ? 10 : 11,
      fontWeight: 700,
      color: cfg.color,
      background: cfg.bg,
      border: cfg.border,
      padding: cfg.bg === 'transparent' ? '3px 0' : '3px 9px',
      borderRadius: 20,
      transition: 'all 0.25s',
      whiteSpace: 'nowrap'
    }}>
      {cfg.text}
    </div>
  );
}

const s = {
  card: {
    background: 'color-mix(in srgb, var(--color-gold) 6%, var(--color-surface))',
    border: '2px dashed var(--color-gold)',
    borderRadius: 20,
    overflow: 'hidden'
  },
  cardMobile: { borderRadius: 16 },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 18px',
    background: 'color-mix(in srgb, var(--color-gold) 14%, var(--color-surface))',
    borderBottom: '1px dashed rgba(var(--color-gold-rgb),0.7)'
  },
  headerMobile: { padding: '11px 14px' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  pencil: { fontSize: 18 },
  title: { fontSize: 16, fontWeight: 800, color: 'var(--color-text)' },
  titleMobile: { fontSize: 15 },
  shareBtn: {
    border: '1.5px solid color-mix(in srgb, var(--color-gold) 70%, var(--color-text))',
    background: 'color-mix(in srgb, var(--color-gold) 30%, var(--color-surface))',
    color: 'var(--color-text)',
    fontWeight: 800,
    fontSize: 12,
    padding: '6px 14px',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap'
  },
  // 복사 완료(성공) 초록은 의미 전달용이라 그대로 유지
  shareBtnCopied: {
    background: '#d1fae5',
    border: '1.5px solid #059669',
    color: '#065f46'
  },
  body: { padding: 18 },
  bodyMobile: { padding: 14 },
  fieldGroup: { marginBottom: 16 },
  label: {
    display: 'block',
    fontWeight: 700,
    fontSize: 14,
    color: 'var(--color-text)',
    marginBottom: 6,
    lineHeight: 1.5
  },
  labelMobile: { fontSize: 13 },
  textarea: {
    width: '100%',
    minHeight: 80,
    border: '1.5px solid rgba(var(--color-gold-rgb),0.7)',
    borderRadius: 12,
    padding: '11px 14px',
    fontSize: 15,
    lineHeight: 1.7,
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s'
  },
  textareaMobile: { minHeight: 72, fontSize: 14, padding: '10px 12px' }
};
