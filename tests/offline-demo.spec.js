const { test, expect } = require('@playwright/test');

test.describe('뭐냐면 — 오프라인 데모', () => {
  test('[demo-language-api-notice] 언어 선택을 조작하면 온라인 실행 안내 팝업을 보여준다', async ({ page }) => {
    await page.goto('/offline-demo');
    await expect(page.getByTestId('app-tutorial-coach')).toContainText('심사위원 기능 안내');
    await page.keyboard.press('Escape');

    await page.locator('select').first().selectOption('en');

    const modal = page.getByTestId('demo-api-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('이 기능은 api를 사용하므로 온라인 프로그램 실행이 필요합니다.');
    await expect(page.getByTestId('demo-online-run-button')).toHaveText('온라인 프로그램 실행');
    await expect(page.getByTestId('demo-online-run-button')).toHaveAttribute('href', /https:\/\/mnm-kappa\.vercel\.app\//);
  });

  test('[demo-reviewer-guide] 심사위원용 설명으로 실제 기능 6과정을 API 없이 안내한다', async ({ page }) => {
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/')) apiRequests.push(request.url());
    });

    await page.goto('/offline-demo');

    const coach = page.getByTestId('app-tutorial-coach');
    await expect(page.getByTestId('research-tutorial-dialog')).toHaveCount(0);
    await expect(page.getByTestId('offline-demo-badge')).toContainText('API 호출 없이');
    await expect(coach).toContainText('심사위원 기능 안내 1 / 6');
    await expect(coach).toContainText('AI 분석의 맥락을 설정');
    await expect(coach.getByRole('button', { name: '다시 보지 않기' })).toHaveCount(0);
    await expect(page.getByTestId('topic-input')).toHaveValue('강화 고인돌');
    await coach.getByRole('button', { name: '다음 기능' }).click();

    await expect(coach).toContainText('원문을 그대로 붙여넣는 영역');
    await expect(page.getByTestId('source-textarea')).toHaveValue(/지석묘란 청동기시대/);
    await coach.getByRole('button', { name: '다음 기능' }).click();

    await expect(coach).toContainText('API를 호출하지 않고 저장된 분석 결과');
    await page.getByTestId('analyze-button').click();

    await expect(page.getByTestId('result-canvas')).toBeVisible();
    await expect(coach).toContainText('자료 접근성을 높입니다');
    await coach.getByRole('button', { name: '다음 기능' }).click();

    await expect(coach).toContainText('공식·교육 채널 기반 YouTube 추천');
    await expect(coach).toContainText('교사가 승인한 공공·교육 채널');
    await expect(coach).toContainText('영상·썸네일을 저장하지 않습니다');
    await expect(page.getByTestId('recommended-videos')).toBeVisible();
    await expect(page.getByTestId('recommended-videos')).toContainText('강화 고인돌');
    await coach.getByRole('button', { name: '다음 기능' }).click();

    await expect(coach).toContainText('학생이 자기 말로 답하는 워크시트');
    await coach.getByRole('button', { name: '다음 기능' }).click();
    await expect(coach).toContainText('챗봇보다 먼저 자신의 생각과 까닭');
    await coach.getByRole('button', { name: '다음 기능' }).click();
    await expect(coach).toContainText('완성 대본을 제공하지 않고');
    await coach.getByRole('button', { name: '다음 기능' }).click();
    await expect(coach).toContainText('완성 글 대신 중심문장');
    await expect(page.locator('#write_topicSentence')).not.toHaveValue('');
    await expect(page.locator('#write_support1')).not.toHaveValue('');
    await expect(page.locator('#write_support2')).not.toHaveValue('');
    await expect(page.locator('#write_support3')).not.toHaveValue('');
    await expect(page.locator('#write_evidence')).not.toHaveValue('');
    await expect(page.locator('#write_closingThought')).not.toHaveValue('');
    await expect(page.locator('#write_openingSentence')).not.toHaveValue('');
    await expect(page.locator('#write_closingSentence')).not.toHaveValue('');
    await coach.getByRole('button', { name: '다음 기능' }).click();

    await expect(coach).toContainText('플로팅 AI 도우미');
    await page.getByTestId('chatbot-toggle-button').click();
    await expect(coach).toContainText('저장된 대화 예시');
    const chatbotPopup = page.getByTestId('chatbot-popup');
    await expect(chatbotPopup).toContainText('유명한 걸그룹이 고인돌에 가봤다는데');
    await expect(chatbotPopup).toContainText('이번 조사 주제와 직접 관련이 적어 보여');
    await coach.getByRole('button', { name: '다음 기능' }).click();

    await expect(coach).toContainText('주제 이탈 질문을 안전하게 되돌리는 장치');
    await expect(coach).toContainText('아이돌 관련 질문에는 답하지 않고');
    const spotlight = page.getByTestId('app-tutorial-spotlight');
    await expect.poll(async () => (await spotlight.boundingBox())?.height || 0).toBeGreaterThan(400);
    const popupBox = await chatbotPopup.boundingBox();
    const spotlightBox = await spotlight.boundingBox();
    expect(spotlightBox.width).toBeGreaterThanOrEqual(popupBox.width * 0.9);
    expect(spotlightBox.height).toBeGreaterThanOrEqual(popupBox.height * 0.9);
    await coach.getByRole('button', { name: '다음 기능' }).click();

    await expect(coach).toContainText('학생이 네 워크시트에 직접 작성한 내용');
    await expect(page.getByTestId('share-artifact-button')).toBeVisible();
    await coach.getByRole('button', { name: '시연 마치기' }).click();
    await expect(coach).toHaveCount(0);
    expect(apiRequests).toEqual([]);
  });

  test('[demo-starts-on-input-screen] 첫 화면에서 시작하고 분석 버튼을 누르면 snapshot 결과로 전환한다', async ({ page }) => {
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/')) apiRequests.push(request.url());
    });

    await page.goto('/offline-demo');

    await expect(page.getByTestId('app-tutorial-coach')).toContainText('심사위원 기능 안내');
    await page.keyboard.press('Escape');

    await expect(page.getByTestId('topic-input')).toHaveValue('강화 고인돌');
    await expect(page.getByTestId('source-textarea')).not.toHaveValue('');
    await expect(page.getByText('자료 조사 나침반')).toBeVisible();
    await expect(page.getByTestId('result-canvas')).toHaveCount(0);
    await expect(page.getByTestId('chatbot-toggle-button')).toBeVisible();

    await page.getByTestId('chatbot-toggle-button').click({ force: true });
    await expect(page.getByTestId('chatbot-popup')).toContainText('탁자식 고인돌과 바둑판식 고인돌은 어떻게 다를까요?');
    await page.getByLabel('닫기').click();

    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('result-canvas')).toBeVisible();
    await expect(page.getByTestId('mode-tab-understand')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('조사 원본자료')).toBeVisible();
    await expect(page.getByText('쉬운설명')).toBeVisible();
    await expect(page.getByTestId('share-artifact-button')).toBeVisible();
    expect(apiRequests).toEqual([]);
  });
});
