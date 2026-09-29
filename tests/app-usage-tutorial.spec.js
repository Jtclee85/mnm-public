const { test, expect } = require('@playwright/test');

const RESEARCH_TUTORIAL_SEEN_KEY = 'mnmHistoryResearchTutorialSeen';
const APP_TUTORIAL_SEEN_KEY = 'mnmAppUsageTutorialSeen';

async function markResearchTutorialSeen(page) {
  await page.addInitScript((key) => localStorage.setItem(key, 'true'), RESEARCH_TUTORIAL_SEEN_KEY);
}

test.describe('뭐냐면 — 6과정 앱 사용법 스포트라이트 튜토리얼', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('첫 방문에는 앱 사용법 6과정이 먼저 열린다', async ({ page, context }) => {
    let tutorialApiCalls = 0;
    await page.route('**/api/chat', (route) => { tutorialApiCalls += 1; return route.abort(); });
    await page.route('**/api/chat-once', (route) => { tutorialApiCalls += 1; return route.abort(); });
    await page.route('**/api/recommended-videos**', (route) => { tutorialApiCalls += 1; return route.abort(); });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');

    const tutorial = page.getByTestId('app-usage-tutorial');
    // 자료조사 주의점은 사용법을 마친 뒤 마지막 과정의 버튼으로 연다.
    await expect(page.getByTestId('research-tutorial-dialog')).toHaveCount(0);

    await expect(page.getByTestId('app-tutorial-typing-caret')).toBeVisible();
    await expect(page.getByTestId('app-tutorial-coach')).toBeVisible();
    await expect(page.getByText('과정 1 / 6')).toBeVisible();
    await expect(page.getByText('1. 조사 제목 입력하기')).toBeVisible();
    await expect(page.getByTestId('app-tutorial-spotlight')).toBeVisible();
    await expect(tutorial.getByRole('button', { name: '대신 입력해주세요' })).toHaveCount(0);
    await expect(page.getByTestId('topic-input')).toHaveValue('강화 고인돌');

    const nextButton = tutorial.getByRole('button', { name: '다음' });
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    await expect(page.getByText('과정 2 / 6')).toBeVisible();
    await expect(page.getByTestId('source-textarea')).toHaveValue('');
    await expect(page.getByTestId('app-tutorial-paste-animation')).toBeVisible();
    await expect(page.getByTestId('app-tutorial-paste-animation')).toContainText('Ctrl+V');
    await expect(page.getByTestId('source-textarea')).toHaveValue(/지석묘란 청동기시대 사람들이 만든 무덤/);
    await expect(page.getByTestId('source-textarea')).toHaveValue(/세계문화유산으로 등재되었다/);
    await tutorial.getByRole('button', { name: '다음' }).click();

    await expect(page.getByText('과정 3 / 6')).toBeVisible();
    await expect(tutorial.getByRole('button', { name: '다음' })).toHaveCount(0);
    await page.getByTestId('analyze-button').click();

    await expect(page.getByText('과정 4 / 6')).toBeVisible();
    await expect(page.getByRole('heading', { name: '쉬운설명 살펴보기' })).toBeVisible();
    await expect(page.getByText(/조사자료를 학생 수준에 맞게 바꾼 쉬운 설명/)).toBeVisible();
    await expect(page.getByText(/어려운 낱말을 클릭하면 쉬운 뜻/)).toBeVisible();
    await expect(page.getByTestId('tutorial-easy-explanation')).toBeVisible();
    await expect(page.getByRole('button', { name: '지석묘' }).first()).toBeVisible();
    await expect(page.getByText('어려운 낱말 클릭해서 보기')).toHaveCount(0);
    const recommendedVideos = page.getByTestId('recommended-videos');
    await expect(recommendedVideos).toBeVisible();
    await expect(recommendedVideos).toContainText('강화 고인돌을 영상으로 더 알아보기');
    await expect(recommendedVideos).toContainText('국가유산채널');
    await tutorial.getByRole('button', { name: '다음' }).click();

    await expect(page.getByText('모드 1 / 4')).toBeVisible();
    await expect(page.getByText('강화 고인돌 예시 답안이 채워져 있어요.')).toHaveCount(0);
    await expect(page.getByText(/쉬운 설명과 원문을 비교하며 핵심 내용을 확인/)).toBeVisible();
    await expect(page.getByText('강화 고인돌은 무엇이며, 다른 말로 무엇이라고 하나요?')).toBeVisible();
    await expect(page.locator('#u_check1')).toHaveValue('강화 고인돌에 대한 설명이다.');
    await expect(page.locator('#u_check4')).toHaveValue('강화 고인돌은 아주 크고 무거운 청동기시대의 무덤이다.');
    await expect.poll(async () => (await page.getByTestId('app-tutorial-spotlight').boundingBox()).height).toBeGreaterThan(250);
    await expect(tutorial.getByRole('button', { name: '다음' })).toBeEnabled();
    await tutorial.getByRole('button', { name: '다음' }).click();

    await expect(page.getByText('모드 2 / 4')).toBeVisible();
    await expect(page.getByTestId('mode-tab-inquiry')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/오늘날 우리가 고인돌 유적을 지켜야 하는 까닭/)).toBeVisible();
    await expect(page.locator('#inq_firstThought')).toHaveValue('두 고인돌은 돌을 놓은 모양이 다를 것 같다.');
    await expect(page.locator('#inq_reason')).toHaveValue(/탁자식은 탁자처럼 서 있고/);
    await expect(page.locator('#inq_learnedAfterChat')).toHaveValue(/탁자식은 땅 위에 높게 세우고/);
    await expect.poll(async () => (await page.getByTestId('app-tutorial-spotlight').boundingBox()).height).toBeGreaterThan(250);
    await tutorial.getByRole('button', { name: '다음' }).click();

    await expect(page.getByText('모드 3 / 4')).toBeVisible();
    await expect(page.getByTestId('mode-tab-presentation')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/강화 고인돌은 옛사람들의 무덤과 생활을 알 수 있게/)).toBeVisible();
    await expect(page.locator('#pres_coreMessage')).toHaveValue('강화 고인돌은 청동기시대 사람들의 생활을 보여 주는 소중한 세계문화유산이다.');
    await expect(page.locator('#pres_closingSentence')).toHaveValue(/문화유산을 잘 지켜 나가면 좋겠습니다/);
    await expect.poll(async () => (await page.getByTestId('app-tutorial-spotlight').boundingBox()).height).toBeGreaterThan(250);
    await tutorial.getByRole('button', { name: '다음' }).click();

    await expect(page.getByText('모드 4 / 4')).toBeVisible();
    await expect(page.getByTestId('mode-tab-writing')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/강화 고인돌은 오래된 역사를 보여 주는 문화재/)).toBeVisible();
    await expect(page.locator('#write_topicSentence')).toHaveValue('강화 고인돌은 청동기시대 사람들의 생활과 문화를 보여 주는 소중한 세계문화유산이다.');
    await expect(page.locator('#write_closingSentence')).toHaveValue('강화 고인돌은 옛사람들의 삶을 보여 주는 소중한 문화유산이다.');
    await expect.poll(async () => (await page.getByTestId('app-tutorial-spotlight').boundingBox()).height).toBeGreaterThan(250);
    await tutorial.getByRole('button', { name: '다음' }).click();

    await expect(page.getByText('과정 5 / 6')).toBeVisible();
    await expect(page.getByText('5. 챗봇 열기')).toBeVisible();
    await page.getByTestId('chatbot-toggle-button').click();
    await expect(page.getByText('챗봇에 질문 쓰기')).toBeVisible();
    await expect(page.getByTestId('chatbot-input')).toHaveValue('');
    await expect(tutorial.getByRole('button', { name: '다음' })).toBeEnabled();
    await tutorial.getByRole('button', { name: '다음' }).click();

    await expect(page.getByText('과정 6 / 6')).toBeVisible();
    await expect(tutorial.getByRole('button', { name: '마치기' })).toHaveCount(0);
    await expect(page.getByTestId('app-tutorial-back-to-start')).toBeVisible();
    await page.getByTestId('app-tutorial-explore-results').click();

    // 튜토리얼만 닫히고 분석 결과 학습 화면은 그대로 남는다.
    await expect(tutorial).toHaveCount(0);
    await expect(page.getByTestId('result-canvas')).toBeVisible();
    await expect(page.getByTestId('research-tutorial-dialog')).toHaveCount(0);
    expect(context.pages()).toHaveLength(1);
    const seen = await page.evaluate((key) => localStorage.getItem(key), APP_TUTORIAL_SEEN_KEY);
    expect(seen).toBe('true');
    expect(tutorialApiCalls).toBe(0);
  });

  test("마지막 과정의 '시작화면으로 돌아가기'가 첫 화면과 자료조사 주의점 팝업으로 이어진다", async ({ page }) => {
    await page.route('**/api/chat', (route) => route.abort());
    await page.route('**/api/chat-once', (route) => route.abort());
    await page.route('**/api/recommended-videos**', (route) => route.abort());
    await page.goto('/');

    const tutorial = page.getByTestId('app-usage-tutorial');
    await expect(page.getByText('과정 1 / 6')).toBeVisible();
    await tutorial.getByRole('button', { name: '다음' }).click();

    await expect(page.getByTestId('source-textarea')).toHaveValue(/세계문화유산으로 등재되었다/);
    await tutorial.getByRole('button', { name: '다음' }).click();

    await expect(page.getByText('과정 3 / 6')).toBeVisible();
    await page.getByTestId('analyze-button').click();

    await expect(page.getByText('과정 4 / 6')).toBeVisible();
    await tutorial.getByRole('button', { name: '다음' }).click();

    // 모드 워크시트 4개를 지나 챗봇 과정으로 넘어간다.
    for (let mode = 1; mode <= 4; mode++) {
      await expect(page.getByText(`모드 ${mode} / 4`)).toBeVisible();
      await tutorial.getByRole('button', { name: '다음' }).click();
    }

    await expect(page.getByText('과정 5 / 6')).toBeVisible();
    await page.getByTestId('chatbot-toggle-button').click();
    await expect(page.getByText('챗봇에 질문 쓰기')).toBeVisible();
    await tutorial.getByRole('button', { name: '다음' }).click();

    await expect(page.getByText('과정 6 / 6')).toBeVisible();
    await page.getByTestId('app-tutorial-back-to-start').click();

    // 사용법은 완료로 기록하고, 첫 화면으로 돌아가 자료조사 주의점 팝업을 연다.
    await expect(tutorial).toHaveCount(0);
    await expect(page.getByTestId('research-tutorial-dialog')).toBeVisible();
    await expect(page.getByText('Step 1 / 5')).toBeVisible();
    await expect(page.getByText('Quest 1. 믿을 수 있는 자료 찾기')).toBeVisible();

    // 시연용 예시가 남지 않은 첫 화면 위에서 열린다.
    await expect(page.getByTestId('topic-input')).toHaveValue('');
    await expect(page.getByTestId('research-compass')).toBeVisible();

    const seen = await page.evaluate((key) => localStorage.getItem(key), APP_TUTORIAL_SEEN_KEY);
    expect(seen).toBe('true');
  });

  test('나중에 보기로 닫으면 헤더의 사용법 버튼으로 다시 열 수 있다', async ({ page }) => {
    await markResearchTutorialSeen(page);
    await page.goto('/');
    await page.getByRole('button', { name: '나중에 보기' }).click();
    await expect(page.getByTestId('app-usage-tutorial')).toHaveCount(0);

    await page.getByTestId('reopen-app-tutorial-button').click();
    await expect(page.getByTestId('app-tutorial-coach')).toBeVisible();
    await expect(page.getByText('과정 1 / 6')).toBeVisible();
  });

  test('다시 보지 않기는 완료 기록을 저장한다', async ({ page }) => {
    await markResearchTutorialSeen(page);
    await page.goto('/');
    await page.getByRole('button', { name: '다시 보지 않기' }).click();
    await expect(page.getByTestId('app-usage-tutorial')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('app-usage-tutorial')).toHaveCount(0);
  });

  test('API 사용량 제한과 무관하게 오프라인 결과로 분석 과정을 진행한다', async ({ page }) => {
    await markResearchTutorialSeen(page);
    let chatApiCalls = 0;
    await page.route('**/api/chat', (route) => {
      chatApiCalls += 1;
      return route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: '잠시 후 다시 시도해 주세요.' }),
      });
    });
    await page.goto('/');

    const tutorial = page.getByTestId('app-usage-tutorial');
    await expect(page.getByTestId('topic-input')).toHaveValue('강화 고인돌');
    await tutorial.getByRole('button', { name: '다음' }).click();
    await expect(page.getByTestId('app-tutorial-paste-animation')).toBeVisible();
    await expect(page.getByTestId('source-textarea')).toHaveValue(/세계문화유산으로 등재되었다/);
    await tutorial.getByRole('button', { name: '다음' }).click();
    await page.getByTestId('analyze-button').click();

    await expect(page.getByTestId('analysis-error')).toHaveCount(0);
    await expect(page.getByTestId('result-canvas')).toBeVisible();
    await expect(page.getByText('과정 4 / 6')).toBeVisible();
    await expect(page.getByRole('heading', { name: '쉬운설명 살펴보기' })).toBeVisible();
    await tutorial.getByRole('button', { name: '다음' }).click();
    await expect(page.getByText('모드 1 / 4')).toBeVisible();
    expect(chatApiCalls).toBe(0);
  });
});

test.describe('뭐냐면 — 모바일 앱 사용법 튜토리얼', () => {
  test.use({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });

  test('강조 영역과 안내 카드가 모바일 화면 밖으로 넘치지 않는다', async ({ page }) => {
    await markResearchTutorialSeen(page);
    await page.goto('/');
    const coach = page.getByTestId('app-tutorial-coach');
    const coachBox = await coach.boundingBox();
    const spotlightBox = await page.getByTestId('app-tutorial-spotlight').boundingBox();

    expect(coachBox.x).toBeGreaterThanOrEqual(0);
    expect(coachBox.x + coachBox.width).toBeLessThanOrEqual(391);
    expect(coachBox.y + coachBox.height).toBeLessThanOrEqual(845);
    expect(spotlightBox.x).toBeGreaterThanOrEqual(0);
    expect(spotlightBox.x + spotlightBox.width).toBeLessThanOrEqual(391);

    await page.getByTestId('topic-input').fill('고인돌');
    await page.getByTestId('app-usage-tutorial').getByRole('button', { name: '다음' }).click();
    await expect(page.getByText('과정 2 / 6')).toBeVisible();
  });
});
