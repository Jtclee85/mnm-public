import Home from './index';

/**
 * 연구대회 심사용 오프라인 데모 페이지 — 실제 앱(Home)을 demoMode로 그대로 렌더링한다.
 * 스냅샷은 빌드 시점에 getStaticProps가 읽어 HTML(__NEXT_DATA__)에 인라인되므로
 * file:// USB 환경에서 fetch 없이 동작한다.
 */
export default function OfflineDemoPage({ snapshot }) {
  return <Home demoMode demoSnapshot={snapshot} />;
}

export async function getStaticProps() {
  // 빌드 시점(Node)에만 실행 — 클라이언트 번들에 fs가 들어가지 않는다.
  const { loadDemoSnapshot } = require('../lib/demoSnapshot');
  return { props: { snapshot: loadDemoSnapshot() } };
}
