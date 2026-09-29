import { useState, useEffect, useRef } from 'react';

const HEADING_RE = /^###\s*(.+)$/gm;
const TOOLTIP_W = 220;

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const cleanLabel = (line, labels) => {
  const t = line.replace(/^[-•*]\s*/, '').trim();
  for (const label of labels) {
    const re = new RegExp(`^${label}\\s*[:：]?\\s*`, 'i');
    if (re.test(t)) return t.replace(re, '').trim();
  }
  return t;
};

export function parseVocabulary(text, fallbackLines = []) {
  if (text) {
    const matches = [...text.matchAll(HEADING_RE)];
    if (matches.length > 0) {
      return matches.map((match, idx) => {
        const start = match.index + match[0].length;
        const end = matches[idx + 1]?.index ?? text.length;
        const lines = text.slice(start, end).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const meaningLine = lines.find(l => /쉬운 뜻|뜻|meaning/i.test(l)) || lines[0] || '';
        const roleLine = lines.find(l => /자료 속 역할|역할|role/i.test(l)) || lines[1] || '';
        return {
          term: match[1].replace(/^\d+\.\s*/, '').trim(),
          meaning: cleanLabel(meaningLine, ['쉬운 뜻', '뜻', 'Meaning']),
          role: cleanLabel(roleLine, ['자료 속 역할', '역할', 'Role in the source', 'Role']),
        };
      }).filter(item => item.term);
    }
  }
  return (fallbackLines || [])
    .map(line => {
      const [term, ...rest] = line.split(/[:：]/);
      return {
        term: (term || '').replace(/^[-•*]\s*/, '').trim(),
        meaning: rest.join(':').trim(),
        role: '',
      };
    })
    .filter(item => item.term);
}

function splitTextWithVocab(text, terms) {
  if (!text || terms.length === 0) return [{ type: 'text', content: text || '' }];
  const pattern = new RegExp(`(${terms.map(t => escapeRegex(t.term)).join('|')})`, 'g');
  const segments = [];
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    const termIdx = terms.findIndex(t => t.term === match[1]);
    segments.push({ type: 'vocab', content: match[1], termIndex: termIdx >= 0 ? termIdx : 0 });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ type: 'text', content: text.slice(lastIndex) });
  return segments;
}

// position: fixed 좌표를 계산해 overflow:hidden 부모에 잘리지 않도록 한다
function calcTooltipPos(spanRect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const MARGIN = 8;

  // 기본: 낱말 바로 아래
  let top = spanRect.bottom + 8;
  let left = spanRect.left + spanRect.width / 2 - TOOLTIP_W / 2;

  // 오른쪽 경계 초과 → 왼쪽으로 당기기
  if (left + TOOLTIP_W + MARGIN > vw) left = vw - TOOLTIP_W - MARGIN;
  // 왼쪽 경계 초과
  if (left < MARGIN) left = MARGIN;

  // 말풍선 삼각형: 낱말 중심이 툴팁 내 어느 위치인지
  const triangleLeft = Math.max(10, Math.min(
    spanRect.left + spanRect.width / 2 - left - 6,
    TOOLTIP_W - 22
  ));

  // 아래 공간 부족 → 낱말 위로 뒤집기
  const TOOLTIP_EST_H = 130;
  const flipUp = top + TOOLTIP_EST_H > vh - MARGIN;
  if (flipUp) top = spanRect.top - TOOLTIP_EST_H - 8;

  return { top, left, triangleLeft, flipUp };
}

