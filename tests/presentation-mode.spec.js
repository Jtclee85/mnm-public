const { test, expect } = require('@playwright/test');

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
<presentation_messages>
### 1. 정보 전달형

핵심 메시지: 강화 부근리 지석묘는 청동기 시대 사람들이 만든 대표적인 고인돌이다.

이 메시지로 발표하려면:
- 이것이 무엇인지 쉬운 말로 설명할 준비를 하세요.

### 2. 역사 의미형

핵심 메시지: 강화 부근리 지석묘는 옛사람들의 죽음과 기억에 대한 생각을 보여 주는 유적이다.

이 메시지로 발표하려면:
- 왜 중요한 유적인지 자료에서 근거를 찾아보세요.

### 3. 호기심 유발형

핵심 메시지: 큰 돌로 만든 무덤을 통해 청동기 시대 사람들의 생활을 추측할 수 있다.

이 메시지로 발표하려면:
- 친구들이 궁금해할 질문을 먼저 정해 보세요.
</presentation_messages>
<presentation_audience>
어려운 낱말은 쉬운 말로 바꾸기
처음에는 질문으로 관심 끌기
중요한 말은 천천히 한 번 더 말하기
자료에 없는 내용은 추측처럼 말하지 않기</presentation_audience>
<presentation_flow>[처음]
- 친구들에게 던질 질문을 정해 보세요.
- 조사한 대상이 무엇인지 짧게 소개하세요.
[가운데]
- 이것이 무엇인지 설명하세요.
- 자료에서 찾은 근거를 함께 말하세요.
[끝]
- 새롭게 알게 된 점을 말하세요.
- 친구들에게 생각해 볼 질문을 남겨 보세요.</presentation_flow>
<presentation_evidence>
청동기 시대
고인돌 또는 무덤
강화 지역의 대표 유적
큰 돌을 이용한 구조</presentation_evidence>
<presentation_questions>
### 질문 1
- 질문: 왜 이렇게 큰 돌로 만들었을까요?
- 준비 힌트: 자료에서 만든 까닭과 특징을 찾아보세요.

### 질문 2
- 질문: 지금도 볼 수 있나요?
- 준비 힌트: 보호나 문화재와 관련된 내용을 찾아보세요.
</presentation_questions>
<presentation_visual_plan>
### 1장. 제목
- 조사 주제
- 발표자 이름
- 한 줄 질문

