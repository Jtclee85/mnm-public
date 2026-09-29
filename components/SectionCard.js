export default function SectionCard({ title, icon, children, actions, isMobile, topSlot }) {
  return (
    <div data-testid="section-card" style={{ ...styles.sectionCard, ...(isMobile ? styles.sectionCardMobile : {}) }}>
      {topSlot ? (
        <div style={{ ...styles.topSlot, ...(isMobile ? styles.topSlotMobile : {}) }}>
          {topSlot}
        </div>
      ) : null}
      <div style={{ ...styles.sectionHeader, ...(isMobile ? styles.sectionHeaderMobile : {}) }}>
        <div style={{ ...styles.sectionTitle, ...(isMobile ? styles.sectionTitleMobile : {}) }}>
          {icon ? <span style={{ marginRight: 8 }}>{icon}</span> : null}
          {title}
        </div>
        {actions ? <div style={styles.sectionActions}>{actions}</div> : null}
      </div>
      <div style={{ ...styles.sectionBody, ...(isMobile ? styles.sectionBodyMobile : {}) }}>
        {children}
      </div>
    </div>
  );
}

const styles = {
  sectionCard: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 20,
    boxShadow: '0 2px 8px rgba(var(--color-text-rgb), 0.08)',
    overflow: 'hidden'
  },
  sectionCardMobile: { borderRadius: 16 },
  topSlot: { padding: '20px 18px 4px', textAlign: 'center' },
  topSlotMobile: { padding: '16px 14px 2px' },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '16px 18px',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface-alt)'
  },
  sectionHeaderMobile: { padding: '13px 14px' },
  sectionTitle: {
    fontSize: 18, fontWeight: 800, color: 'var(--color-text)',
    minWidth: 0, wordBreak: 'keep-all', overflowWrap: 'anywhere'
  },
  sectionTitleMobile: { fontSize: 16 },
  sectionActions: { minWidth: 0, flex: '1 1 auto', display: 'flex', justifyContent: 'flex-end' },
  sectionBody: { padding: 18 },
  sectionBodyMobile: { padding: 14 }
};