export default function InlineVocabularyText({ text, vocabularyText, fallbackLines = [], isMobile, emptyText }) {
  const [tooltip, setTooltip] = useState(null); // { term, meaning, role, top, left, triangleLeft, flipUp }
  const containerRef = useRef(null);

  const terms = parseVocabulary(vocabularyText, fallbackLines);
  const segments = splitTextWithVocab(text, terms);
  const hasVocab = terms.length > 0 && segments.some(s => s.type === 'vocab');

  // 바깥 클릭 또는 스크롤 시 말풍선 닫기
  useEffect(() => {
    if (!tooltip) return;
    const close = () => setTooltip(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', close, true); // capture: 스크롤 컨테이너 포함
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [tooltip]);

  if (!text) {
    return (
      <p style={{ margin: 0, color: 'var(--color-text-sub)', lineHeight: 1.7, fontSize: isMobile ? 14 : 15 }}>
        {emptyText}
      </p>
    );
  }

  const handleTermClick = (e, term) => {
    e.stopPropagation();
    if (tooltip?.term === term.term) { setTooltip(null); return; }
    const pos = calcTooltipPos(e.currentTarget.getBoundingClientRect());
    setTooltip({ ...term, ...pos });
  };

  return (
    <div ref={containerRef}>
      {hasVocab && (
        <p style={{ margin: '0 0 8px', fontSize: isMobile ? 11 : 12, color: 'var(--color-text-sub)', lineHeight: 1.5 }}>
          밑줄 친 낱말을 누르면 뜻을 볼 수 있어요.
        </p>
      )}
      <div style={{
        color: 'var(--color-text)',
        background: 'var(--color-surface-alt)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: isMobile ? '12px 13px' : '14px 15px',
        lineHeight: 1.85,
        fontSize: isMobile ? 14 : 15,
        whiteSpace: 'pre-wrap',
        wordBreak: 'keep-all',
        overflowWrap: 'anywhere',
      }}>
        {segments.map((seg, idx) => {
          if (seg.type === 'text') return <span key={idx}>{seg.content}</span>;
          const term = terms[seg.termIndex];
          const isOpen = tooltip?.term === term.term;
          return (
            <span
              key={idx}
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              onClick={(e) => handleTermClick(e, term)}
              onKeyDown={(e) => e.key === 'Enter' && handleTermClick(e, term)}
              style={{
                fontWeight: 900,
                textDecoration: 'underline',
                textDecorationColor: 'var(--color-accent-teal)',
                textDecorationThickness: '2px',
                color: isOpen ? 'var(--color-primary)' : 'var(--color-primary-dark)',
                cursor: 'pointer',
                background: isOpen ? 'rgba(var(--color-accent-teal-rgb),0.12)' : 'transparent',
                borderRadius: 3,
                padding: '0 1px',
                transition: 'all 0.15s',
              }}
            >
              {seg.content}
            </span>
          );
        })}
      </div>

      {/* 말풍선 툴팁 — position:fixed로 overflow:hidden 부모에 잘리지 않음 */}
      {tooltip && (
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: tooltip.top,
            left: tooltip.left,
            width: TOOLTIP_W,
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-accent-teal)',
            borderRadius: 10,
            padding: '11px 13px',
            boxShadow: '0 6px 24px rgba(0,0,0,0.16)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
          }}
        >
          {/* 삼각형 — 낱말 방향을 가리킴 */}
          {!tooltip.flipUp && (
            <>
              <div style={{
                position: 'absolute', top: -8, left: tooltip.triangleLeft,
                width: 0, height: 0,
                borderLeft: '7px solid transparent',
                borderRight: '7px solid transparent',
                borderBottom: '8px solid var(--color-accent-teal)',
              }} />
              <div style={{
                position: 'absolute', top: -6, left: tooltip.triangleLeft + 1,
                width: 0, height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderBottom: '7px solid var(--color-surface)',
              }} />
            </>
          )}
          {tooltip.flipUp && (
            <>
              <div style={{
                position: 'absolute', bottom: -8, left: tooltip.triangleLeft,
                width: 0, height: 0,
                borderLeft: '7px solid transparent',
                borderRight: '7px solid transparent',
                borderTop: '8px solid var(--color-accent-teal)',
              }} />
              <div style={{
                position: 'absolute', bottom: -6, left: tooltip.triangleLeft + 1,
                width: 0, height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '7px solid var(--color-surface)',
              }} />
            </>
          )}

          <span style={{ fontWeight: 900, fontSize: 13, color: 'var(--color-primary-dark)' }}>
            {tooltip.term}
          </span>
          {tooltip.meaning && (
            <div style={{ display: 'grid', gap: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--color-accent-teal)' }}>쉬운 뜻</span>
              <span style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.65 }}>{tooltip.meaning}</span>
            </div>
          )}
          {tooltip.role && (
            <div style={{ display: 'grid', gap: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--color-accent-teal)' }}>자료 속 역할</span>
              <span style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.65 }}>{tooltip.role}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