### 2장. 이것은 무엇일까?
- 대상의 이름
- 사진이나 그림
</presentation_visual_plan>
<presentation_templates>
안녕하세요. 저는 오늘 ______에 대해 발표하겠습니다.
제가 이 주제를 고른 까닭은 ______입니다.
가장 중요한 특징은 ______입니다.
발표를 준비하며 새롭게 알게 된 점은 ______입니다.</presentation_templates>
<presentation_checklist>
발표의 핵심 메시지가 분명한가요?
자료에 있는 내용을 바탕으로 설명했나요?
발표를 그대로 읽지 않고 내 말로 설명할 수 있나요?
친구들의 질문에 답할 준비가 되었나요?</presentation_checklist>
<writing_topic_sentences>
### 1. 정보형
중심문장 후보: 테스트 중심문장입니다.
</writing_topic_sentences>
<writing_outline>[처음]
- 조사한 대상이 무엇인지 알려 주세요.
[가운데]
- 자료를 바탕으로 설명해 보세요.
[끝]
- 새롭게 알게 된 점을 써 보세요.</writing_outline>
`;

const FAKE_SSE_BODY = `data: ${JSON.stringify(FAKE_ANALYSIS_TEXT)}\n\n`;

async function runAnalysisAndOpenPresentation(page) {
  await page.route('**/api/chat', (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY })
  );
  await page.getByTestId('topic-input').fill('강화 부근리 지석묘');
  await page
    .getByTestId('source-textarea')
    .fill('강화 부근리 지석묘는 청동기 시대에 만들어진 고인돌로, 강화 지역의 대표적인 문화유산이다.');
  await page.getByTestId('analyze-button').click();
  await expect(page.getByTestId('result-canvas')).toBeVisible();
  await page.getByTestId('mode-tab-presentation').click();
}

test.describe('뭐냐면 — 발표 모드 워크시트형 개편', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
  });

  test('[presentation-mode] 완성 대본 대신 핵심 메시지 후보와 말하기 방향이 보인다', async ({ page }) => {
    await runAnalysisAndOpenPresentation(page);
    const resultCanvas = page.getByTestId('result-canvas');

    await expect(resultCanvas.getByText('핵심 메시지 고르기')).toBeVisible();
    await expect(resultCanvas.getByText('정보 전달형')).toBeVisible();
    await expect(resultCanvas.getByText('역사 의미형')).toBeVisible();
    await expect(resultCanvas.getByText('호기심 유발형')).toBeVisible();
    await expect(resultCanvas.getByText('발표 대상과 말하기 방향')).toBeVisible();
    await expect(resultCanvas.getByText('어려운 낱말은 쉬운 말로 바꾸기')).toBeVisible();
  });

  test('[presentation-mode] 발표 흐름과 근거 재료가 미션/메모 형태로 보인다', async ({ page }) => {
    await runAnalysisAndOpenPresentation(page);
    const resultCanvas = page.getByTestId('result-canvas');

    await expect(resultCanvas.getByText('발표 흐름 짜기')).toBeVisible();
    await expect(resultCanvas.getByText('친구들에게 던질 질문을 정해 보세요.')).toBeVisible();
    await expect(resultCanvas.getByText('발표에 넣을 근거 재료')).toBeVisible();
    await expect(resultCanvas.getByText('청동기 시대', { exact: true })).toBeVisible();
  });

  test('[presentation-mode] 질문, 발표 자료 아이디어, 말하기 문장틀, 체크리스트가 보인다', async ({ page }) => {
    await runAnalysisAndOpenPresentation(page);
    const resultCanvas = page.getByTestId('result-canvas');

    await expect(resultCanvas.getByText('친구들이 궁금해할 질문').nth(1)).toBeVisible();
    await expect(resultCanvas.getByText('왜 이렇게 큰 돌로 만들었을까요?')).toBeVisible();
    await expect(resultCanvas.getByText('발표 자료 구성 아이디어')).toBeVisible();
    await expect(resultCanvas.getByText('내 말로 발표해 보기')).toBeVisible();
    await expect(resultCanvas.getByText(/안녕하세요\. 저는 오늘 ______에 대해 발표하겠습니다/)).toBeVisible();
    await expect(resultCanvas.getByText('발표 전 체크리스트')).toBeVisible();
    await expect(resultCanvas.getByRole('checkbox').first()).toBeVisible();
  });

  test('[presentation-mode] 발표 연습 피드백 안내와 다른 모드가 정상 작동한다', async ({ page }) => {
    await runAnalysisAndOpenPresentation(page);
    await expect(page.getByTestId('result-canvas').getByText('우측 하단 채팅창에 붙여 넣고 물어보세요')).toBeVisible();

    await page.getByTestId('mode-tab-understand').click();
    await expect(page.getByTestId('result-canvas').getByText('자료를 나누어 읽기')).toBeVisible();

    await page.getByTestId('mode-tab-inquiry').click();
    await expect(page.getByTestId('result-canvas').getByText('어떤 질문으로 더 알아볼까?')).toBeVisible();

    await page.getByTestId('mode-tab-writing').click();
    await expect(page.getByTestId('result-canvas').getByText('중심문장 고르기')).toBeVisible();
  });
});

test.describe('뭐냐면 — 발표 모드 모바일', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('[presentation-mode-mobile] 발표 결과 카드가 모바일에서 깨지지 않는다', async ({ page }) => {
    await page.goto('/');
    await runAnalysisAndOpenPresentation(page);

    // 발표 탭 전환은 비동기 재분석을 트리거하므로, 고정 시간 대기 대신
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
