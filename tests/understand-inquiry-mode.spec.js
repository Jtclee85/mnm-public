const { test, expect } = require('@playwright/test');

const FAKE_ANALYSIS_TEXT = `
<understanding_sentence>강화 부근리 지석묘는 청동기 시대 사람들이 만든 큰 무덤으로, 옛사람들의 생활과 믿음을 알려 주는 문화유산입니다.</understanding_sentence>
<easy>강화 부근리 지석묘는 아주 오래전 청동기 시대 사람들이 만든 큰 무덤입니다.
지석묘는 큰 돌을 이용해 만든 무덤이라서 고인돌이라고도 부릅니다.

이 유적은 옛사람들이 죽은 사람을 어떻게 기리고 기억했는지 알려 줍니다.
또 그 시대 사람들이 큰 돌을 옮기고 세울 수 있을 만큼 함께 일했다는 점도 보여 줍니다.</easy>
<understanding_vocabulary>
### 지석묘
- 쉬운 뜻: 큰 돌로 만든 옛날 무덤
- 자료 속 역할: 이 자료의 중심 대상이에요.

### 청동기 시대
- 쉬운 뜻: 사람들이 청동 도구를 쓰기 시작한 옛날 시대
- 자료 속 역할: 지석묘가 만들어진 때를 알려 줘요.
</understanding_vocabulary>
<understanding_reading>
### 1. 무엇에 대한 자료인가요?
- 자료가 설명하는 대상의 이름을 찾아보세요.

### 2. 왜 중요한가요?
- 역사적 가치나 보존해야 하는 까닭을 찾아보세요.
</understanding_reading>
<understanding_misconceptions>
지석묘는 그냥 큰 돌이 아니라 옛날 사람들이 만든 무덤이에요.
오래되었다고 해서 모두 문화재가 되는 것은 아니에요.</understanding_misconceptions>
<understanding_check>
이 자료는 무엇에 대한 설명인가요?
가장 중요한 낱말 2개를 고르면 무엇인가요?
친구에게 설명한다면 어떤 말로 시작할까요?</understanding_check>
<understanding_quiz>
문제: 강화 부근리 지석묘는 어느 시대에 만들어졌나요?
선택지:
1. 구석기 시대
2. 신석기 시대
3. 청동기 시대
4. 철기 시대
정답: 3
해설: 자료에 강화 부근리 지석묘는 청동기 시대에 만들어진 고인돌이라고 나와 있어요.
</understanding_quiz>
<inquiry_questions>
[사실 확인형] 강화 부근리 지석묘는 언제 만들어졌을까요?
[비교형] 강화 부근리 지석묘는 다른 고인돌과 어떤 점이 비슷하고 다를까요?
[까닭 탐구형] 사람들은 왜 큰 돌로 무덤을 만들었을까요?
[의미 해석형] 이 유적은 청동기 시대 사람들의 생활을 어떻게 보여 줄까요?
[생각 확장형] 오늘날 우리는 왜 이런 유적을 지켜야 할까요?
</inquiry_questions>
<presentation_messages>
### 1. 정보 전달형
핵심 메시지: 테스트 발표 메시지입니다.
</presentation_messages>
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

test.describe('뭐냐면 이해/탐구 모드 재조정', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
  });

  test('[understand-mode] 오른쪽 결과에는 나머지 이해모드 카드가 보이고, 쉬운 전체 풀이본/한 문장 요약은 왼쪽으로 옮겨졌다', async ({ page }) => {
    await runAnalysis(page);
    const resultCanvas = page.getByTestId('result-canvas');

    // '한 문장으로 이해하기' / '조사자료를 쉬운 말로 바꾸면'은 왼쪽 '쉬운설명' 패널로 이동했으므로
    // 오른쪽 결과 영역에는 더 이상 중복 표시되지 않는다.
    await expect(resultCanvas.getByText('한 문장으로 이해하기')).toHaveCount(0);
    await expect(resultCanvas.getByText('조사자료를 쉬운 말로 바꾸면')).toHaveCount(0);

    await expect(resultCanvas.getByText('자료를 나누어 읽기')).toBeVisible();
    await expect(resultCanvas.getByText('헷갈리기 쉬운 점')).toBeVisible();
    await expect(resultCanvas.getByText('내가 이해했는지 확인해 봐요')).toBeVisible();
  });

  test('[understand-quiz] 내가 이해했는지 확인해 봐요 하단에 객관식 퀴즈가 나오고 풀 수 있다', async ({ page }) => {
    await runAnalysis(page);
    const quizBox = page.getByTestId('understanding-quiz');

    await expect(quizBox.getByText('강화 부근리 지석묘는 어느 시대에 만들어졌나요?')).toBeVisible();
    // 4지선다 선택지가 모두 버튼으로 보인다 (parseQuizBlock이 순서를 섞으므로 내용으로 확인)
    for (const option of ['구석기 시대', '신석기 시대', '청동기 시대', '철기 시대']) {
      await expect(quizBox.getByRole('button', { name: new RegExp(option) })).toBeVisible();
    }

    // 정답을 골라 제출하면 정답 피드백과 해설이 보인다
    await quizBox.getByRole('button', { name: /청동기 시대/ }).click();
    await quizBox.getByRole('button', { name: '정답 확인' }).click();
    await expect(quizBox.getByText('정답이야! 잘했어 👏')).toBeVisible();
    await expect(quizBox.getByText(/청동기 시대에 만들어진 고인돌이라고 나와 있어요/)).toBeVisible();
  });

  test('[understand-mode] 분석 후 왼쪽 패널은 쉬운설명 탭을 우선으로 보여주고, 인라인 어휘 클릭이 동작한다', async ({ page }) => {
    await runAnalysis(page);
    const leftPanel = page.getByTestId('left-panel');

    // 자료 분석 이후에는 왼쪽 패널이 '쉬운설명' 탭으로 바로 열린다.
    await expect(leftPanel.getByText('한 문장으로 이해하기')).toBeVisible();
    await expect(leftPanel.getByText('조사자료를 쉬운 말로 바꾸면')).toBeVisible();
    await expect(leftPanel.getByText('강화 부근리 지석묘는 아주 오래전 청동기 시대 사람들이 만든 큰 무덤입니다.')).toBeVisible();
    await expect(leftPanel.getByText('밑줄 친 낱말을 누르면 뜻을 볼 수 있어요.')).toBeVisible();

    // 인라인 어휘 버튼 클릭 → 정의 팝업 확인
    const termButton = leftPanel.getByRole('button', { name: /지석묘/, exact: false }).first();
    await expect(termButton).toHaveAttribute('aria-expanded', 'false');
    await termButton.click();
    await expect(termButton).toHaveAttribute('aria-expanded', 'true');
    await expect(leftPanel.getByText('큰 돌로 만든 옛날 무덤')).toBeVisible();
    await expect(leftPanel.getByText('이 자료의 중심 대상이에요.')).toBeVisible();
  });

  test('[inquiry-mode] 추천 질문 버튼 중심으로 보인다', async ({ page }) => {
    await runAnalysis(page);
    await page.getByTestId('mode-tab-inquiry').click();
    const resultCanvas = page.getByTestId('result-canvas');

    await expect(resultCanvas.getByText('어떤 질문으로 더 알아볼까?')).toBeVisible();
    const factButton = resultCanvas.getByRole('button', { name: /강화 부근리 지석묘는 언제 만들어졌을까요/ });
    await expect(factButton).toBeVisible();
    // 난이도 조정: 옛 유형명(사실 확인형)도 쉬운 배지명(사실 찾기)으로 정규화되어 보인다.
    await expect(factButton.getByText('사실 찾기')).toBeVisible();
    // 질문 고르기 안내 카드는 제거됨
    await expect(resultCanvas.getByText('질문을 고를 때 생각해 봐요')).toHaveCount(0);

    await expect(resultCanvas.getByText('질문을 더 좋은 탐구 질문으로 바꾸기')).toHaveCount(0);
    await expect(resultCanvas.getByText('조사할 단서 찾기')).toHaveCount(0);
    await expect(resultCanvas.getByText('탐구 정리 카드')).toHaveCount(0);
  });

  test('[understand-inquiry-mode] 발표/글쓰기 모드는 계속 열린다', async ({ page }) => {
    await runAnalysis(page);

    await page.getByTestId('mode-tab-presentation').click();
    await expect(page.getByTestId('result-canvas').getByText('핵심 메시지 고르기')).toBeVisible();

    await page.getByTestId('mode-tab-writing').click();
    await expect(page.getByTestId('result-canvas').getByText('중심문장 고르기')).toBeVisible();
  });
});

test.describe('뭐냐면 이해/탐구 모드 모바일', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('[understand-inquiry-mobile] 이해/탐구 결과 카드가 모바일에서 깨지지 않는다', async ({ page }) => {
    await page.goto('/');
    await runAnalysis(page);

    for (const mode of ['understand', 'inquiry']) {
      await page.getByTestId(`mode-tab-${mode}`).click();
      // 모드 전환 시 비동기로 다시 분석하는 탭도 있으므로, 카드 목록을 스냅샷하기 전에
      // 로딩이 끝나고 첫 카드가 렌더링될 때까지 기다린다(고정 시간 대기 대신 자동 재시도).
      await expect(page.getByTestId('section-card').first()).toBeVisible();
      const cards = await page.getByTestId('section-card').all();
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) {
        if (await card.isVisible()) {
          const box = await card.boundingBox();
          expect(box.width).toBeLessThanOrEqual(390);
        }
      }
    }
  });
});
