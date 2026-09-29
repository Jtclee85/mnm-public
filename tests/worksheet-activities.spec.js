const { test, expect } = require('@playwright/test');

// 생각 워크시트 활동 카드 개편(근거 찾기 → 자료에서 증거 찾기, 깊이 생각 → 생각 넓히기) 검증.
const FAKE_ANALYSIS_TEXT = `
<understanding_sentence>테스트 핵심 문장입니다.</understanding_sentence>
<easy>이것은 테스트용 쉬운 설명입니다.</easy>
`;
const FAKE_SSE_BODY = `data: ${JSON.stringify(FAKE_ANALYSIS_TEXT)}\n\n`;

async function runAnalysis(page) {
  await page.route('**/api/chat', (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY })
  );
  await page.getByTestId('topic-input').fill('강화 부근리 지석묘');
  await page
    .getByTestId('source-textarea')
    .fill('강화 부근리 지석묘는 청동기 시대에 만들어진 고인돌로, 강화 지역의 대표적인 문화유산이다. 큰 돌을 이용해 만든 무덤으로 알려져 있다.');
  await page.getByTestId('analyze-button').click();
  await expect(page.getByTestId('result-canvas')).toBeVisible();
}

// lib/shareUtils.js의 URL-safe base64 인코딩과 동일한 방식으로 공유 데이터를 인코딩한다.
function encodeShareData(obj) {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// 3차 구조 개편: 별도 '생각 워크시트' CTA는 핵심 진입점에서 숨겼다(컴포넌트/데이터는
// 보존, components/ThinkingWorksheetDrawer.js 참고). 아래는 그 CTA를 열어야 진행되는
// 옛 테스트라 더 이상 실행할 진입점이 없으므로 skip으로 남겨 의도를 문서화한다.
test.describe('뭐냐면 — 생각 워크시트 활동 개편 (자료에서 증거 찾기 / 생각 넓히기)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
  });

  test.skip('[activity-rename] 활동 카드명이 새 이름으로 바뀌고 옛 이름은 보이지 않는다 — CTA가 숨겨져 더 이상 열 수 없음', async ({ page }) => {
    await runAnalysis(page);
    await page.getByTestId('worksheet-toggle-button').click();
    const leftPanel = page.getByTestId('left-panel');

    await expect(leftPanel.getByRole('button', { name: /자료에서 증거 찾기/ })).toBeVisible();
    await expect(leftPanel.getByRole('button', { name: '💡 생각 넓히기' })).toBeVisible();
    await expect(leftPanel.getByText('근거 찾기', { exact: true })).toHaveCount(0);
    await expect(leftPanel.getByText('깊이 생각', { exact: true })).toHaveCount(0);
  });

  test.skip('[evidence-structure] 자료에서 증거 찾기가 주장-증거-연결-다시쓰기 구조로 보인다 — CTA가 숨겨져 더 이상 열 수 없음', async ({ page }) => {
    await runAnalysis(page);
    await page.getByTestId('worksheet-toggle-button').click();
    const leftPanel = page.getByTestId('left-panel');

    await leftPanel.getByRole('button', { name: /자료에서 증거 찾기/ }).click();
    await expect(leftPanel.getByText('내 생각을 자료 속 증거로 뒷받침해 보세요.')).toBeVisible();
    await expect(leftPanel.getByText('1. 내가 말하고 싶은 생각')).toBeVisible();
    await expect(leftPanel.getByText('2. 자료에서 찾은 증거 1')).toBeVisible();
    await expect(leftPanel.getByText('2. 자료에서 찾은 증거 2')).toBeVisible();
    await expect(leftPanel.getByText('3. 이 증거가 내 생각과 이어지는 까닭')).toBeVisible();
    await expect(leftPanel.getByText('4. 내 문장으로 다시 쓰기')).toBeVisible();

    // 문장틀 보조 문구도 함께 보인다
    await expect(leftPanel.getByText('나는 __________라고 생각한다.')).toBeVisible();
  });

  test.skip('[deep-structure] 생각 넓히기가 질문-처음생각-알게된점-깊어진점-불확실한점-다음질문 구조로 보인다 — CTA가 숨겨져 더 이상 열 수 없음', async ({ page }) => {
    await runAnalysis(page);
    await page.getByTestId('worksheet-toggle-button').click();
    const leftPanel = page.getByTestId('left-panel');

    await leftPanel.getByRole('button', { name: '💡 생각 넓히기' }).click();
    await expect(leftPanel.getByText('질문을 붙잡고, 내 생각이 어떻게 달라졌는지 정리해 보세요.')).toBeVisible();
    await expect(leftPanel.getByText('1. 내가 고른 질문')).toBeVisible();
    await expect(leftPanel.getByText('2. 처음 떠오른 내 생각')).toBeVisible();
    await expect(leftPanel.getByText('3. 자료를 보고 알게 된 점')).toBeVisible();
    await expect(leftPanel.getByText('4. 생각이 더 깊어진 점')).toBeVisible();
    await expect(leftPanel.getByText('5. 아직 확실하지 않은 점')).toBeVisible();
    await expect(leftPanel.getByText('6. 더 찾아보고 싶은 질문')).toBeVisible();

    // 탐구모드 결과를 복붙하는 칸이 아니라 질문 1개만 받는 구조 — placeholder가 질문 작성을 안내한다
    await expect(leftPanel.getByPlaceholder('탐구하고 싶은 질문을 써 보세요.')).toBeVisible();
  });

  test.skip('[mode-recommended] 탐구 모드에서는 생각 넓히기가 기본 선택되고 자료에서 증거 찾기에 추천 표시가 보인다 — CTA가 숨겨져 더 이상 열 수 없음', async ({ page }) => {
    await runAnalysis(page);
    await page.getByTestId('mode-tab-inquiry').click();
    await page.getByTestId('worksheet-toggle-button').click();
    const leftPanel = page.getByTestId('left-panel');

    // 탐구 모드 추천 1번(deep)이 기본 선택되어 있는지는 필드 구조로 확인
    await expect(leftPanel.getByText('1. 내가 고른 질문')).toBeVisible();

    // 추천 2번(evidence)은 선택되지 않은 상태라 "추천" 배지가 보인다
    const evidenceBtn = leftPanel.getByRole('button', { name: /자료에서 증거 찾기/ });
    await expect(evidenceBtn.getByText('추천')).toBeVisible();
  });

  test.skip('[legacy-data-preserved] 기존 근거 찾기/깊이 생각 저장값이 새 필드로 옮겨져 보존된다 — CTA가 숨겨져 더 이상 열 수 없음', async ({ page }) => {
    // 개편 전 저장된 학생 데이터를 시뮬레이션
    await page.addInitScript(() => {
      localStorage.setItem('mnm-student-notes', JSON.stringify({
        '강화 부근리 지석묘': {
          ws_ev_thought: '지석묘는 청동기 시대 유적이다.',
          ws_ev_e1: '자료 속 증거 문장입니다.',
          ws_deep_question: '왜 만들었을까?',
          ws_deep_further: '더 알아보고 싶은 옛 질문입니다.',
        },
      }));
    });
    await page.goto('/');
    await runAnalysis(page);
    await page.getByTestId('worksheet-toggle-button').click();
    const leftPanel = page.getByTestId('left-panel');

    await leftPanel.getByRole('button', { name: /자료에서 증거 찾기/ }).click();
    await expect(page.getByPlaceholder('예: 나는 이 유적이 옛사람들의 생활을 알려 준다고 생각한다.')).toHaveValue('지석묘는 청동기 시대 유적이다.');
    await expect(page.getByPlaceholder('자료에 나온 말이나 내용을 찾아 써 보세요.')).toHaveValue('자료 속 증거 문장입니다.');

    await leftPanel.getByRole('button', { name: '💡 생각 넓히기' }).click();
    await expect(page.getByPlaceholder('탐구하고 싶은 질문을 써 보세요.')).toHaveValue('왜 만들었을까?');
    await expect(page.getByPlaceholder('다음에 더 조사하고 싶은 질문을 써 보세요.')).toHaveValue('더 알아보고 싶은 옛 질문입니다.');
  });
});

