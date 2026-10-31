import { useEffect, useState } from 'react';
import Head from 'next/head';
import PrivacyFooter from '../components/PrivacyFooter';
import { PRIVACY_POLICY_LINK_LABELS } from '../lib/i18n';
import { REQUIRES_CLASS_CODE } from '../lib/aiProviderConfig';
import { TEACHER_TEXT as T } from '../lib/teacherText';

// 교사용 설정 화면 — 교사 Gemini 키로 오늘의 학급 코드를 만든다. share.js처럼 한국어 고정이다.
// 오프라인 시연(file://)은 API를 쓰지 않으므로 안내만 보여 준다.
const OFFLINE_DEMO_MODE = process.env.NEXT_PUBLIC_OFFLINE_DEMO_MODE === 'true';
// 제출용 번들에는 사용하지 않는 키 입력·학급 관리 코드 자체를 포함하지 않는다.
const TeacherClassPanel = process.env.NEXT_PUBLIC_OFFLINE_DEMO_MODE === 'true'
  ? null
  : require('../components/TeacherClassPanel').default;

export default function TeacherPage() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth <= 900);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const unavailableNotice = OFFLINE_DEMO_MODE
    ? T.offlineNotice
    : (!REQUIRES_CLASS_CODE ? T.openaiNotice : '');

  return (
    <>
      <Head>
        <title>{T.pageTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="robots" content="noindex" />
      </Head>
      <main style={{ ...s.page, ...(isMobile ? s.pageMobile : {}) }} data-testid="teacher-page">
        <header style={s.header}>
          <div>
            <h1 style={s.title}>{T.heading}</h1>
            <p style={s.lead}>{T.lead}</p>
          </div>
          <a href="/" style={s.backLink} data-testid="teacher-back-link">{T.backToStudent}</a>
        </header>
        {unavailableNotice
          ? <p role="alert" style={s.unavailable} data-testid="teacher-unavailable">{unavailableNotice}</p>
          : <TeacherClassPanel isMobile={isMobile} />}
        {!OFFLINE_DEMO_MODE && <PrivacyFooter label={PRIVACY_POLICY_LINK_LABELS.ko} style={{ marginTop: 'auto' }} />}
      </main>
    </>
  );
}

const s = {
  page: {
    minHeight: '100vh', boxSizing: 'border-box', background: 'var(--color-bg)',
    padding: '32px 40px', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20,
  },
  pageMobile: { padding: '20px 16px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' },
  title: { margin: 0, fontSize: 28, fontWeight: 900, color: 'var(--color-text)' },
  lead: { margin: '6px 0 0', fontSize: 16, lineHeight: 1.6, color: 'var(--color-text)', maxWidth: 720 },
  backLink: { fontSize: 15, fontWeight: 700, color: 'var(--color-primary-dark)', whiteSpace: 'nowrap' },
  unavailable: {
    margin: 0, padding: '14px 16px', borderRadius: 12, fontSize: 16, fontWeight: 700,
    background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--color-text)',
  },
};
