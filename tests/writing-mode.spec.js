const { test, expect } = require('@playwright/test');

// 글쓰기 모드 전면 개편 검증용 가짜 분석 결과 — 완성문 대신 발판형 구조(중심문장
// 후보+뒷받침 방향, 근거 재료, 빈칸형 문장틀, 미션형 처음-가운데-끝, 자기 점검)를
// parseSectionedResponse가 기대하는 태그 형식으로 채운다.
const FAKE_ANALYSIS_TEXT = `
<easy>이것은 테스트용 쉬운 설명입니다.</easy>
<summary>핵심 내용 1
핵심 내용 2</summary>
<keywords>키워드1
키워드2</keywords>
<vocabulary>낱말1: 설명</vocabulary>
<questions>질문1</questions>
<searches>검색어1</searches>
<reteach>다시 설명1</reteach>
<further>더 알아보기1</further>
<presentation_title>테스트 발표 제목</presentation_title>
<presentation_script>발표 대본1</presentation_script>
<presentation_order>발표 순서1</presentation_order>
<expected_questions>예상 질문1</expected_questions>
<writing_topic_sentences>
### 1. 정보형

중심문장 후보: 강화 부근리 지석묘는 청동기 시대 사람들이 만든 대표적인 고인돌이다.

### 2. 의미형

중심문장 후보: 강화 부근리 지석묘는 옛사람들이 죽은 사람을 어떻게 기리고 기억했는지 알려 주는 유적이다.

### 3. 가치형

중심문장 후보: 강화 부근리 지석묘는 우리나라 고인돌 문화의 가치를 보여 주는 소중한 문화유산이다.
</writing_topic_sentences>
<writing_support_directions>
### 1. 정보형

뒷받침하려면:
- 이것이 무엇인지 설명해 보세요.
- 언제, 어느 시대와 관련이 있는지 찾아보세요.

### 2. 의미형

뒷받침하려면:
- 왜 이런 무덤을 만들었을지 생각해 보세요.

### 3. 가치형

뒷받침하려면:
- 왜 중요한 유적인지 설명해 보세요.
</writing_support_directions>
<writing_evidence>
청동기 시대
고인돌 또는 무덤
강화 지역의 대표 유적
문화재로 보호됨</writing_evidence>
<writing_templates>
______은/는 ______ 시대에 만들어진 ______입니다.
이 유적의 특징은 ______입니다.
나는 이 자료를 통해 ______을 알게 되었습니다.</writing_templates>
<writing_outline>[처음]
- 조사한 대상이 무엇인지 알려 주세요.
- 중심문장을 한 문장으로 써 보세요.
[가운데]
- 언제 만들어졌는지 써 보세요.
- 어떤 특징이 있는지 써 보세요.
[끝]
- 새롭게 알게 된 점을 써 보세요.</writing_outline>
<writing_checklist>
중심문장이 있나요?
뒷받침문장이 중심문장과 연결되나요?
조사자료에 있는 내용을 바탕으로 썼나요?
내 생각이나 알게 된 점이 들어갔나요?</writing_checklist>
`;

const FAKE_SSE_BODY = `data: ${JSON.stringify(FAKE_ANALYSIS_TEXT)}\n\n`;

async function runAnalysisAndOpenWriting(page) {
  await page.route('**/api/chat', (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY })
  );
  await page.getByTestId('topic-input').fill('강화 부근리 지석묘');
  await page
    .getByTestId('source-textarea')
    .fill('강화 부근리 지석묘는 청동기 시대에 만들어진 고인돌으로, 강화 지역의 대표적인 문화유산이다.');
  await page.getByTestId('analyze-button').click();
  await expect(page.getByTestId('result-canvas')).toBeVisible();
  await page.getByTestId('mode-tab-writing').click();
}

