const { test, expect } = require('@playwright/test');

// 4차 구조 개편 검증: 공유 페이지가 AI 결과가 아니라 학생이 각 모드 안에서 직접 쓴
// 학습 산출물(이해 확인/탐구 정리/발표 준비/글쓰기 개요) 중심으로 보이는지 확인한다.

// lib/shareUtils.js의 URL-safe base64 인코딩과 동일한 방식으로 공유 데이터를 인코딩한다.
function encodeShareData(obj) {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

const FAKE_ANALYSIS_TEXT = `
<understanding_sentence>세종대왕은 훈민정음을 만든 조선의 4대 왕입니다.</understanding_sentence>
<easy>세종대왕은 조선의 4대 왕입니다. 백성들이 글을 쉽게 배울 수 있도록 훈민정음을 만들었습니다.</easy>
<understanding_check>
이 자료는 무엇에 대한 설명인가요?
가장 중요한 낱말 2개를 고르면 무엇인가요?
친구에게 설명한다면 어떤 말로 시작할까요?
</understanding_check>
<inquiry_questions>
[사실 확인형] 훈민정음은 언제 만들어졌을까요?
</inquiry_questions>
<presentation_messages>
### 1. 정보 전달형
핵심 메시지: 세종대왕은 훈민정음을 만들었습니다.
</presentation_messages>
<writing_topic_sentences>
### 1. 정보형
중심문장 후보: 세종대왕은 훈민정음을 만들었다.
</writing_topic_sentences>
`;
const FAKE_SSE_BODY = `data: ${JSON.stringify(FAKE_ANALYSIS_TEXT)}\n\n`;

async function runAnalysis(page, topic = '세종대왕') {
  await page.route('**/api/chat', (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY })
  );
  await page.getByTestId('topic-input').fill(topic);
  await page
    .getByTestId('source-textarea')
    .fill('세종대왕은 조선의 4대 왕으로, 훈민정음을 만들어 백성들이 글을 쉽게 배울 수 있도록 했다.');
  await page.getByTestId('analyze-button').click();
  await expect(page.getByTestId('result-canvas')).toBeVisible();
}

test.describe('뭐냐면 — 공유 버튼 (앱 화면)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
  });

  test('[share-button-visible] 결과 캔버스에 학습 산출물 공유 버튼이 보이고, 옛 워크시트 CTA는 없다', async ({ page }) => {
    await runAnalysis(page);
    await expect(page.getByTestId('share-artifact-button')).toBeVisible();
    await expect(page.getByTestId('share-artifact-button')).toContainText('학습 산출물 공유하기');
    await expect(page.getByTestId('worksheet-toggle-button')).toHaveCount(0);
  });

  test.describe('클립보드 권한 있음', () => {
    test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

    test('[share-button-copy] 공유 버튼을 누르면 링크가 클립보드에 복사되고 새 산출물 창에 안내가 뜬다', async ({ page, context }) => {
      await runAnalysis(page);
      const btn = page.getByTestId('share-artifact-button');
      const popupPromise = context.waitForEvent('page');
      await btn.click();
      const popup = await popupPromise;
      await popup.waitForLoadState('domcontentloaded');

      await expect(btn).toContainText('링크가 복사되었어요');
      await expect(page.getByTestId('share-notice')).toHaveCount(0);
      await expect(popup.getByTestId('share-system-notice')).toContainText(
        '링크가 복사되었어요. 이제 패들릿이나 게시판에 붙여넣기 할 수 있어요.'
      );

      const url = await page.evaluate(() => navigator.clipboard.readText());
      expect(url).toContain('/share?d=');
      expect(url).not.toContain('notice=');
    });
  });
});

