import ReactMarkdown from 'react-markdown';

const HEADING_RE = /^###\s*(.+)$/gm;

const stripBullet = (line) => line.replace(/^[-•*]\s*/, '').trim();

function parseMarkdownSections(text) {
  if (!text) return [];
  const matches = [...text.matchAll(HEADING_RE)];
  if (matches.length === 0) return [];

  return matches.map((match, idx) => {
    const start = match.index + match[0].length;
    const end = matches[idx + 1]?.index ?? text.length;
    const body = text.slice(start, end).trim();
    return {
      title: match[1].trim(),
      body,
      lines: body
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    };
  });
}

export default function PresentationBlocks({ text, fallbackLines = [], isMobile, emptyText }) {
  const sections = parseMarkdownSections(text);
  const fallback = (fallbackLines || []).filter(Boolean);

  if (!text && fallback.length === 0) {
    return (
      <p style={{ margin: 0, color: 'var(--color-text-sub)', lineHeight: 1.7, fontSize: isMobile ? 14 : 15 }}>
        {emptyText}
      </p>
    );
  }

  if (sections.length === 0) {
    const fallbackText = text || fallback.map((line) => `- ${stripBullet(line)}`).join('\n');
    return (
      <div style={{ color: 'var(--color-text)', lineHeight: 1.8, fontSize: isMobile ? 14 : 15 }}>
        <ReactMarkdown>{fallbackText}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 9 : 11 }}>
      {sections.map((section, idx) => (
        <div
          key={`${section.title}-${idx}`}
          style={{
            background: idx % 2 === 0 ? 'var(--color-surface-alt)' : 'rgba(var(--color-primary-rgb),0.05)',
            border: '1px solid var(--color-border)',
            borderLeft: `4px solid ${idx === 0 ? 'var(--color-accent-teal)' : idx === 1 ? 'var(--color-primary)' : 'var(--color-coral)'}`,
            borderRadius: 8,
            padding: isMobile ? '10px 12px' : '12px 14px',
          }}
        >
          <div
            style={{
              color: idx === 1 ? 'var(--color-primary-dark)' : 'var(--color-text)',
              fontWeight: 900,
              fontSize: isMobile ? 13 : 14,
              marginBottom: 7,
              wordBreak: 'keep-all',
              overflowWrap: 'anywhere',
            }}
          >
            {section.title}
          </div>
          <div style={{ color: 'var(--color-text)', lineHeight: 1.75, fontSize: isMobile ? 13 : 14 }}>
            <ReactMarkdown>{section.body}</ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
}
