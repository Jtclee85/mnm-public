import { useState } from 'react';

const HEADING_RE = /^###\s*(.+)$/gm;

const stripBullet = (line) => line.replace(/^[-•*]\s*/, '').trim();
const cleanLabel = (line, labels) => {
  const text = stripBullet(line);
  for (const label of labels) {
    const re = new RegExp(`^${label}\\s*[:：]?\\s*`, 'i');
    if (re.test(text)) return text.replace(re, '').trim();
  }
  return text;
};

function parseVocabulary(text, fallbackLines = []) {
  if (text) {
    const matches = [...text.matchAll(HEADING_RE)];
    if (matches.length > 0) {
      return matches.map((match, idx) => {
        const start = match.index + match[0].length;
        const end = matches[idx + 1]?.index ?? text.length;
        const lines = text.slice(start, end).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const meaningLine = lines.find((line) => /쉬운 뜻|뜻|meaning/i.test(line)) || lines[0] || '';
        const roleLine = lines.find((line) => /자료 속 역할|역할|role/i.test(line)) || lines[1] || '';
        return {
          term: match[1].replace(/^\d+\.\s*/, '').trim(),
          meaning: cleanLabel(meaningLine, ['쉬운 뜻', '뜻', 'Meaning']),
          role: cleanLabel(roleLine, ['자료 속 역할', '역할', 'Role in the source', 'Role']),
        };
      }).filter((item) => item.term);
    }
  }

  return (fallbackLines || [])
    .map((line) => {
      const [term, ...rest] = line.split(/[:：]/);
      return {
        term: (term || '').replace(/^[-•*]\s*/, '').trim(),
        meaning: rest.join(':').trim(),
        role: '',
      };
    })
    .filter((item) => item.term);
}

export default function VocabularyToggle({ text, fallbackLines = [], isMobile, emptyText }) {
  const [openIndex, setOpenIndex] = useState(null);
  const items = parseVocabulary(text, fallbackLines);

  if (items.length === 0) {
    return (
      <p style={{ margin: 0, color: 'var(--color-text-sub)', lineHeight: 1.7, fontSize: isMobile ? 14 : 15 }}>
        {emptyText}
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: isMobile ? 8 : 10 }}>
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        const panelId = `vocabulary-panel-${idx}`;
        return (
          <div key={`${item.term}-${idx}`} style={styles.item}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              style={styles.button}
            >
              <span style={styles.term}>{item.term}</span>
              <span style={styles.chevron}>{isOpen ? '접기' : '보기'}</span>
            </button>
            {isOpen && (
              <div id={panelId} style={styles.panel}>
                <div style={styles.row}>
                  <span style={styles.label}>쉬운 뜻</span>
                  <span style={styles.text}>{item.meaning || '자료를 다시 보며 뜻을 생각해 보세요.'}</span>
                </div>
                <div style={styles.row}>
                  <span style={styles.label}>자료 속 역할</span>
                  <span style={styles.text}>{item.role || '이 낱말이 자료에서 왜 중요한지 찾아보세요.'}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  item: {
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    overflow: 'hidden',
    background: 'var(--color-surface)',
  },
  button: {
    width: '100%',
    border: 'none',
    background: 'var(--color-surface-alt)',
    color: 'var(--color-text)',
    padding: '11px 13px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    textAlign: 'left',
  },
  term: { fontSize: 14, fontWeight: 900, overflowWrap: 'anywhere' },
  chevron: {
    flexShrink: 0,
    border: '1px solid rgba(var(--color-primary-rgb),0.25)',
    color: 'var(--color-primary-dark)',
    background: 'rgba(var(--color-primary-rgb),0.06)',
    borderRadius: 999,
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 800,
  },
  panel: {
    display: 'grid',
    gap: 8,
    padding: '11px 13px',
    borderTop: '1px solid var(--color-border)',
  },
  row: { display: 'grid', gap: 4 },
  label: { color: 'var(--color-primary-dark)', fontWeight: 900, fontSize: 12 },
  text: { color: 'var(--color-text)', lineHeight: 1.65, fontSize: 14 },
};