test.describe('뭐냐면 — 공유 페이지 (학습 산출물)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('[share-filled] 모드별 학생 작성 내용이 각 카드에 표시된다', async ({ page }) => {
    const url = '/share?d=' + encodeShareData({
      topic: '세종대왕',
      sourceText: '세종대왕은 조선의 4대 왕으로 훈민정음을 만들었다.',
      easyExplanationSummary: {
        oneSentence: '세종대왕은 훈민정음을 만든 조선의 4대 왕입니다.',
        easyFullText: '세종대왕은 조선의 4대 왕입니다.',
      },
      modeInputs: {
        understanding: { check1: '세종대왕과 훈민정음에 대한 설명이에요.', check2: '', check3: '', check4: '' },
        inquiry: {
          selectedQuestion: '훈민정음은 언제 만들어졌을까요?',
          selectedQuestionType: '사실 확인형',
          firstThought: '아주 오래 전일 것 같다.',
          reason: '',
          learnedAfterChat: '1443년에 만들어졌다는 것을 알았다.',
          changedOrFurtherQuestion: '',
        },
        presentation: {
          coreMessage: '세종대왕이 훈민정음을 만든 이유를 알려주고 싶다.',
          point1: '백성들이 글을 몰라 불편했다.', point2: '', point3: '',
          expectedQuestion: '', preparedAnswer: '', openingSentence: '', closingSentence: '',
        },
        writing: {
          topicSentence: '세종대왕은 백성을 위해 훈민정음을 만들었다.',
          support1: '', support2: '', support3: '',
          evidence: '', closingThought: '', openingSentence: '', closingSentence: '',
        },
      },
      legacyWorksheet: {},
      sharedAt: '2026년 7월 4일',
    });
    await page.goto(url);

    await expect(page.getByText('뭐냐면 학습 산출물').first()).toBeVisible();
    await expect(page.getByText('세종대왕', { exact: true })).toBeVisible();

    // 이해 확인
    await expect(page.getByText('이해 확인')).toBeVisible();
    await expect(page.getByText('이 자료는 무엇에 대한 설명인가요?')).toBeVisible();
    await expect(page.getByText('세종대왕과 훈민정음에 대한 설명이에요.')).toBeVisible();
    // 작성 안 한 check2~4 질문은 보이지 않는다
    await expect(page.getByText('가장 중요한 낱말 2개를 골라 써 보세요.')).toHaveCount(0);

    // 탐구 정리
    await expect(page.getByText('탐구 정리')).toBeVisible();
    await expect(page.getByText('사실 확인형')).toBeVisible();
    await expect(page.getByText('훈민정음은 언제 만들어졌을까요?')).toBeVisible();
    await expect(page.getByText('아주 오래 전일 것 같다.')).toBeVisible();
    await expect(page.getByText('1443년에 만들어졌다는 것을 알았다.')).toBeVisible();

    // 발표 준비
    await expect(page.getByText('발표 준비')).toBeVisible();
    await expect(page.getByText('세종대왕이 훈민정음을 만든 이유를 알려주고 싶다.')).toBeVisible();
    await expect(page.getByText('1. 백성들이 글을 몰라 불편했다.')).toBeVisible();

    // 글쓰기 개요
    await expect(page.getByText('글쓰기 개요')).toBeVisible();
    await expect(page.getByText('세종대왕은 백성을 위해 훈민정음을 만들었다.')).toBeVisible();

    // 보조 자료 — 쉬운설명은 짧게, 원본자료는 접혀 있음
    await expect(page.getByText('참고한 쉬운설명')).toBeVisible();
    await expect(page.getByText('참고한 원본자료 (펼치기)')).toBeVisible();
  });

  test('[share-empty] 아무것도 작성하지 않았으면 빈 카드 대신 안내 문구만 보인다', async ({ page }) => {
    const url = '/share?d=' + encodeShareData({
      topic: '빈 학습 기록',
      sourceText: '',
      easyExplanationSummary: null,
      modeInputs: {
        understanding: { check1: '', check2: '', check3: '', check4: '' },
        inquiry: { selectedQuestion: '', selectedQuestionType: '', firstThought: '', reason: '', learnedAfterChat: '', changedOrFurtherQuestion: '' },
        presentation: { coreMessage: '', point1: '', point2: '', point3: '', expectedQuestion: '', preparedAnswer: '', openingSentence: '', closingSentence: '' },
        writing: { topicSentence: '', support1: '', support2: '', support3: '', evidence: '', closingThought: '', openingSentence: '', closingSentence: '' },
      },
      legacyWorksheet: {},
      sharedAt: '2026년 7월 4일',
    });
    await page.goto(url);

    await expect(page.getByText('아직 학생이 작성한 학습 기록이 없습니다.')).toBeVisible();
    await expect(page.getByText('이해 확인')).toHaveCount(0);
    await expect(page.getByText('탐구 정리')).toHaveCount(0);
    await expect(page.getByText('발표 준비')).toHaveCount(0);
    await expect(page.getByText('글쓰기 개요')).toHaveCount(0);
  });

  test('[share-partial-field] 섹션 안 일부 필드만 작성했으면 작성된 필드만 보인다', async ({ page }) => {
    const url = '/share?d=' + encodeShareData({
      topic: '일부만 작성',
      modeInputs: {
        understanding: { check1: '', check2: '', check3: '', check4: '' },
        inquiry: { selectedQuestion: '', selectedQuestionType: '', firstThought: '', reason: '', learnedAfterChat: '', changedOrFurtherQuestion: '' },
        presentation: {
          coreMessage: '', point1: '', point2: '두 번째 내용만 썼다.', point3: '',
          expectedQuestion: '', preparedAnswer: '', openingSentence: '', closingSentence: '',
        },
        writing: { topicSentence: '', support1: '', support2: '', support3: '', evidence: '', closingThought: '', openingSentence: '', closingSentence: '' },
      },
      sharedAt: '2026년 7월 4일',
    });
    await page.goto(url);

    await expect(page.getByText('발표 준비')).toBeVisible();
    await expect(page.getByText('2. 두 번째 내용만 썼다.')).toBeVisible();
    // 핵심 메시지는 안 썼으므로 라벨 자체가 보이면 안 된다
    await expect(page.getByText('내 발표의 핵심 메시지')).toHaveCount(0);
    // 이해/탐구/글쓰기는 전부 비었으므로 카드 자체가 없다
    await expect(page.getByText('이해 확인')).toHaveCount(0);
    await expect(page.getByText('글쓰기 개요')).toHaveCount(0);
  });

  test('[share-legacy-format] 3차 이전 옛 형식 공유 링크(topic+notes만)도 안내 문구와 함께 표시된다', async ({ page }) => {
    const url = '/share?d=' + encodeShareData({
      topic: '옛날 링크',
      notes: {
        u_check1: '옛 형식에서도 이해 확인 값이 보여야 한다.',
        pres_coreMessage: '옛 형식 발표 핵심 메시지.',
      },
      sharedAt: '2026년 6월 1일',
    });
    await page.goto(url);

    await expect(page.getByText('이전 형식의 공유 자료입니다.')).toBeVisible();
    await expect(page.getByText('옛 형식에서도 이해 확인 값이 보여야 한다.')).toBeVisible();
    await expect(page.getByText('옛 형식 발표 핵심 메시지.')).toBeVisible();
  });

  test('[share-legacy-worksheet] 3차 이전 별도 생각 워크시트(ws_*) 데이터도 이전 형식 기록으로 표시되고 중복되지 않는다', async ({ page }) => {
    const url = '/share?d=' + encodeShareData({
      topic: '옛 워크시트',
      notes: {
        ws_ev_claim: '나는 이 유적이 중요하다고 생각한다.',
        ws_ev_evidence1: '자료 속 첫 번째 증거',
      },
      sharedAt: '2026년 6월 1일',
    });
    await page.goto(url);

    await expect(page.getByText('이전 형식 기록')).toBeVisible();
    await expect(page.getByText('자료에서 증거 찾기', { exact: true })).toBeVisible();
    await expect(page.getByText('나는 이 유적이 중요하다고 생각한다.')).toBeVisible();
    // 같은 내용이 두 번 렌더링되지 않아야 한다(중복 카드 회귀 방지)
    await expect(page.getByText('나는 이 유적이 중요하다고 생각한다.')).toHaveCount(1);
  });

  test('[share-error] 읽을 수 없는 링크는 오류 안내를 보여주고 페이지가 깨지지 않는다', async ({ page }) => {
    await page.goto('/share?d=%%%not-valid-base64%%%');
    await expect(page.getByText('링크를 읽을 수 없어요.')).toBeVisible();
  });

  test('[share-print] 인쇄 시 버튼 영역이 숨겨지도록 no-print 클래스가 붙어 있다', async ({ page }) => {
    const url = '/share?d=' + encodeShareData({ topic: '인쇄 확인', sharedAt: '2026년 7월 4일' });
    await page.goto(url);
    const btnRow = page.locator('.no-print').first();
    await expect(btnRow).toBeVisible();
  });
});

test.describe('뭐냐면 — 공유 페이지 모바일', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('[share-mobile] 모바일에서도 카드가 가로 스크롤 없이 보인다', async ({ page }) => {
    const url = '/share?d=' + encodeShareData({
      topic: '모바일 확인',
      modeInputs: {
        understanding: { check1: '모바일 답변 테스트입니다.', check2: '', check3: '', check4: '' },
        inquiry: { selectedQuestion: '', selectedQuestionType: '', firstThought: '', reason: '', learnedAfterChat: '', changedOrFurtherQuestion: '' },
        presentation: { coreMessage: '', point1: '', point2: '', point3: '', expectedQuestion: '', preparedAnswer: '', openingSentence: '', closingSentence: '' },
        writing: { topicSentence: '', support1: '', support2: '', support3: '', evidence: '', closingThought: '', openingSentence: '', closingSentence: '' },
      },
      sharedAt: '2026년 7월 4일',
    });
    await page.goto(url);
    await expect(page.getByText('모바일 답변 테스트입니다.')).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390 + 1);
  });
});
