const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',

  // 주 사용 환경은 1920×1080 데스크톱/교실 PC — 기본 viewport를 이 기준으로 고정한다.
  // 모바일은 보조 환경이므로 필요한 테스트 파일에서 test.use()로 개별 오버라이드한다.
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1920, height: 1080 },
    trace: 'on-first-retry',
    // 5차: 첫 방문 튜토리얼 모달이 기존 테스트들의 클릭을 가로채지 않도록,
    // 기본적으로 "이미 튜토리얼을 본 상태"로 시작한다.
    // 첫 방문 동작 자체를 검증하는 테스트는 tests/research-onboarding.spec.js에서
    // storageState를 개별적으로 비워 오버라이드한다.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:3000',
          localStorage: [
            { name: 'mnmHistoryResearchTutorialSeen', value: 'true' },
            { name: 'mnmAppUsageTutorialSeen', value: 'true' },
          ],
        },
      ],
    },
  },

  projects: [
    {
      name: 'chromium-desktop-1920',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
  ],

  webServer: {
    // 외부 API를 쓰지 않고 익명 산출물 POST도 page.route로 가로챌 수 있게 테스트 전용
    // same-origin 주소를 주입한다. 실제 Apps Script나 YouTube 할당량은 사용하지 않는다.
    command: 'YOUTUBE_API_KEY= NEXT_PUBLIC_ARTIFACT_ENDPOINT=http://localhost:3000/__artifact-test-collector NEXT_PUBLIC_ARTIFACT_APP_ID=mnm-e2e npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
