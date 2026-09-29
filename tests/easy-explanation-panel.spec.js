const { test, expect } = require('@playwright/test');

// 2차 구조 개편(왼쪽 패널 재구성: 조사 원본자료 / 쉬운설명) 검증.
const FAKE_ANALYSIS_TEXT = `
<understanding_sentence>강화 부근리 지석묘는 청동기 시대 사람들이 만든 큰 무덤입니다.</understanding_sentence>
<easy>강화 부근리 지석묘는 아주 오래전 청동기 시대 사람들이 만든 큰 무덤입니다.</easy>
<understanding_vocabulary>
### 지석묘
- 쉬운 뜻: 큰 돌로 만든 옛날 무덤
- 자료 속 역할: 이 자료의 중심 대상이에요.
</understanding_vocabulary>
<inquiry_questions>
[사실 확인형] 강화 부근리 지석묘는 언제 만들어졌을까요?
</inquiry_questions>
<presentation_messages>
### 1. 정보 전달형
핵심 메시지: 테스트 발표 메시지입니다.
</presentation_messages>
<writing_topic_sentences>
### 1. 정보형
중심문장 후보: 테스트 중심문장입니다.
</writing_topic_sentences>
`;
const FAKE_SSE_BODY = `data: ${JSON.stringify(FAKE_ANALYSIS_TEXT)}\n\n`;

async function runAnalysis(page) {
  await page.route('**/api/chat', (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY })
  );
  await page.getByTestId('topic-input').fill('강화 부근리 지석묘');
  await page
    .getByTestId('source-textarea')
    .fill('강화 부근리 지석묘는 청동기 시대에 만들어진 고인돌로, 강화 지역의 대표적인 문화유산이다.');
  await page.getByTestId('analyze-button').click();
  await expect(page.getByTestId('result-canvas')).toBeVisible();
}

