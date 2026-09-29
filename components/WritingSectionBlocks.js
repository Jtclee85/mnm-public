import ReactMarkdown from 'react-markdown';

const HEADING_RE = /^###\s*(.+)$/gm;
const SUPPORT_LABEL_RE = /^(뒷받침하려면|뒷받침 방향|support|supporting|to support)\s*:/i;
const CANDIDATE_LABEL_RE = /^(중심문장 후보|center sentence candidate|topic sentence candidate|main sentence candidate)\s*:/i;

const stripBullet = (line) => line.replace(/^[-•*]\s*/, '').trim();
const stripCandidateLabel = (line) => line.replace(CANDIDATE_LABEL_RE, '').trim();

function parseMarkdownSections(text) {
  if (!text) return [];
  const matches = [...text.matchAll(HEADING_RE)];
  if (matches.length === 0) return [];

  return matches.map((match, idx) => {
    const start = match.index + match[0].length;
    const end = matches[idx + 1]?.index ?? text.length;
    const lines = text
      .slice(start, end)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const supportStart = lines.findIndex((line) => SUPPORT_LABEL_RE.test(line));
    const candidateLines = (supportStart >= 0 ? lines.slice(0, supportStart) : lines)
      .map(stripBullet)
      .map(stripCandidateLabel)
      .filter(Boolean);
    const supportLines = supportStart >= 0
      ? lines.slice(supportStart + 1).map(stripBullet).filter(Boolean)
      : [];

    return {
      title: match[1].trim(),
      candidateLines,
      supportLines,
      allLines: lines.map(stripBullet).filter(Boolean),
    };
  });
}

function getSections({ text, fallbackText, kind }) {
  const primary = parseMarkdownSections(text);
  if (primary.length > 0) return primary;

  if (kind === 'support') {
    const fallback = parseMarkdownSections(fallbackText);
    return fallback
      .map((section) => ({ ...section, allLines: section.supportLines }))
      .filter((section) => section.allLines.length > 0);
  }

  return [];
}

export default function WritingSectionBlocks({
  text,
  fallbackText = '',
  kind = 'topic',
  isMobile,
  emptyText,
}) {
  const sections = getSections({ text, fallbackText, kind });

  if (!text && sections.length === 0) {
    return (
      <p style={{ margin: 0, color: 'var(--color-text-sub)', lineHeight: 1.7, fontSize: isMobile ? 14 : 15 }}>
        {emptyText}
      </p>
    );
  }

  if (sections.length === 0) {
    return (
      <div style={{ color: 'var(--color-text)', lineHeight: 1.8, fontSize: isMobile ? 14 : 15 }}>
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10 }}>
      {sections.map((section, idx) => {
        const lines = kind === 'support'
          ? (section.allLines.length > 0 ? section.allLines : section.supportLines)
          : (section.candidateLines.length > 0 ? section.candidateLines : section.allLines);

        return (
          <div
            key={`${section.title}-${idx}`}
            style={{
              borderLeft: `4px solid ${idx === 0 ? 'var(--color-accent-teal)' : idx === 1 ? 'var(--color-primary)' : 'var(--color-coral)'}`,
              padding: isMobile ? '8px 0 8px 12px' : '9px 0 9px 14px',
              background: idx === 1 ? 'rgba(var(--color-primary-rgb),0.05)' : 'var(--color-surface-alt)',
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: isMobile ? 12 : 13,
                fontWeight: 900,
                color: idx === 1 ? 'var(--color-primary-dark)' : 'var(--color-text)',
              }}>
                {section.title}
              </span>
            </div>

            {kind === 'support' ? (
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--color-text)', lineHeight: 1.75, fontSize: isMobile ? 13 : 14 }}>
                {lines.map((line, lineIdx) => <li key={`${line}-${lineIdx}`}>{line}</li>)}
              </ul>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {lines.map((line, lineIdx) => (
                  <p
                    key={`${line}-${lineIdx}`}
                    style={{ margin: 0, color: 'var(--color-text)', lineHeight: 1.75, fontSize: isMobile ? 13 : 14, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
                  >
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
