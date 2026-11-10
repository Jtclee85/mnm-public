import { useEffect } from 'react';
import { useRouter } from 'next/router';
import '../styles/globals.css';
import { playClick } from '../lib/sounds';

const Analytics = process.env.NEXT_PUBLIC_OFFLINE_DEMO_MODE === 'true'
  ? null
  : require('@vercel/analytics/next').Analytics;

const PUBLIC_ORIGIN = 'https://mnm-public.vercel.app';
const PUBLIC_PATHS = new Set(['/', '/teacher']);

function isAnalyticsPage(url) {
  return url.origin === PUBLIC_ORIGIN && PUBLIC_PATHS.has(url.pathname) && !url.search && !url.hash;
}

function allowPageView(event) {
  if (event.type !== 'pageview' || !isAnalyticsPage(new URL(event.url))) return null;
  if (document.referrer) {
    const referrer = new URL(document.referrer);
    // 공유 주소와 식별값이 들어갈 수 있는 유입 URL은 통계에서 제외한다.
    if (referrer.search || referrer.hash) return null;
    if (referrer.origin === PUBLIC_ORIGIN ? !PUBLIC_PATHS.has(referrer.pathname) : referrer.pathname !== '/') {
      return null;
    }
  }
  return event;
}

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const showAnalytics = Analytics && process.env.NODE_ENV === 'production' && router.isReady
    && typeof window !== 'undefined' && isAnalyticsPage(new URL(window.location.href));
  useEffect(() => {
    const handleClick = (e) => {
      const btn = e.target.closest('button');
      if (btn && !btn.disabled) playClick();
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <>
      <Component {...pageProps} />
      {showAnalytics && <Analytics beforeSend={allowPageView} />}
    </>
  );
}

export default MyApp;
