const { test, expect } = require('@playwright/test');

const TUTORIAL_SEEN_KEY = 'mnmHistoryResearchTutorialSeen';
const APP_TUTORIAL_SEEN_KEY = 'mnmAppUsageTutorialSeen';
const TUTORIAL_TITLE = '자료를 조사할 때 주의점 알아보기';

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

test.describe('뭐냐면 — 자료 조사 나침반 / 자료를 조사할 때 주의점 알아보기 (5차)', () => {
  test.describe('자료를 조사할 때 주의점 알아보기 — 교육자료 튜토리얼', () => {
    // 자동 온보딩과 별개로 나침반의 다시 보기 동작을 검증하므로 두 튜토리얼을 완료 상태로 둔다.
    test.use({
      storageState: {
        cookies: [],
        origins: [{
          origin: 'http://localhost:3000',
          localStorage: [
            { name: TUTORIAL_SEEN_KEY, value: 'true' },
            { name: APP_TUTORIAL_SEEN_KEY, value: 'true' },
          ],
        }],
      },
    });

    test('나침반에서 열 수 있고, 5단계가 모두 존재한다', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('reopen-tutorial-button').click();
      await expect(page.getByText(TUTORIAL_TITLE)).toBeVisible();
      await expect(page.getByText('좋은 자료를 고르면, 좋은 탐구가 시작돼요.')).toBeVisible();
      await expect(page.getByText('Step 1 / 5')).toBeVisible();
      await expect(page.getByText('Quest 1. 믿을 수 있는 자료 찾기')).toBeVisible();
      // 시각화 요소 — 키워드 뱃지와 시각 카드
      await expect(page.getByText('믿을 수 있는 곳')).toBeVisible();
      await expect(page.getByText('먼저 보기 좋은 곳')).toBeVisible();

      for (let step = 2; step <= 5; step++) {
        await page.getByRole('button', { name: '다음' }).click();
        await expect(page.getByText(`Step ${step} / 5`)).toBeVisible();
      }
      await expect(page.getByText('Quest 5. 뭐냐면으로 탐구 시작하기')).toBeVisible();
      await expect(page.getByText('탐구 시작', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '조사 시작하기' })).toBeVisible();
      await expect(page.getByRole('button', { name: '다음' })).toHaveCount(0);
    });

    test('교실 화면에서 큰 수업용 카드와 읽기 쉬운 글자로 표시된다', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('reopen-tutorial-button').click();

      const dialog = page.getByTestId('research-tutorial-dialog');
      const dialogBox = await dialog.boundingBox();
      expect(dialogBox.width).toBeGreaterThanOrEqual(850);
      expect(dialogBox.height).toBeGreaterThanOrEqual(650);

      const bodyFontSize = await page.getByTestId('tutorial-body').evaluate(
        (element) => Number.parseFloat(getComputedStyle(element).fontSize)
      );
      const nextButtonFontSize = await page.getByRole('button', { name: '다음' }).evaluate(
        (element) => Number.parseFloat(getComputedStyle(element).fontSize)
      );
      expect(bodyFontSize).toBeGreaterThanOrEqual(18);
      expect(nextButtonFontSize).toBeGreaterThanOrEqual(17);
    });

    test('이전 버튼으로 되돌아갈 수 있다', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('reopen-tutorial-button').click();
      await expect(page.getByRole('button', { name: '이전' })).toHaveCount(0);
      await page.getByRole('button', { name: '다음' }).click();
      await expect(page.getByText('Step 2 / 5')).toBeVisible();
      await page.getByRole('button', { name: '이전' }).click();
      await expect(page.getByText('Step 1 / 5')).toBeVisible();
    });

    test('건너뛰기로 닫은 뒤 나침반에서 다시 열 수 있다', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('reopen-tutorial-button').click();
      await page.getByRole('button', { name: '건너뛰기' }).click();
      await expect(page.getByText(TUTORIAL_TITLE)).toHaveCount(0);

      await page.reload();
      await expect(page.getByText(TUTORIAL_TITLE)).toHaveCount(0);
      await page.getByTestId('reopen-tutorial-button').click();
      await expect(page.getByText(TUTORIAL_TITLE)).toBeVisible();
    });

    test('"다시 보지 않기"는 완료로 표시되어 새로고침해도 다시 뜨지 않는다', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('reopen-tutorial-button').click();
      await page.getByRole('button', { name: '다시 보지 않기' }).click();
      await expect(page.getByText(TUTORIAL_TITLE)).toHaveCount(0);

      const seen = await page.evaluate((key) => localStorage.getItem(key), TUTORIAL_SEEN_KEY);
      expect(seen).toBe('true');

      await page.reload();
      await expect(page.getByText(TUTORIAL_TITLE)).toHaveCount(0);
    });

    test('"조사 시작하기"로 완료하면 다시 뜨지 않는다', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('reopen-tutorial-button').click();
      for (let i = 0; i < 4; i++) {
        await page.getByRole('button', { name: '다음' }).click();
      }
      await page.getByRole('button', { name: '조사 시작하기' }).click();
      await expect(page.getByText(TUTORIAL_TITLE)).toHaveCount(0);

      const seen = await page.evaluate((key) => localStorage.getItem(key), TUTORIAL_SEEN_KEY);
      expect(seen).toBe('true');

      await page.reload();
      await expect(page.getByText(TUTORIAL_TITLE)).toHaveCount(0);
    });

    test('ESC로 닫을 수 있다', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('reopen-tutorial-button').click();
      await expect(page.getByText(TUTORIAL_TITLE)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByText(TUTORIAL_TITLE)).toHaveCount(0);
    });

    test('나침반의 "자료를 조사할 때 무엇을 주의해야 할까요?"로 튜토리얼을 다시 열 수 있다', async ({ page }) => {
      await page.addInitScript((key) => localStorage.setItem(key, 'true'), TUTORIAL_SEEN_KEY);
      await page.goto('/');
      await expect(page.getByText(TUTORIAL_TITLE)).toHaveCount(0);

      await page.getByTestId('reopen-tutorial-button').click();
      await expect(page.getByText(TUTORIAL_TITLE)).toBeVisible();
      await expect(page.getByText('Step 1 / 5')).toBeVisible();
    });
  });

  test.describe('자료 조사 나침반 — 랜딩 화면 고정 패널', () => {
    test('랜딩 화면에 나침반 패널과 체크리스트 5개가 항상 보인다', async ({ page }) => {
      await page.goto('/');
      const compass = page.getByTestId('research-compass');
      await expect(compass).toBeVisible();
      await expect(compass.getByText('🧭 자료 조사 나침반')).toBeVisible();
      await expect(compass.getByText('조사하기 전, 이 5가지만 살펴봐요.')).toBeVisible();
      await expect(compass.getByText('어디에서 가져온 자료인가요?')).toBeVisible();
      await expect(compass.getByText('누가 만든 자료인가요?')).toBeVisible();
      await expect(compass.getByText('언제 만들어졌거나 고쳐졌나요?')).toBeVisible();
      await expect(compass.getByText('자료 속 중요한 말은 무엇인가요?')).toBeVisible();
      await expect(compass.getByText('내 생각을 뒷받침할 근거가 있나요?')).toBeVisible();
      await expect(compass.getByTestId('reopen-tutorial-button')).toBeVisible();
    });

    test('체크리스트에 키워드 뱃지가, 하단에 자료조사 흐름도가 보인다', async ({ page }) => {
      await page.goto('/');
      const compass = page.getByTestId('research-compass');
      // 항목별 키워드 뱃지
      for (const keyword of ['출처', '만든 사람', '날짜', '핵심 낱말', '근거']) {
        await expect(compass.getByText(keyword, { exact: true })).toBeVisible();
      }
      // 하단 미니 흐름도 — step chip 안에 숫자가 함께 있어 exact 대신 부분 일치로 확인
      await expect(compass.getByText('자료조사는 이렇게 해요')).toBeVisible();
      for (const step of ['자료 찾기', '출처 확인', '근거 쓰기']) {
        await expect(compass.getByText(step)).toBeVisible();
      }
    });

    test('나침반이 왼쪽 첫 단, 추천 사이트가 오른쪽 끝 단에 배치된다', async ({ page }) => {
      await page.goto('/');
      const sourcesBox = await page.getByRole('complementary', { name: '추천 원본자료 목록' }).boundingBox();
      const compassBox = await page.getByTestId('research-compass').boundingBox();
      const formBox = await page.getByTestId('left-panel').boundingBox();

      // 좌우 컬럼 폭이 같고(대칭), 입력 폼이 두 컬럼 사이에 있다.
      expect(Math.abs(sourcesBox.width - compassBox.width)).toBeLessThanOrEqual(2);
      expect(formBox.x).toBeGreaterThan(compassBox.x + compassBox.width);
      expect(formBox.x + formBox.width).toBeLessThan(sourcesBox.x);

      // 입력 폼 중심이 화면 중심과 거의 일치한다.
      const viewportCenter = 1920 / 2;
      const formCenter = formBox.x + formBox.width / 2;
      expect(Math.abs(formCenter - viewportCenter)).toBeLessThanOrEqual(40);
    });

    test('나침반 제목 바로 아래에 자료조사 주의점 버튼이 있다', async ({ page }) => {
      await page.goto('/');
      const compass = page.getByTestId('research-compass');
      const button = compass.getByTestId('reopen-tutorial-button');
      await expect(button).toHaveText('❓ 자료를 조사할 때 무엇을 주의해야 할까요?');

      // 체크리스트 첫 항목보다 위에 있어야 제목 바로 아래라고 할 수 있다.
      const buttonBox = await button.boundingBox();
      const firstItemBox = await compass.getByText('어디에서 가져온 자료인가요?').boundingBox();
      expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(firstItemBox.y);

      await button.click();
      await expect(page.getByTestId('research-tutorial-dialog')).toBeVisible();
    });

    test('추천 자료 배너의 설명 말풍선이 화면 밖으로 넘어가지 않는다', async ({ page }) => {
      await page.goto('/');
      const sources = page.getByRole('complementary', { name: '추천 원본자료 목록' });
      const banners = sources.getByRole('link');
      const count = await banners.count();
      expect(count).toBeGreaterThan(0);

      for (let index = 0; index < count; index++) {
        const banner = banners.nth(index);
        await banner.hover();
        const tipId = await banner.getAttribute('aria-describedby');
        const tip = page.locator(`#${tipId}`);
        await expect(tip).toBeVisible();

        // 펼침 애니메이션이 끝난 위치를 본다.
        await expect.poll(async () => {
          const box = await tip.boundingBox();
          return box.x >= 0 && box.x + box.width <= 1920;
        }).toBe(true);

        // 오른쪽 컬럼이므로 배너 왼쪽으로 펼쳐져야 한다.
        const [box, bannerBox] = await Promise.all([tip.boundingBox(), banner.boundingBox()]);
        expect(box.x + box.width).toBeLessThanOrEqual(bannerBox.x + 1);
      }
    });

    test('분석을 시작하면(랜딩 화면을 벗어나면) 나침반이 사라진다', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('research-compass')).toBeVisible();

      await runAnalysis(page);

      await expect(page.getByTestId('research-compass')).toHaveCount(0);
    });
  });

  test.describe('모바일(390px) — 튜토리얼 + 나침반', () => {
    test.use({
      viewport: { width: 390, height: 844 },
      storageState: {
        cookies: [],
        origins: [{
          origin: 'http://localhost:3000',
          localStorage: [
            { name: TUTORIAL_SEEN_KEY, value: 'true' },
            { name: APP_TUTORIAL_SEEN_KEY, value: 'true' },
          ],
        }],
      },
    });

    test('모바일에서도 튜토리얼이 뜨고, 닫으면 나침반이 세로 스택 안에 보인다', async ({ page }) => {
      await page.goto('/');
      await page.getByTestId('reopen-tutorial-button').click();
      await expect(page.getByText(TUTORIAL_TITLE)).toBeVisible();

      const tutorialBox = await page.getByTestId('research-tutorial-dialog').boundingBox();
      expect(tutorialBox.x).toBeGreaterThanOrEqual(0);
      expect(tutorialBox.x + tutorialBox.width).toBeLessThanOrEqual(390 + 1);

      await page.getByRole('button', { name: '다시 보지 않기' }).click();
      await expect(page.getByText(TUTORIAL_TITLE)).toHaveCount(0);

      const compass = page.getByTestId('research-compass');
      await compass.scrollIntoViewIfNeeded();
      await expect(compass).toBeVisible();
      const box = await compass.boundingBox();
      expect(box.x + box.width).toBeLessThanOrEqual(390 + 1);
    });
  });

  test.describe('기존 기능 회귀 확인', () => {
    test('나침반/튜토리얼 도입 후에도 조사 주제/자료 입력 및 분석 시작이 정상 동작한다', async ({ page }) => {
      await page.goto('/');
      await runAnalysis(page);
    });
  });
});
