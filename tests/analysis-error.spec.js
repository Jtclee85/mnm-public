const { test, expect } = require('@playwright/test');

// 긴 조사자료 에러 전달 UX 검증.
// 서버가 400("입력 자료가 너무 깁니다...")을 반환하면 그 원인이 사용자에게 보여야 하고,
// "아직 쉬운설명이 준비되지 않았어요" 같은 빈 결과 안내가 원인을 덮으면 안 된다.

const SERVER_TOO_LONG_ERROR = '입력 자료가 너무 깁니다. 조사자료를 짧게 줄여 주세요.';
const SERVER_RATE_LIMIT_ERROR = '지금 너무 많이 사용 중이에요. 잠시 후 다시 시도해 주세요.';
const NORMAL_SOURCE =
  '강화 부근리 지석묘는 청동기 시대에 만들어진 고인돌로, 강화 지역의 대표적인 문화유산이다.';

const FAKE_ANALYSIS_TEXT = `
<understanding_sentence>테스트 이해 문장입니다.</understanding_sentence>
<easy>테스트 쉬운설명입니다.</easy>
`;
const FAKE_SSE_BODY = `data: ${JSON.stringify(FAKE_ANALYSIS_TEXT)}\n\n`;

test.describe('뭐냐면 — 분석 실패 원인 표시', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
  });

  test('[analysis-400] 서버 400 오류 메시지가 에러 박스로 보이고, 빈 결과 안내가 덮지 않는다', async ({ page }) => {
    let chatOnceCalled = false;
    await page.route('**/api/chat', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: SERVER_TOO_LONG_ERROR }),
      })
    );
    await page.route('**/api/chat-once', (route) => {
      chatOnceCalled = true;
      return route.fulfill({ status: 400, contentType: 'application/json', body: '{}' });
    });

    await page.getByTestId('topic-input').fill('강화 부근리 지석묘');
    await page.getByTestId('source-textarea').fill(NORMAL_SOURCE);
    await page.getByTestId('analyze-button').click();

    // 서버가 알려준 실제 원인이 입력 화면 에러 박스에 그대로 보인다
    await expect(page.getByTestId('analysis-error')).toBeVisible();
    await expect(page.getByTestId('analysis-error')).toContainText(SERVER_TOO_LONG_ERROR);

    // 결과 캔버스는 열리지 않고, 빈 결과 안내도 보이지 않는다
    await expect(page.getByTestId('result-canvas')).toHaveCount(0);
    await expect(page.getByText('아직 쉬운설명이 준비되지 않았어요')).toHaveCount(0);

    // 실패해도 추천자료/나침반이 있는 첫 랜딩으로 돌아가지 않고 입력 작업 화면을 유지한다
    await expect(page.getByTestId('layout-grid')).toBeVisible();
    await expect(page.getByTestId('topic-input')).toHaveValue('강화 부근리 지석묘');
    await expect(page.getByTestId('source-textarea')).toHaveValue(NORMAL_SOURCE);

    // 400은 비스트리밍 fallback으로 해결되지 않으므로 재시도하지 않는다
    expect(chatOnceCalled).toBe(false);
  });

  test('[long-source-trimmed] 7,000자 초과 자료는 차단하지 않고 축약해 보내며 안내를 띄운다', async ({ page }) => {
    // 긴 백과사전형 자료 흉내: 핵심 키워드가 든 문단 + 잡다한 문단 여러 개 (총 12,000자 이상)
    const longSource = [
      '정의: 화엄사는 전라남도 구례군 지리산에 있는 사찰이다.',
      ...Array.from({ length: 50 }, (_, i) => `배경 설명 문단 ${i + 1}. ` + '조사 내용이 이어진다. '.repeat(25)),
      '각황전은 국보로 지정된 건물이며 석등과 석탑도 보물로 지정되어 있다.',
    ].join('\n\n');
    expect(longSource.length).toBeGreaterThan(12000);

    let sentTotalChars = 0;
    let sentSystemContent = '';
    await page.route('**/api/chat', (route) => {
      const { messages } = JSON.parse(route.request().postData());
      sentTotalChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
      sentSystemContent = messages[0]?.content || '';
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY });
    });

    await page.getByTestId('topic-input').fill('화엄사');
    await page.getByTestId('source-textarea').fill(longSource);
    await page.getByTestId('analyze-button').click();

    // 차단(400)되지 않고 분석이 진행되어 결과가 열린다
    await expect(page.getByTestId('result-canvas')).toBeVisible();
    await expect(page.getByTestId('analysis-error')).toHaveCount(0);

    // 서버로 간 전체 메시지(시스템 프롬프트 템플릿 포함)가 서버 제한(25,000자) 안이다
    expect(sentTotalChars).toBeGreaterThan(0);
    expect(sentTotalChars).toBeLessThan(25000);

    // 자료가 실제로 축약되었다: 앞쪽 핵심 문단은 담기고 뒤쪽 문단은 잘려 나갔다
    expect(sentSystemContent).toContain('정의: 화엄사');
    expect(sentSystemContent).not.toContain('배경 설명 문단 50');

    // 원본자료 탭에는 붙여넣은 전체 자료가 그대로 남아 있다
    await page.getByTestId('left-panel').getByRole('button', { name: '조사 원본자료' }).click();
    await expect(page.getByTestId('source-textarea')).toHaveValue(longSource);

    // 축약 안내가 입력 카드에 보인다
    await expect(page.getByTestId('analysis-notice')).toBeVisible();
    await expect(page.getByTestId('analysis-notice')).toContainText('자료가 길어서 핵심 내용 중심으로');
  });

  test('[analysis-429] 사용량 제한이 발생해도 첫 화면으로 돌아가지 않고 재시도할 수 있다', async ({ page }) => {
    await page.route('**/api/chat', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: SERVER_RATE_LIMIT_ERROR }),
      })
    );

    await page.getByTestId('topic-input').fill('강화 부근리 지석묘');
    await page.getByTestId('source-textarea').fill(NORMAL_SOURCE);
    await page.getByTestId('analyze-button').click();

    await expect(page.getByTestId('analysis-error')).toContainText(SERVER_RATE_LIMIT_ERROR);
    await expect(page.getByTestId('layout-grid')).toBeVisible();
    await expect(page.getByTestId('result-canvas')).toHaveCount(0);
    await expect(page.getByTestId('analyze-button')).toBeVisible();
    await expect(page.getByTestId('topic-input')).toHaveValue('강화 부근리 지석묘');
    await expect(page.getByTestId('source-textarea')).toHaveValue(NORMAL_SOURCE);
  });

  test('[error-clears] 실패 후 자료를 줄여 다시 분석하면 에러가 사라지고 정상 분석된다', async ({ page }) => {
    await page.route('**/api/chat', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: SERVER_TOO_LONG_ERROR }),
      })
    );

    await page.getByTestId('topic-input').fill('강화 부근리 지석묘');
    await page.getByTestId('source-textarea').fill(NORMAL_SOURCE);
    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('analysis-error')).toBeVisible();

    // 이번에는 서버가 정상 응답한다고 가정하고 다시 분석
    await page.unroute('**/api/chat');
    await page.route('**/api/chat', (route) =>
      route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY })
    );
    await page.getByTestId('analyze-button').click();

    await expect(page.getByTestId('result-canvas')).toBeVisible();
    await expect(page.getByTestId('analysis-error')).toHaveCount(0);
  });
});
