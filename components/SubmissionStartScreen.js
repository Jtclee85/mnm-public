import {
  SUBMISSION_APP_NAME,
  SUBMISSION_REPORT_TITLE,
  SUBMISSION_TARGET_GRADE,
  SUBMISSION_DESCRIPTION,
} from '../lib/submissionMeta';

/**
 * 연구대회 심사용 시작화면 — NEXT_PUBLIC_SUBMISSION_MODE=true일 때만
 * 기존 앱 위에 전체화면 오버레이로 한 겹 얹힌다. (심사 조건: 시작 화면에
 * 연구보고서 제목과 대상학년 명시. 시도명/학교명/출품자명은 표시하지 않는다.)
 */
export default function SubmissionStartScreen({ onStart, onViewTutorial, isMobile }) {
  return (
    <div style={styles.overlay} data-testid="submission-start-screen">
      <div style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
        <p style={styles.appNameLabel}>프로그램명</p>
        <h1 style={{ ...styles.appName, fontSize: isMobile ? 40 : 52 }}>{SUBMISSION_APP_NAME}</h1>
        <p style={styles.description}>{SUBMISSION_DESCRIPTION}</p>

        <dl style={styles.metaList}>
          <div style={styles.metaRow}>
            <dt style={styles.metaLabel}>연구보고서 제목</dt>
            <dd style={styles.metaValue}>{SUBMISSION_REPORT_TITLE}</dd>
          </div>
          <div style={styles.metaRow}>
            <dt style={styles.metaLabel}>대상학년</dt>
            <dd style={styles.metaValue}>{SUBMISSION_TARGET_GRADE}</dd>
          </div>
        </dl>

        <div style={{ ...styles.buttonRow, flexDirection: isMobile ? 'column' : 'row' }}>
          <button style={styles.startBtn} onClick={onStart} data-testid="submission-start-button">
            시작하기
          </button>
          <button style={styles.tutorialBtn} onClick={onViewTutorial}>
            자료조사 주의점 보기
          </button>
        </div>

        <p style={styles.hint}>
          시작 후 오른쪽 &lsquo;자료 조사 나침반&rsquo;에서 자료조사 주의점을 다시 볼 수 있습니다.
        </p>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 2000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(180deg, var(--color-bg) 0%, var(--color-surface-alt) 45%, var(--color-bg) 100%)',
    padding: '24px 16px', overflowY: 'auto',
  },
  card: {
    width: '100%', maxWidth: 640, textAlign: 'center',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 24, padding: '48px 40px',
    boxShadow: '0 18px 48px rgba(var(--color-text-rgb),0.12)',
  },
  cardMobile: { padding: '36px 22px' },
  appNameLabel: {
    margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: 2,
    color: 'var(--color-text-sub)',
  },
  appName: {
    margin: '6px 0 0', fontWeight: 900, lineHeight: 1.2,
    color: 'var(--color-primary-dark)',
  },
  description: {
    margin: '14px 0 0', fontSize: 14, lineHeight: 1.7,
    color: 'var(--color-text-sub)',
  },
  metaList: {
    margin: '28px 0 0', padding: '20px 22px', textAlign: 'left',
    background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
    borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 14,
  },
  metaRow: { display: 'flex', flexDirection: 'column', gap: 4 },
  metaLabel: {
    fontSize: 12, fontWeight: 800, color: 'var(--color-primary)',
  },
  metaValue: {
    margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.6,
    color: 'var(--color-text)',
  },
  buttonRow: {
    display: 'flex', gap: 10, justifyContent: 'center', marginTop: 28,
  },
  startBtn: {
    border: 'none',
    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
    color: 'var(--color-surface)', fontWeight: 800, fontSize: 15,
    padding: '14px 36px', borderRadius: 14, cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(var(--color-primary-rgb),0.22)',
  },
  tutorialBtn: {
    border: '2px solid var(--color-primary)',
    background: 'rgba(var(--color-primary-rgb),0.08)', color: 'var(--color-primary-dark)',
    fontWeight: 800, fontSize: 14, padding: '14px 24px', borderRadius: 14, cursor: 'pointer',
  },
  hint: {
    margin: '18px 0 0', fontSize: 12, color: 'var(--color-text-sub)',
  },
};
