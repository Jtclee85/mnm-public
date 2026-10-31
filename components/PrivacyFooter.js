import { PRIVACY_POLICY_PATH } from '../lib/privacyPolicy';

// 학습 중인 화면과 입력값을 유지하도록 새 탭에서 방침을 읽는다.
export default function PrivacyFooter({ label, style }) {
  if (process.env.NEXT_PUBLIC_OFFLINE_DEMO_MODE === 'true') return null;
  return (
    <footer data-testid="privacy-footer" style={{ ...styles.footer, ...style }}>
      <a href={PRIVACY_POLICY_PATH} target="_blank" rel="noopener noreferrer" hrefLang="ko"
        data-testid="privacy-policy-link" style={styles.link}>
        {label}
      </a>
    </footer>
  );
}

const styles = {
  footer: { marginTop: 24, padding: '12px 16px', textAlign: 'center', borderTop: '1px solid var(--color-border)' },
  link: { display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 12px', fontSize: 14,
    lineHeight: 1.6, color: 'var(--color-text-sub)', textDecoration: 'underline', textUnderlineOffset: 4 },
};
