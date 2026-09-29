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
            // Gemini 모드의 학급 코드 창이 기존 테스트의 클릭을 가로채지 않도록 이미 학급에
            // 들어온 상태로 시작한다. AI 요청은 모두 page.route mock으로 처리해 외부로 나가지 않는다.
            // 학급 코드 흐름 자체는 tests/class-code.spec.js에서 storageState를 비워 검증한다.
            { name: 'mnmClassSession', value: JSON.stringify({ code: '테스트초-0000', school: '테스트초', expiresAt: 4102444800000 }) },
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

  webServer: [
    {
      // 학급 코드 저장소(Upstash)와 Gemini를 흉내 내는 테스트 전용 메모리 서버. 실제 서비스를 쓰지 않는다.
      command: 'node tests/support/mock-upstash-server.js 3998',
      url: 'http://127.0.0.1:3998/',
      reuseExistingServer: !process.env.CI,
      timeout: 30 * 1000,
    },
    {
      // 외부 API를 쓰지 않고 익명 산출물 POST도 page.route로 가로챌 수 있게 테스트 전용
      // same-origin 주소를 주입한다. 실제 Apps Script나 YouTube 할당량은 사용하지 않는다.
      // 학급 저장소는 위 가짜 서버를, 암호화 비밀값은 테스트 전용 값을 쓴다.
      command: [
        'YOUTUBE_API_KEY=',
        'OPENAI_API_KEY=',
        'KV_REST_API_URL=',
        'KV_REST_API_TOKEN=',
        'UPSTASH_REDIS_REST_URL=http://127.0.0.1:3998',
        'UPSTASH_REDIS_REST_TOKEN=mock-upstash-token',
        // 서버에서 나가는 Gemini 요청도 같은 가짜 서버로 보낸다(실제 Google 호출 없음).
        'GEMINI_API_BASE_URL=http://127.0.0.1:3998/gemini/v1beta',
        'CLASS_KEY_SECRET=e2e-only-class-secret-not-for-production-000000',
        // 모든 테스트가 같은 localhost IP를 쓰므로 틀린 코드 시도 제한은 크게 둔다(제한 자체는 단위 테스트).
        'CLASS_FAILURE_LIMIT=100000',
        'NEXT_PUBLIC_ARTIFACT_ENDPOINT=http://localhost:3000/__artifact-test-collector',
        'NEXT_PUBLIC_ARTIFACT_APP_ID=mnm-e2e',
        'npm run dev',
      ].join(' '),
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