test.describe('뭐냐면 — 글쓰기 모드 발판형 개편', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
  });

  test('[writing-mode] 완성된 긴 문단 대신 중심문장 후보 3개와 뒷받침 방향이 보인다', async ({ page }) => {
    await runAnalysisAndOpenWriting(page);

    const resultCanvas = page.getByTestId('result-canvas');
    await expect(resultCanvas.getByText('중심문장 고르기')).toBeVisible();
    await expect(resultCanvas.getByText('정보형').first()).toBeVisible();
    await expect(resultCanvas.getByText('의미형').first()).toBeVisible();
    await expect(resultCanvas.getByText('가치형').first()).toBeVisible();
    await expect(resultCanvas.getByText('뒷받침 방향')).toBeVisible();
    await expect(resultCanvas.getByText('이것이 무엇인지 설명해 보세요.')).toBeVisible();
  });

  test('[writing-mode] 근거 재료가 짧은 메모 형태로 보인다', async ({ page }) => {
    await runAnalysisAndOpenWriting(page);
    const resultCanvas = page.getByTestId('result-canvas');
    await expect(resultCanvas.getByText('근거 재료')).toBeVisible();
    await expect(resultCanvas.getByText('청동기 시대', { exact: true })).toBeVisible();
  });

  test('[writing-mode] 빈칸형 문장틀이 보인다', async ({ page }) => {
    await runAnalysisAndOpenWriting(page);
    const resultCanvas = page.getByTestId('result-canvas');
    await expect(resultCanvas.getByText('내 문장으로 바꿔 쓰기')).toBeVisible();
    await expect(resultCanvas.getByText(/______은\/는 ______ 시대에 만들어진/)).toBeVisible();
  });

  test('[writing-mode] 처음-가운데-끝이 완성문이 아니라 미션(질문) 형태로 보인다', async ({ page }) => {
    await runAnalysisAndOpenWriting(page);
    const resultCanvas = page.getByTestId('result-canvas');
    await expect(resultCanvas.getByText('글쓰기 미션')).toBeVisible();
    await expect(resultCanvas.getByText('조사한 대상이 무엇인지 알려 주세요.')).toBeVisible();
  });

  test('[writing-mode] 자기 점검 체크리스트가 체크 가능한 형태로 보인다', async ({ page }) => {
    await runAnalysisAndOpenWriting(page);
    const resultCanvas = page.getByTestId('result-canvas');
    await expect(resultCanvas.getByText('자기 점검')).toBeVisible();

    const firstCheckbox = resultCanvas.getByRole('checkbox').first();
    await expect(firstCheckbox).toBeVisible();
    await expect(firstCheckbox).not.toBeChecked();
    await firstCheckbox.check();
    await expect(firstCheckbox).toBeChecked();
  });

  test('[writing-mode] 대화창 안내 문구가 보인다', async ({ page }) => {
    await runAnalysisAndOpenWriting(page);
    await expect(page.getByTestId('result-canvas').getByText('우측 하단 채팅창에 문장을 붙여 넣고 물어보세요')).toBeVisible();
  });

  test('[writing-mode] 이해/탐구/발표 모드는 기존처럼 정상 작동한다', async ({ page }) => {
    await runAnalysisAndOpenWriting(page);

    await page.getByTestId('mode-tab-understand').click();
    await expect(page.getByTestId('result-canvas').getByText('자료를 나누어 읽기')).toBeVisible();

    await page.getByTestId('mode-tab-inquiry').click();
    await expect(page.getByTestId('result-canvas').getByText('어떤 질문으로 더 알아볼까?')).toBeVisible();

    await page.getByTestId('mode-tab-presentation').click();
    await expect(page.getByTestId('result-canvas').getByText('테스트 발표 제목')).toBeVisible();
  });
});

test.describe('뭐냐면 — 글쓰기 모드 모바일', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('[writing-mode-mobile] 글쓰기 결과 카드가 모바일에서 깨지지 않는다', async ({ page }) => {
    await page.goto('/');
    await runAnalysisAndOpenWriting(page);

    // 글쓰기 탭 전환은 비동기 재분석을 트리거하므로, 고정 시간 대기 대신
    // 첫 카드가 렌더링될 때까지 자동 재시도로 기다린 뒤 스냅샷한다.
    await expect(page.getByTestId('section-card').first()).toBeVisible();
    const cards = await page.getByTestId('section-card').all();
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      if (await card.isVisible()) {
        const box = await card.boundingBox();
        expect(box.width).toBeLessThanOrEqual(390);
      }
    }
  });
});
