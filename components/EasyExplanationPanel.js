import InlineVocabularyText from './InlineVocabularyText';
import { extractEasyExplanationSections } from '../lib/easyExplanation';
import { copyText } from '../lib/parseResponse';

const SPIN_CSS = `@keyframes ep-spin { to { transform: rotate(360deg); } }`;

// 왼쪽 패널 '쉬운설명' 탭 — 오른쪽에서 탐구/발표/글쓰기 활동을 하는 동안에도
// 이해모드에서 만든 쉬운 설명을 참고할 수 있게 하는 경량 참고용 패널.
// 이해모드 결과 전체를 다 보여주지 않고 핵심 2가지만 우선 노출한다.
// 낱말 뜻은 본문의 밑줄 낱말 팝업에서 확인하므로 별도 목록을 중복 노출하지 않는다.
export default function EasyExplanationPanel({ result, isMobile, t, isLoading }) {
  const { oneSentence, easyFullText, glossaryText, glossaryFallbackLines, hasContent } =
    extractEasyExplanationSections(result);

  if (isLoading) {
    return (
      <div style={s.loadingState}>
        <style>{SPIN_CSS}</style>
        <div style={s.loadingSpinner} />
        <p style={s.loadingText}>{t.loadingResult}</p>
      </div>
    );
  }

  if (!hasContent) {
    return (
      <p style={s.empty}>{t.easyPanelEmpty}</p>
    );
  }

  return (
    <div style={{ ...s.wrap, ...(isMobile ? s.wrapMobile : {}) }}>
      <p style={s.hint}>{t.easyPanelHint}</p>

      <section style={s.section}>
        <h3 style={s.sectionTitle}>{t.understandSentenceTitle}</h3>
        {oneSentence
          ? <div style={s.bigTitle}>{oneSentence}</div>
          : <p style={s.empty}>{t.understandSentenceEmpty}</p>}
      </section>

      <section style={s.section}>
        <div style={s.sectionHeaderRow}>
          <h3 style={s.sectionTitle}>{t.understandEasyFullTitle}</h3>
          {easyFullText && (
            <button
              data-testid="copy-easy-button"
              style={s.copyBtn}
              onClick={async () => {
                try { await copyText(easyFullText); alert(t.easyCopied); }
                catch { alert(t.copyFailed); }
              }}
            >
              {t.copy}
            </button>
          )}
        </div>
        <InlineVocabularyText
          text={easyFullText}
          vocabularyText={glossaryText}
          fallbackLines={glossaryFallbackLines}
          isMobile={isMobile}
          emptyText={t.understandEasyFullEmpty}
        />
      </section>

    </div>
  );
}

const s = {
  wrap: {
    display: 'flex', flexDirection: 'column', gap: 16,
    maxHeight: 560, overflowY: 'auto', paddingRight: 2,
  },
  wrapMobile: { maxHeight: 'none', overflowY: 'visible' },
  hint: {
    margin: 0, fontSize: 12.5, lineHeight: 1.6, color: 'var(--color-text-sub)',
    background: 'var(--color-surface-alt)', border: '1px dashed var(--color-border)',
    borderRadius: 10, padding: '8px 12px',
  },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionHeaderRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { margin: 0, fontSize: 14, fontWeight: 900, color: 'var(--color-text)' },
  copyBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
    fontWeight: 700, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11.5, flexShrink: 0,
  },
  bigTitle: {
    fontSize: 15, fontWeight: 900, color: 'var(--color-text)',
    background: 'color-mix(in srgb, var(--color-gold) 22%, var(--color-surface))',
    border: '1px solid rgba(var(--color-gold-rgb),0.6)', borderRadius: 12, padding: '11px 13px', lineHeight: 1.6,
  },
  empty: { margin: 0, color: 'var(--color-text-sub)', fontSize: 13, lineHeight: 1.6 },
  loadingState: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '40px 20px', gap: 14,
  },
  loadingSpinner: {
    width: 30, height: 30,
    border: '4px solid var(--color-border)', borderTop: '4px solid var(--color-primary)',
    borderRadius: '50%', animation: 'ep-spin 1s linear infinite',
  },
  loadingText: { color: 'var(--color-text-sub)', fontSize: 13, fontWeight: 600, margin: 0 },
};
