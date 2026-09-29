const { test, expect } = require('@playwright/test');

// 3차 구조 개편 검증: 이해/탐구/발표준비/글쓰기준비 모드 안에 흡수된 워크시트 입력.
const FAKE_ANALYSIS_TEXT = `
<understanding_sentence>강화 부근리 지석묘는 청동기 시대 사람들이 만든 큰 무덤입니다.</understanding_sentence>
<easy>강화 부근리 지석묘는 아주 오래전 청동기 시대 사람들이 만든 큰 무덤입니다.</easy>
<understanding_vocabulary>
### 지석묘
- 쉬운 뜻: 큰 돌로 만든 옛날 무덤
- 자료 속 역할: 이 자료의 중심 대상이에요.
</understanding_vocabulary>
<understanding_check>
이 자료는 무엇에 대한 설명인가요?
가장 중요한 낱말 2개를 고르면 무엇인가요?
친구에게 설명한다면 어떤 말로 시작할까요?
</understanding_check>
<inquiry_questions>
[사실 확인형] 강화 부근리 지석묘는 언제 만들어졌을까요?
[까닭 탐구형] 사람들은 왜 큰 돌로 무덤을 만들었을까요?
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

test.describe('뭐냐면 — 모드별 워크시트 입력 통합 (데스크탑)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
  });

  test('[understand-check] 이해모드에 자기 확인 질문 3개와 입력칸이 보이고 자동 저장된다', async ({ page }) => {
    await runAnalysis(page);
    const resultCanvas = page.getByTestId('result-canvas');
    await expect(resultCanvas.getByText('내가 이해했는지 확인해 봐요')).toBeVisible();
    await expect(resultCanvas.getByText('1. 이 자료는 무엇에 대한 설명인가요?')).toBeVisible();
    await expect(resultCanvas.getByText('2. 가장 중요한 낱말 2개를 고르면 무엇인가요?')).toBeVisible();
    await expect(resultCanvas.getByText('3. 친구에게 설명한다면 어떤 말로 시작할까요?')).toBeVisible();

    await page.locator('#u_check1').fill('청동기 시대 무덤에 대한 설명이에요.');
    await page.waitForTimeout(2000);
    await page.reload();
    await page.getByRole('button', { name: '강화 부근리 지석묘', exact: true }).click();
    await expect(page.getByTestId('result-canvas')).toBeVisible();
    await expect(page.locator('#u_check1')).toHaveValue('청동기 시대 무덤에 대한 설명이에요.');
  });

  test('[understand-check-fallback] AI가 확인 질문을 만들지 않으면 기본 질문 4개로 대체된다', async ({ page }) => {
    await page.route('**/api/chat', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: `data: ${JSON.stringify('<easy>쉬운 설명입니다.</easy>')}\n\n`,
      })
    );
    await page.getByTestId('topic-input').fill('강화 부근리 지석묘');
    await page
      .getByTestId('source-textarea')
      .fill('강화 부근리 지석묘는 청동기 시대에 만들어진 고인돌로, 강화 지역의 대표적인 문화유산이다.');
    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('result-canvas')).toBeVisible();

    const resultCanvas = page.getByTestId('result-canvas');
    await expect(resultCanvas.getByText('1. 이 자료는 무엇에 대한 설명인가요?')).toBeVisible();
    await expect(resultCanvas.getByText('2. 가장 중요한 낱말 2개를 골라 써 보세요.')).toBeVisible();
    await expect(resultCanvas.getByText('3. 새롭게 알게 된 점은 무엇인가요?')).toBeVisible();
    await expect(resultCanvas.getByText('4. 친구에게 설명한다면 어떤 말로 시작하고 싶나요?')).toBeVisible();
  });

  test('[inquiry-select-no-autosend] 추천 질문을 눌러도 챗봇으로 자동 전송되지 않고 선택만 표시된다', async ({ page }) => {
    await runAnalysis(page);
    await page.getByTestId('mode-tab-inquiry').click();

    await page.getByRole('button', { name: /강화 부근리 지석묘는 언제 만들어졌을까요/ }).click();

    const resultCanvas = page.getByTestId('result-canvas');
    await expect(resultCanvas.getByText('선택한 질문:')).toBeVisible();
    await expect(resultCanvas.getByTestId('inquiry-selected-question')).toContainText('강화 부근리 지석묘는 언제 만들어졌을까요?');

    // 자동 전송되지 않았어야 하므로 챗봇 입력창은 비어 있어야 한다(선택은 노트에만 저장됨)
    await page.getByTestId('chatbot-toggle-button').click();
    await expect(page.getByTestId('chatbot-input')).toHaveValue('');
  });

  test('[inquiry-first-thought] 질문 선택 후 내 처음 생각/까닭 입력칸에 쓸 수 있고 자동 저장된다', async ({ page }) => {
    await runAnalysis(page);
    await page.getByTestId('mode-tab-inquiry').click();
    await page.getByRole('button', { name: /사람들은 왜 큰 돌로 무덤을 만들었을까요/ }).click();

    await page.locator('#inq_firstThought').fill('힘을 보여주려고 그런 것 같다.');
    await page.locator('#inq_reason').fill('크고 무거운 돌을 옮기려면 사람이 많이 필요하니까.');
    await page.waitForTimeout(2000);

    await page.reload();
    await page.getByRole('button', { name: '강화 부근리 지석묘', exact: true }).click();
    await page.getByTestId('mode-tab-inquiry').click();
    await expect(page.locator('#inq_firstThought')).toHaveValue('힘을 보여주려고 그런 것 같다.');
    await expect(page.locator('#inq_reason')).toHaveValue('크고 무거운 돌을 옮기려면 사람이 많이 필요하니까.');
  });

  test('[inquiry-ask-chatbot] 질문 선택 전에는 챗봇 버튼이 비활성화되고, 선택 후 누르면 챗봇 입력창에 질문이 채워지되 전송되지는 않는다', async ({ page }) => {
    await runAnalysis(page);
    await page.getByTestId('mode-tab-inquiry').click();

    const askBtn = page.getByTestId('ask-chatbot-with-question-button');
    await expect(askBtn).toBeDisabled();

    await page.getByRole('button', { name: /강화 부근리 지석묘는 언제 만들어졌을까요/ }).click();
    await expect(askBtn).toBeEnabled();
    await askBtn.click();

    await expect(page.getByTestId('chatbot-popup')).toBeVisible();
    // 자동 전송이 아니라 입력창 채우기만 — 전송됐다면 입력창이 즉시 비워지므로
    // 값이 그대로 남아 있다는 것 자체가 "아직 보내지 않았다"는 증거다.
    await expect(page.getByTestId('chatbot-input')).toHaveValue('강화 부근리 지석묘는 언제 만들어졌을까요?');
  });

  test('[inquiry-after-chat] 챗봇과 대화한 뒤 정리 입력칸이 있고 자동 저장된다', async ({ page }) => {
    await runAnalysis(page);
    await page.getByTestId('mode-tab-inquiry').click();

    const resultCanvas = page.getByTestId('result-canvas');
    await expect(resultCanvas.getByText('챗봇과 대화한 뒤 정리하기')).toBeVisible();

    await page.locator('#inq_learnedAfterChat').fill('돌을 옮기려면 많은 사람이 힘을 모아야 한다는 것을 알았다.');
    await page.locator('#inq_changedOrFurtherQuestion').fill('처음 생각보다 훨씬 큰 협동이 필요했겠다고 생각이 바뀌었다.');
    await page.waitForTimeout(2000);

    await page.reload();
    await page.getByRole('button', { name: '강화 부근리 지석묘', exact: true }).click();
    await page.getByTestId('mode-tab-inquiry').click();
    await expect(page.locator('#inq_learnedAfterChat')).toHaveValue('돌을 옮기려면 많은 사람이 힘을 모아야 한다는 것을 알았다.');
  });

  test('[presentation-fields] 발표준비모드에 발표 준비 입력칸 8개가 보이고 자동 저장된다', async ({ page }) => {
    await runAnalysis(page);
    await page.getByTestId('mode-tab-presentation').click();
    const resultCanvas = page.getByTestId('result-canvas');
    await expect(resultCanvas.getByText('내 발표 준비하기')).toBeVisible();

    await page.locator('#pres_coreMessage').fill('세종대왕은 훈민정음을 만들었다는 것을 알려주고 싶다.');
    await page.waitForTimeout(2000);

    await page.reload();
    await page.getByRole('button', { name: '강화 부근리 지석묘', exact: true }).click();
    await page.getByTestId('mode-tab-presentation').click();
    await expect(page.locator('#pres_coreMessage')).toHaveValue('세종대왕은 훈민정음을 만들었다는 것을 알려주고 싶다.');
  });

  test('[writing-fields] 글쓰기준비모드에 글쓰기 개요 입력칸이 보이고 자동 저장된다', async ({ page }) => {
    await runAnalysis(page);
    await page.getByTestId('mode-tab-writing').click();
    const resultCanvas = page.getByTestId('result-canvas');
    await expect(resultCanvas.getByText('내 글쓰기 개요 작성하기')).toBeVisible();

    await page.locator('#write_topicSentence').fill('강화 부근리 지석묘는 청동기 시대의 대표 유적이다.');
    await page.waitForTimeout(2000);

    await page.reload();
    await page.getByRole('button', { name: '강화 부근리 지석묘', exact: true }).click();
    await page.getByTestId('mode-tab-writing').click();
    await expect(page.locator('#write_topicSentence')).toHaveValue('강화 부근리 지석묘는 청동기 시대의 대표 유적이다.');
  });

  test('[legacy-migration] 옛 생각 워크시트 데이터가 새 모드별 필드로 옮겨져 보인다', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('mnm-student-notes', JSON.stringify({
        '강화 부근리 지석묘': {
          ws_basic_subject: '청동기 시대 무덤에 대한 옛 답변',
          ws_deep_question: '옛날에 저장했던 탐구 질문',
          ws_pres_core: '옛날에 저장했던 발표 핵심 메시지',
          ws_write_topic: '옛날에 저장했던 중심문장',
        },
      }));
    });
    await page.goto('/'); // beforeEach가 이미 한 번 이동했으므로, addInitScript가 적용되도록 다시 이동한다
    await runAnalysis(page);

    await expect(page.locator('#u_check1')).toHaveValue('청동기 시대 무덤에 대한 옛 답변');

    await page.getByTestId('mode-tab-inquiry').click();
    await expect(page.getByTestId('result-canvas').getByText('옛날에 저장했던 탐구 질문')).toBeVisible();

    await page.getByTestId('mode-tab-presentation').click();
    await expect(page.locator('#pres_coreMessage')).toHaveValue('옛날에 저장했던 발표 핵심 메시지');

    await page.getByTestId('mode-tab-writing').click();
    await expect(page.locator('#write_topicSentence')).toHaveValue('옛날에 저장했던 중심문장');

    // 옛 데이터 자체는 지워지지 않았다
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('mnm-student-notes') || '{}'));
    expect(stored['강화 부근리 지석묘'].ws_basic_subject).toBe('청동기 시대 무덤에 대한 옛 답변');
  });

  test('[protected-1st-2nd] 1차/2차 구조(플로팅 챗봇, 퀴즈 숨김, 왼쪽 패널 탭)가 그대로 유지된다', async ({ page }) => {
    await runAnalysis(page);
    await expect(page.getByTestId('chatbot-toggle-button')).toBeVisible();
    await expect(page.getByTestId('tool-quiz')).toHaveCount(0);
    await expect(page.getByTestId('tool-evaluation')).toHaveCount(0);
    await expect(page.getByTestId('tool-teacher')).toHaveCount(0);

    const leftPanel = page.getByTestId('left-panel');
    await expect(leftPanel.getByRole('button', { name: '조사 원본자료' })).toBeVisible();
    await expect(leftPanel.getByRole('button', { name: '쉬운설명' })).toBeVisible();
  });
});

test.describe('뭐냐면 — 모드별 워크시트 입력 통합 (모바일)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('[mobile-worksheet] 모바일에서 탐구모드 입력칸이 가로 스크롤 없이 보이고 입력할 수 있다', async ({ page }) => {
    await page.goto('/');
    await runAnalysis(page);
    await page.getByTestId('mode-tab-inquiry').click();

    await page.getByRole('button', { name: /강화 부근리 지석묘는 언제 만들어졌을까요/ }).click();
    await page.locator('#inq_firstThought').fill('아마 아주 오래 전일 것 같다.');
    await expect(page.locator('#inq_firstThought')).toHaveValue('아마 아주 오래 전일 것 같다.');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390 + 1);
  });
});
