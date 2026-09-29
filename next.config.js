// 오프라인 데모(USB 제출용) 정적 export 전용 설정 —
// NEXT_PUBLIC_OFFLINE_DEMO_MODE=true일 때만 적용되고, 평소 dev/배포 빌드에는 영향이 없다.
// - output: 'export'      → 정적 HTML/JS로 내보내 file://에서 열 수 있게 한다.
// - distDir 분리          → 일반 빌드 캐시(.next)를 건드리지 않는다.
// - images.unoptimized    → export 모드에서 next/image 최적화 서버가 없으므로 필수.
const isOfflineDemo = process.env.NEXT_PUBLIC_OFFLINE_DEMO_MODE === 'true';

const nextConfig = isOfflineDemo
  ? {
      output: 'export',
      trailingSlash: true,
      distDir: '.next-offline',
      images: { unoptimized: true },
    }
  : {};

module.exports = nextConfig;