test.describe('뭐냐면 — 공유 페이지 활동명 반영', () => {
  test('[share-evidence] 공유 페이지에 자료에서 증거 찾기 새 필드명이 보이고 옛 이름은 없다', async ({ page }) => {
    const url = '/share?d=' + encodeShareData({
      topic: '강화 부근리 지석묘',
      sharedAt: '2026-06-27',
      notes: {
        ws_ev_claim: '나는 이 유적이 중요하다고 생각한다.',
        ws_ev_evidence1: '자료 속 첫 번째 증거',
        ws_ev_connection: '증거가 생각을 뒷받침하기 때문이다.',
        ws_ev_final: '그래서 나는 이렇게 설명할 수 있다.',
      },
    });
    await page.goto(url);

    await expect(page.getByText('자료에서 증거 찾기', { exact: true })).toBeVisible();
    await expect(page.getByText('1. 내가 말하고 싶은 생각')).toBeVisible();
    await expect(page.getByText('나는 이 유적이 중요하다고 생각한다.')).toBeVisible();
    await expect(page.getByText('근거 찾기', { exact: true })).toHaveCount(0);
  });

  test('[share-deep] 공유 페이지에 생각 넓히기 새 필드명이 보이고 옛 이름은 없다', async ({ page }) => {
    const url = '/share?d=' + encodeShareData({
      topic: '강화 부근리 지석묘',
      sharedAt: '2026-06-27',
      notes: {
        ws_deep_question: '왜 만들었을까?',
        ws_deep_first: '처음에는 무덤이라고만 생각했다.',
        ws_deep_changed: '이제는 신앙과도 관련 있다고 생각한다.',
      },
    });
    await page.goto(url);

    await expect(page.getByText('생각 넓히기', { exact: true })).toBeVisible();
    await expect(page.getByText('1. 내가 고른 질문')).toBeVisible();
    await expect(page.getByText('4. 생각이 더 깊어진 점')).toBeVisible();
    await expect(page.getByText('깊이 생각', { exact: true })).toHaveCount(0);
  });
});
