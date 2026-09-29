// 자료 조사 나침반 — 랜딩 화면(자료 검색·입력 단계)에서 조사자료 입력 폼 옆에
// 고정 컬럼으로 배치되는 시각화 안내 카드. 정답을 주는 게 아니라
// "조사하기 전 이것만 살펴봐요"를 매번 떠올리게 하는 상시 참고용.
const CHECKLIST = [
  {
    icon: '🏛️',
    keyword: '출처',
    q: '어디에서 가져온 자료인가요?',
    a: '박물관·국가유산청·공공기관 자료인지 확인해요.',
  },
  {
    icon: '👤',
    keyword: '만든 사람',
    q: '누가 만든 자료인가요?',
    a: '기관이나 만든 사람이 분명한지 봐요.',
  },
  {
    icon: '🕒',
    keyword: '날짜',
    q: '언제 만들어졌거나 고쳐졌나요?',
    a: '너무 오래된 설명이면 다른 자료도 함께 봐요.',
  },
  {
    icon: '🔎',
    keyword: '핵심 낱말',
    q: '자료 속 중요한 말은 무엇인가요?',
    a: '이름·시대·장소·쓰임·특징을 찾아요.',
  },
  {
    icon: '🧩',
    keyword: '근거',
    q: '내 생각을 뒷받침할 근거가 있나요?',
    a: '자료에 나온 말을 바탕으로 생각해요.',
  },
];

// 하단 미니 흐름도 — 자료조사 순서를 step chip으로 한눈에 보여 준다.
const FLOW_STEPS = ['자료 찾기', '출처 확인', '핵심 낱말', '근거 쓰기'];

export default function ResearchCompass({ isMobile, isCompact = false, onReopenTutorial }) {
  return (
    <aside
      data-testid="research-compass"
      role="complementary"
      aria-label="자료 조사 나침반"
      style={{
        ...s.panel,
        ...(isCompact ? s.panelCompact : {}),
        ...(isMobile ? s.panelMobile : {}),
      }}
    >
      <div style={s.header}>
        <div style={s.headerTitle}>🧭 자료 조사 나침반</div>
        <div style={s.headerSub}>조사하기 전, 이 5가지만 살펴봐요.</div>
      </div>

      {/* 체크리스트를 훑기 전에 먼저 눈에 들어오도록 제목 바로 아래에 둔다. */}
      {onReopenTutorial && (
        <button
          data-testid="reopen-tutorial-button"
          onClick={onReopenTutorial}
          style={s.reopenBtn}
        >
          ❓ 자료를 조사할 때 무엇을 주의해야 할까요?
        </button>
      )}

      <div style={s.list}>
        {CHECKLIST.map(({ icon, keyword, q, a }) => (
          <div key={q} style={s.item}>
            <div style={s.itemTop}>
              <span style={s.itemIcon} aria-hidden="true">{icon}</span>
              <span style={s.itemBadge}>{keyword}</span>
            </div>
            <p style={s.itemQ}>{q}</p>
            <p style={s.itemA}>{a}</p>
          </div>
        ))}
      </div>

      <div style={s.flowBox}>
        <p style={s.flowTitle}>자료조사는 이렇게 해요</p>
        <div style={s.flowRow}>
          {FLOW_STEPS.map((step, idx) => (
            <span key={step} style={s.flowStepWrap}>
              <span style={s.flowChip}>
                <span style={s.flowNum}>{idx + 1}</span>
                {step}
              </span>
              {idx < FLOW_STEPS.length - 1 && (
                <span style={s.flowArrow} aria-hidden="true">→</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}

const s = {
  // RecommendedSources(340px)와 같은 폭으로 좌우 대칭을 맞춘다.
  panel: {
    width: 340, flexShrink: 0, alignSelf: 'flex-start',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 18, boxShadow: '0 2px 8px rgba(var(--color-text-rgb),0.08)',
    padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 14,
    boxSizing: 'border-box',
  },
  panelCompact: { width: 270, padding: '14px 14px 16px', gap: 12 },
  panelMobile: { width: '100%', alignSelf: 'stretch' },

  header: { display: 'flex', flexDirection: 'column', gap: 3 },
  headerTitle: { fontSize: 16.5, fontWeight: 900, color: 'var(--color-primary-dark)' },
  headerSub: { fontSize: 12.5, color: 'var(--color-text-sub)', lineHeight: 1.5 },

  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  item: {
    background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
    borderRadius: 12, padding: '11px 13px 12px',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  itemTop: { display: 'flex', alignItems: 'center', gap: 8 },
  itemIcon: { fontSize: 20, lineHeight: 1 },
  itemBadge: {
    border: '1px solid rgba(var(--color-accent-teal-rgb),0.45)',
    background: 'rgba(var(--color-accent-teal-rgb),0.1)',
    color: 'var(--color-primary-dark)', borderRadius: 999,
    padding: '2px 9px', fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap',
  },
  itemQ: { margin: '2px 0 0', fontSize: 13.5, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.5 },
  itemA: { margin: 0, fontSize: 12, color: 'var(--color-text-sub)', lineHeight: 1.55 },

  flowBox: {
    background: 'color-mix(in srgb, var(--color-gold) 10%, var(--color-surface))',
    border: '1px solid rgba(var(--color-gold-rgb),0.4)',
    borderRadius: 12, padding: '10px 12px 12px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  flowTitle: { margin: 0, fontSize: 12.5, fontWeight: 900, color: 'var(--color-text)' },
  flowRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, rowGap: 6 },
  flowStepWrap: { display: 'inline-flex', alignItems: 'center', gap: 4 },
  flowChip: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 999, padding: '3px 9px 3px 4px',
    fontSize: 11.5, fontWeight: 800, color: 'var(--color-text)', whiteSpace: 'nowrap',
  },
  flowNum: {
    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
    background: 'var(--color-primary)', color: 'var(--color-surface)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 10, fontWeight: 900,
  },
  flowArrow: { fontSize: 11, color: 'var(--color-text-sub)', fontWeight: 700 },

  reopenBtn: {
    border: '1px solid rgba(var(--color-accent-teal-rgb),0.45)', background: 'rgba(var(--color-accent-teal-rgb),0.08)',
    color: 'var(--color-primary-dark)', fontWeight: 800, fontSize: 12.5, lineHeight: 1.45,
    padding: '11px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
  },
};
