const { test, expect } = require('@playwright/test');

const RESEARCH_TUTORIAL_SEEN_KEY = 'mnmHistoryResearchTutorialSeen';
const APP_TUTORIAL_SEEN_KEY = 'mnmAppUsageTutorialSeen';

const FAKE_ANALYSIS_TEXT = `
<understanding_sentence>세종대왕은 백성을 위해 훈민정음을 만든 조선의 왕입니다.</understanding_sentence>
<easy>세종대왕은 백성이 글을 쉽게 배우도록 훈민정음을 만들었어요.</easy>
<understanding_reading>자료에서 만든 까닭과 결과를 차례로 살펴보세요.</understanding_reading>
<understanding_vocabulary>훈민정음: 백성을 가르치는 바른 소리</understanding_vocabulary>
<inquiry_questions>[사실 확인형] 훈민정음은 왜 만들었을까요?</inquiry_questions>
`;
const FAKE_SSE_BODY = `data: ${JSON.stringify(FAKE_ANALYSIS_TEXT)}\n\n`;

const LAPTOP_VIEWPORTS = [
  { name: 'windows-120-percent', width: 1600, height: 900 },
  { name: 'windows-125-percent', width: 1536, height: 864 },
];

async function preparePage(page, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.addInitScript(({ researchKey, appKey }) => {
    localStorage.setItem(researchKey, 'true');
    localStorage.setItem(appKey, 'true');
  }, { researchKey: RESEARCH_TUTORIAL_SEEN_KEY, appKey: APP_TUTORIAL_SEEN_KEY });
  await page.route('**/api/chat', route => route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body: FAKE_SSE_BODY,
  }));
  await page.route('**/api/recommended-videos', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ videos: [] }),
  }));
  await page.goto('/');
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
}

for (const viewport of LAPTOP_VIEWPORTS) {
  test.describe(`${viewport.name} (${viewport.width}×${viewport.height})`, () => {
    test('첫 화면은 조사 나침반·입력 카드·추천 자료가 한 줄 3단으로 유지된다', async ({ page }) => {
      await preparePage(page, viewport);

      const compact = page.getByTestId('landing-compact');
      const sources = page.getByLabel('추천 원본자료 목록');
      const form = page.getByTestId('landing-form-column');
      const compass = page.getByTestId('research-compass');
      await expect(compact).toBeVisible();

      const [sourcesBox, formBox, compassBox] = await Promise.all([
        sources.boundingBox(),
        form.boundingBox(),
        compass.boundingBox(),
      ]);
      expect(sourcesBox).not.toBeNull();
      expect(formBox).not.toBeNull();
      expect(compassBox).not.toBeNull();
      expect(Math.abs(sourcesBox.y - formBox.y)).toBeLessThanOrEqual(2);
      expect(Math.abs(formBox.y - compassBox.y)).toBeLessThanOrEqual(2);
      expect(compassBox.x + compassBox.width).toBeLessThanOrEqual(formBox.x);
      expect(formBox.x + formBox.width).toBeLessThanOrEqual(sourcesBox.x);
      expect(formBox.width).toBeGreaterThan(700);
      await expectNoHorizontalOverflow(page);
    });

    test('분석 후 좌우 패널과 네 개 모드 탭이 겹치거나 잘리지 않는다', async ({ page }) => {
      await preparePage(page, viewport);
      await page.getByTestId('topic-input').fill('세종대왕');
      await page.getByTestId('source-textarea').fill(
        '세종대왕은 조선의 네 번째 왕으로 백성이 쉽게 글을 익힐 수 있도록 훈민정음을 만들었습니다.'
      );
      await page.getByTestId('analyze-button').click();
      const resultCanvas = page.getByTestId('result-canvas');
      await expect(resultCanvas).toBeVisible();
      // 진입 애니메이션이 끝난 최종 레이아웃을 측정한다. 고정 wait 대신 실제
      // computed transform이 사라질 때까지 기다려 느린 노트북에서도 안정적이다.
      await expect.poll(() => resultCanvas.evaluate(el => getComputedStyle(el).transform)).toBe('none');

      const left = await page.getByTestId('left-panel').boundingBox();
      const result = await resultCanvas.boundingBox();
      expect(left).not.toBeNull();
      expect(result).not.toBeNull();
      expect(Math.abs(left.y - result.y)).toBeLessThanOrEqual(2);
      expect(left.x + left.width).toBeLessThanOrEqual(result.x);
      expect(result.x + result.width).toBeLessThanOrEqual(viewport.width);

      for (const mode of ['understand', 'inquiry', 'presentation', 'writing']) {
        const tab = page.getByTestId(`mode-tab-${mode}`);
        await expect(tab).toBeVisible();
        const tabBox = await tab.boundingBox();
        expect(tabBox.x).toBeGreaterThanOrEqual(result.x);
        expect(tabBox.x + tabBox.width).toBeLessThanOrEqual(result.x + result.width + 1);
      }
      await expectNoHorizontalOverflow(page);
    });
  });
}
