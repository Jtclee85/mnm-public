import { getUiText } from '../lib/i18n';

const SECTIONS = [
  {
    key: '처음',
    icon: '1',
    label: '처음',
    bg: 'color-mix(in srgb, var(--color-accent-teal) 12%, var(--color-surface))',
    border: 'rgba(var(--color-accent-teal-rgb),0.5)',
    titleColor: 'var(--color-text)',
    numBg: 'var(--color-accent-teal)',
    numColor: 'var(--color-text)'
  },
  {
    key: '가운데',
    icon: '2',
    label: '가운데',
    bg: 'rgba(var(--color-primary-rgb),0.08)',
    border: 'rgba(var(--color-primary-rgb),0.4)',
    titleColor: 'var(--color-primary-dark)',
    numBg: 'var(--color-primary)',
    numColor: 'var(--color-surface)'
  },
  {
    key: '끝',
    icon: '3',
    label: '끝',
    bg: 'color-mix(in srgb, var(--color-coral) 14%, var(--color-surface))',
    border: 'rgba(var(--color-coral-rgb),0.5)',
    titleColor: 'var(--color-text)',
    numBg: 'var(--color-coral)',
    numColor: 'var(--color-text)'
  }
];

function parseOutlineSections(text) {
  if (!text) return [];
  const result = [];
  for (const section of SECTIONS) {
    const regex = new RegExp(
      `\\[${section.key}\\]([\\s\\S]*?)(?=\\[처음\\]|\\[가운데\\]|\\[끝\\]|$)`
    );
    const match = text.match(regex);
    if (match) {
      const lines = match[1]
        .split(/\r?\n/)
        .map(l => l.replace(/^[-•*]\s*/, '').trim())
        .filter(Boolean);
      result.push({ ...section, lines });
    }
  }
  return result;
}

export default function WritingOutlineCard({ outline, isMobile, t = getUiText('ko') }) {
  if (!outline) {
    return (
      <p style={{ margin: 0, color: 'var(--color-text-sub)', lineHeight: 1.7, fontSize: isMobile ? 14 : 15 }}>
        {t.writingEmpty}
      </p>
    );
  }

  const sections = parseOutlineSections(outline);

  if (sections.length === 0) {
    return (
      <div style={{ color: 'var(--color-text)', lineHeight: 1.8, fontSize: isMobile ? 14 : 15, whiteSpace: 'pre-line' }}>
        {outline}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 12 }}>
      {sections.map(({ key, icon, label, bg, border, titleColor, numBg, numColor, lines }) => {
        const translatedLabel = key === '처음' ? t.writingFirst : key === '가운데' ? t.writingMiddle : key === '끝' ? t.writingEnd : label;
        return (
        <div
          key={key}
          style={{
            background: bg,
            border: `1.5px solid ${border}`,
            borderRadius: 14,
            padding: isMobile ? '12px 14px' : '14px 16px'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10
          }}>
            <span style={{
              width: isMobile ? 22 : 24,
              height: isMobile ? 22 : 24,
              borderRadius: '50%',
              background: numBg,
              color: numColor,
              fontWeight: 900,
              fontSize: isMobile ? 12 : 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {icon}
            </span>
            <span style={{
              fontWeight: 800,
              fontSize: isMobile ? 14 : 15,
              color: titleColor
            }}>
              {translatedLabel}
            </span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {lines.map((line, i) => (
              <li key={i} style={{
                color: 'var(--color-text)',
                lineHeight: 1.75,
                fontSize: isMobile ? 13 : 14
              }}>
                {line}
              </li>
            ))}
          </ul>
        </div>
      );})}
    </div>
  );
}