test.describe('뭐냐면 — 왼쪽 패널 조사 원본자료/쉬운설명 (데스크탑)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
  });

  test('[left-tabs] 왼쪽 패널에 조사 원본자료/쉬운설명 탭이 있고, 대화 탭은 없다', async ({ page }) => {
    await runAnalysis(page);
    const leftPanel = page.getByTestId('left-panel');
    await expect(leftPanel.getByRole('button', { name: '조사 원본자료' })).toBeVisible();
    await expect(leftPanel.getByRole('button', { name: '쉬운설명' })).toBeVisible();
    await expect(leftPanel.getByRole('button', { name: '대화' })).toHaveCount(0);

    const sourceTab = page.getByTestId('left-panel-tab-source');
    expect(Number.parseFloat(await sourceTab.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(15);
    await expect(sourceTab).toHaveCSS('border-top-style', 'solid');
    await expect(sourceTab).not.toHaveCSS('box-shadow', 'none');
  });

  test('[source-tab] 조사 원본자료 탭에서 조사 주제와 원본자료를 볼 수 있다', async ({ page }) => {
    await runAnalysis(page);
    // 분석 이후에는 '쉬운설명'이 기본으로 열리므로, 원본자료를 보려면 탭을 눌러 전환한다.
    await page.getByTestId('left-panel').getByRole('button', { name: '조사 원본자료' }).click();
    await expect(page.getByTestId('topic-input')).toHaveValue('강화 부근리 지석묘');
    await expect(page.getByTestId('source-textarea')).toHaveValue(
      '강화 부근리 지석묘는 청동기 시대에 만들어진 고인돌로, 강화 지역의 대표적인 문화유산이다.'
    );
  });

  test('[easy-tab-default] 자료 분석 직후에는 별도 클릭 없이 왼쪽 패널이 쉬운설명 탭으로 열린다', async ({ page }) => {
    await runAnalysis(page);
    const leftPanel = page.getByTestId('left-panel');
    // 쉬운설명 탭을 누르지 않아도 바로 핵심 설명과 인라인 낱말 버튼이 보여야 한다.
    await expect(leftPanel.getByText('한 문장으로 이해하기')).toBeVisible();
    await expect(leftPanel.getByText('조사자료를 쉬운 말로 바꾸면')).toBeVisible();
    await expect(leftPanel.getByText('어려운 낱말 클릭해서 보기')).toHaveCount(0);
    // 원본자료 입력 요소는 이 시점엔 보이지 않는다(조사 원본자료 탭으로 전환해야 나타남).
    await expect(page.getByTestId('topic-input')).toHaveCount(0);
  });

  test('[easy-tab-before] 이해모드 결과에 쉬운설명 태그가 없으면 안내 문구가 보인다', async ({ page }) => {
    // 왼쪽 탭 자체는 랜딩(분석 전) 화면에서는 보이지 않으므로(!showLanding 조건),
    // 분석은 했지만 이해모드 쉬운설명 태그(<easy>/<understanding_sentence>/<understanding_vocabulary>)가
    // 비어 있는 경우로 "아직 준비되지 않음" 폴백을 검증한다.
    await page.route('**/api/chat', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: `data: ${JSON.stringify('<inquiry_questions>[사실 확인형] 언제 만들어졌을까요?</inquiry_questions>')}\n\n`,
      })
    );
    await page.getByTestId('topic-input').fill('강화 부근리 지석묘');
    await page
      .getByTestId('source-textarea')
      .fill('강화 부근리 지석묘는 청동기 시대에 만들어진 고인돌로, 강화 지역의 대표적인 문화유산이다.');
    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('result-canvas')).toBeVisible();

    const leftPanel = page.getByTestId('left-panel');
    await leftPanel.getByRole('button', { name: '쉬운설명' }).click();
    await expect(leftPanel.getByText('아직 쉬운설명이 준비되지 않았어요')).toBeVisible();
  });

  test('[easy-tab-after] 분석 후 쉬운설명 탭에 핵심 설명과 인라인 낱말 버튼이 보인다', async ({ page }) => {
    await runAnalysis(page);
    const leftPanel = page.getByTestId('left-panel');
    await leftPanel.getByRole('button', { name: '쉬운설명' }).click();

    await expect(leftPanel.getByText('한 문장으로 이해하기')).toBeVisible();
    await expect(leftPanel.getByText('강화 부근리 지석묘는 청동기 시대 사람들이 만든 큰 무덤입니다.')).toBeVisible();

    await expect(leftPanel.getByText('조사자료를 쉬운 말로 바꾸면')).toBeVisible();
    await expect(leftPanel.getByText('강화 부근리 지석묘는 아주 오래전')).toBeVisible();

    await expect(leftPanel.getByText('어려운 낱말 클릭해서 보기')).toHaveCount(0);
    const termButton = leftPanel.getByRole('button', { name: /지석묘/, exact: false }).first();
    await expect(termButton).toBeVisible();
    await termButton.click();
    await expect(leftPanel.getByText('큰 돌로 만든 옛날 무덤')).toBeVisible();
  });

  test('[easy-tab-during-activity] 탐구/발표/글쓰기 모드에서도 왼쪽 쉬운설명 탭을 참고할 수 있다', async ({ page }) => {
    await runAnalysis(page);
    const leftPanel = page.getByTestId('left-panel');
    await leftPanel.getByRole('button', { name: '쉬운설명' }).click();

    for (const mode of ['inquiry', 'presentation', 'writing']) {
      await page.getByTestId(`mode-tab-${mode}`).click();
      await expect(leftPanel.getByText('한 문장으로 이해하기')).toBeVisible();
      await expect(leftPanel.getByText('조사자료를 쉬운 말로 바꾸면')).toBeVisible();
    }
  });

  test('[chatbot-still-works] 우하단 플로팅 챗봇과 퀴즈 버튼 숨김 상태가 그대로 유지된다', async ({ page }) => {
    await runAnalysis(page);
    await expect(page.getByTestId('chatbot-toggle-button')).toBeVisible();
    await expect(page.getByTestId('tool-quiz')).toHaveCount(0);
    await expect(page.getByTestId('tool-evaluation')).toHaveCount(0);
    await expect(page.getByTestId('tool-teacher')).toHaveCount(0);
  });
});

test.describe('뭐냐면 — 왼쪽 패널 조사 원본자료/쉬운설명 모바일', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('[mobile-easy-tab] 모바일에서도 탭 전환과 쉬운설명 패널이 가로 스크롤 없이 보인다', async ({ page }) => {
    await page.goto('/');
    await runAnalysis(page);

    // 모바일에서는 분석 후 결과 캔버스가 전체 화면을 덮으므로(기존 레이아웃 유지),
    // 왼쪽 탭에 접근하려면 먼저 결과 캔버스를 닫아야 한다 — 조사자료 탭도 기존에 같은 방식이었다.
    await page.getByTitle('닫기').click();

    const leftPanel = page.getByTestId('left-panel');
    await leftPanel.getByRole('button', { name: '쉬운설명' }).click();
    await expect(leftPanel.getByText('한 문장으로 이해하기')).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390 + 1);
  });
});
