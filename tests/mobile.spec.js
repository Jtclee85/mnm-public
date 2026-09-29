const { test, expect } = require('@playwright/test');

// 분석 모드 4개가 모두 그려질 수 있도록 모든 태그를 채운 가짜 분석 결과.
const FAKE_ANALYSIS_TEXT = `
<easy>이것은 테스트용 쉬운 설명입니다.</easy>
<summary>핵심 내용 1
핵심 내용 2</summary>
<keywords>키워드1
키워드2</keywords>
`;
const FAKE_SSE_BODY = `data: ${JSON.stringify(FAKE_ANALYSIS_TEXT)}\n\n`;

async function runAnalysis(page) {
  await page.route('**/api/chat', (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY })
  );
  await page.getByTestId('topic-input').fill('세종대왕');
  await page
    .getByTestId('source-textarea')
    .fill('세종대왕은 조선의 4대 왕으로, 훈민정음을 만들어 백성들이 글을 쉽게 배울 수 있도록 했다.');
  await page.getByTestId('analyze-button').click();
  await expect(page.getByTestId('result-canvas')).toBeVisible();
}

// 이 프로젝트의 주 사용 환경은 1920×1080 PC/교실 환경이며, 모바일은 보조 환경이다.
// 따라서 모바일에서는 "잘 보이는지"가 아니라 "1단 레이아웃으로 깨지지 않는지"만 확인한다.
test.describe('뭐냐면 — mobile(390px) 보조 점검', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('[mobile-390] 앱 제목이 보인다', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '뭐냐면' })).toBeVisible();
  });

  test('[mobile-390] 분석 후 결과 캔버스가 전체 화면 1단으로 깨지지 않고 보인다', async ({ page }) => {
    await runAnalysis(page);

    // 이 앱은 모바일에서 좌우 2단이 아니라, 결과 캔버스가 전체 화면을 덮는
    // 1단(풀스크린) 오버레이로 전환된다 — 좁은 화면에서 입력 패널을 절반 크기로
    // 욱여넣지 않는다는 점만 확인하면 된다.
    const resultCanvas = page.getByTestId('result-canvas');
    await expect(resultCanvas).toBeVisible();

    const resultBox = await resultCanvas.boundingBox();
    expect(resultBox.width).toBeGreaterThanOrEqual(390 - 1);
    expect(resultBox.x).toBeLessThanOrEqual(1);

    // 좁은 화면에서 가로 스크롤이 생기면 레이아웃이 깨졌다는 신호다.
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390 + 1);
  });
});
