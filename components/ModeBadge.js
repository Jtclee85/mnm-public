const modeConfig = {
  understand: { label: '이해 모드', color: 'var(--color-primary-dark)', bg: 'color-mix(in srgb, var(--color-primary) 14%, var(--color-surface))' },
  inquiry: { label: '탐구 모드', color: 'var(--color-text)', bg: 'color-mix(in srgb, var(--color-accent-teal) 18%, var(--color-surface))' },
  presentation: { label: '발표 준비 모드', color: 'var(--color-text)', bg: 'color-mix(in srgb, var(--color-coral) 18%, var(--color-surface))' }
};

export default function ModeBadge({ learningMode }) {
  const item = modeConfig[learningMode] || modeConfig.understand;
  return (
    <div
      style={{
        display: 'inline-block',
        padding: '8px 14px',
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 800,
        color: item.color,
        background: item.bg
      }}
    >
      현재 결과 화면: {item.label}
    </div>
  );
}
