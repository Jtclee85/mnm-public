const { test, expect } = require('@playwright/test');

// 생각 워크시트 위치/열림 방식 개편(오른쪽 결과를 가리지 않고 왼쪽 패널에 임베드) 검증.
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

// 3차 구조 개편: 별도 '생각 워크시트' CTA/드로어는 핵심 진입점에서 숨겼다(컴포넌트와
// 데이터는 삭제하지 않음, components/ThinkingWorksheetDrawer.js 참고). 아래 CTA 클릭
// 흐름에 의존하던 옛 테스트들은 더 이상 실행할 진입점이 없으므로 skip으로 남겨 의도를
// 문서화하고, 대신 '핵심 진입점에서 사라졌는지'와 '각 모드 안 입력으로 흡수됐는지'는
// tests/mode-worksheet-fields.spec.js에서 검증한다.
test.describe('뭐냐면 — 생각 워크시트 위치/열림 방식 (데스크탑)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
  });

  test.skip('[worksheet-position] 워크시트 CTA가 모드 탭과 다른 행에 독립적으로 있다 — 3차에서 CTA를 숨겨 더 이상 해당 없음', async ({ page }) => {
    await runAnalysis(page);
    const worksheetBtn = page.getByTestId('worksheet-toggle-button');
    await expect(worksheetBtn).toBeVisible();
    await expect(worksheetBtn).toHaveAccessibleName('생각 워크시트 완성하기');

    const wsBox = await worksheetBtn.boundingBox();
    const tab1Box = await page.getByTestId('mode-tab-understand').boundingBox();
    // 모드 탭과 같은 행(y)에 있지 않고, 그 위에 별도 행으로 떠 있다
    expect(wsBox.y).toBeLessThan(tab1Box.y);
  });

  test('[worksheet-not-a-tab] 워크시트 CTA는 핵심 진입점에서 사라졌고, 왼쪽 패널에는 조사 원본자료/쉬운설명 탭만 남아있다', async ({ page }) => {
    await runAnalysis(page);

    // 3차 구조 개편 — 별도 워크시트 CTA는 더 이상 렌더링되지 않는다(숨김, 컴포넌트는 보존).
    await expect(page.getByTestId('worksheet-toggle-button')).toHaveCount(0);

    // 모드 탭 그룹에는 4개(이해/탐구/발표/글쓰기)만 존재해야 한다
    await expect(page.getByRole('tab')).toHaveCount(4);

    // 1차 구조 개편으로 '대화' 탭은 제거되고 우하단 플로팅 챗봇으로 이동했다.
    // 2차 구조 개편으로 왼쪽 패널은 '조사 원본자료'/'쉬운설명' 2탭이 되었고, 워크시트 탭은 없다.
    const leftPanel = page.getByTestId('left-panel');
    await expect(leftPanel.getByRole('button', { name: '조사 원본자료' })).toBeVisible();
    await expect(leftPanel.getByRole('button', { name: '쉬운설명' })).toBeVisible();
    await expect(leftPanel.getByRole('button', { name: '대화' })).toHaveCount(0);
    await expect(leftPanel.getByTestId('left-panel-tab-worksheet')).toHaveCount(0);
  });

  test.skip('[worksheet-no-cover] 워크시트를 열어도 오른쪽 결과 캔버스 위치/내용이 그대로다 — CTA가 숨겨져 더 이상 열 수 없음', async ({ page }) => {
    await runAnalysis(page);
    const resultCanvas = page.getByTestId('result-canvas');
    const before = await resultCanvas.boundingBox();

    const worksheetBtn = page.getByTestId('worksheet-toggle-button');
    await worksheetBtn.click();
    await expect(worksheetBtn).toHaveAttribute('aria-expanded', 'true');
    await page.waitForTimeout(400);

    const after = await resultCanvas.boundingBox();
    expect(Math.abs(after.x - before.x)).toBeLessThan(3);
    expect(Math.abs(after.width - before.width)).toBeLessThan(3);
    await expect(resultCanvas.getByText('한 문장으로 이해하기')).toBeVisible();
  });

  test.skip('[worksheet-left-panel] 왼쪽 패널에 생각 워크시트가 임베드되어 활동 카드가 보인다 — CTA가 숨겨져 더 이상 열 수 없음', async ({ page }) => {
    await runAnalysis(page);
    await page.getByTestId('worksheet-toggle-button').click();
    const leftPanel = page.getByTestId('left-panel');
    await expect(leftPanel.getByText('생각 워크시트', { exact: true })).toBeVisible();
    await expect(leftPanel.getByText('기초 이해')).toBeVisible();
    await expect(leftPanel.getByText('자료에서 증거 찾기')).toBeVisible();
    await expect(leftPanel.getByText('생각 넓히기')).toBeVisible();
    await expect(leftPanel.getByText('발표 준비')).toBeVisible();
    await expect(leftPanel.getByText('글쓰기 개요')).toBeVisible();
  });

  test.skip('[worksheet-back-to-source] 닫기를 누르면 조사 원본자료 화면으로 돌아가고, 대화 기록은 우하단 챗봇에 유지된다 — CTA가 숨겨져 더 이상 열 수 없음', async ({ page }) => {
    await runAnalysis(page);
    await page.getByTestId('worksheet-toggle-button').click();
    await expect(page.getByTestId('left-panel').getByText('기초 이해')).toBeVisible();

    await page.getByRole('button', { name: '생각 워크시트 닫고 조사 원본자료로 돌아가기' }).click();
    await expect(page.getByTestId('topic-input')).toBeVisible();

    // 대화 기록은 사라지지 않고 우하단 플로팅 챗봇 팝업에서 그대로 이어진다
    await page.getByTestId('chatbot-toggle-button').click();
    await expect(page.getByTestId('chatbot-popup')).toBeVisible();
  });

  test.skip('[worksheet-autosave] 입력 내용이 자동 저장되고 새로고침 후에도 유지된다 — CTA가 숨겨져 더 이상 열 수 없음(대체: mode-worksheet-fields.spec.js)', async ({ page }) => {
    await runAnalysis(page);
    await page.getByTestId('worksheet-toggle-button').click();
    const field = page.getByPlaceholder('예) 청동기 시대 사람들이 만든 무덤에 대한 설명이에요.');
    await field.fill('지석묘는 청동기 시대 무덤이다.');
    await page.waitForTimeout(2000); // notes debounce(700ms) + session debounce(1500ms) 대기

    await page.reload();
    // 새로고침 후에는 초기 입력 화면으로 돌아가므로, 저장된 조사주제 칩을 눌러 세션을 복원한다
    await page.getByRole('button', { name: '강화 부근리 지석묘' }).click();
    await expect(page.getByTestId('result-canvas')).toBeVisible();
    await page.getByTestId('worksheet-toggle-button').click();
    await expect(page.getByPlaceholder('예) 청동기 시대 사람들이 만든 무덤에 대한 설명이에요.')).toHaveValue('지석묘는 청동기 시대 무덤이다.');
  });
});

test.describe('뭐냐면 — 생각 워크시트 모바일', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.skip('[worksheet-mobile-sheet] 모바일에서는 바텀시트로 열리고 닫힌다 — 3차에서 CTA를 숨겨 더 이상 해당 없음', async ({ page }) => {
    await page.goto('/');
    await runAnalysis(page);

    const worksheetBtn = page.getByTestId('worksheet-toggle-button');
    await expect(worksheetBtn).toBeVisible();
    await worksheetBtn.click();
    await expect(worksheetBtn).toHaveAttribute('aria-expanded', 'true');

    await expect(page.getByRole('dialog', { name: '생각 워크시트' })).toBeVisible();
    await expect(page.getByText('기초 이해')).toBeVisible();

    await page.getByRole('button', { name: '생각 워크시트 닫기' }).click();
    await expect(page.getByRole('dialog', { name: '생각 워크시트' })).toHaveCount(0);
    await expect(page.getByTestId('mode-tab-understand')).toBeVisible();
  });
});
