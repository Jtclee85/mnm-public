const { test, expect } = require('@playwright/test');

const COLLECTOR_URL = '**/__artifact-test-collector';
const FAKE_ANALYSIS_TEXT = `
<understanding_sentence>AI가 만든 전체 이해 문장입니다.</understanding_sentence>
<easy>AI가 만든 쉬운 설명 전문은 연구 payload에 들어가면 안 됩니다.</easy>
<understanding_check>
이 자료는 무엇에 대한 설명인가요?
가장 중요한 낱말은 무엇인가요?
새롭게 알게 된 점은 무엇인가요?
친구에게 어떻게 설명할까요?
</understanding_check>
<inquiry_questions>
[사실 찾기] 훈민정음은 왜 만들어졌을까요?
</inquiry_questions>
<presentation_messages>핵심 메시지: AI 발표 예시</presentation_messages>
<writing_topic_sentences>중심문장 후보: AI 글쓰기 예시</writing_topic_sentences>
`;
const FAKE_SSE_BODY = `data: ${JSON.stringify(FAKE_ANALYSIS_TEXT)}\n\n`;

async function prepareArtifact(page) {
  await page.route('**/api/chat', route =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY })
  );
  await page.getByTestId('topic-input').fill('세종대왕');
  await page.getByTestId('source-textarea').fill(
    '세종대왕은 훈민정음을 만들어 백성이 글을 쉽게 배우도록 도왔습니다. 이 원문 전문도 연구 payload에는 저장하지 않습니다.'
  );
  await page.getByTestId('analyze-button').click();
  await expect(page.getByTestId('result-canvas')).toBeVisible();
  await page.locator('#u_check1').fill('훈민정음을 만든 까닭을 이해했어요.');
  await page.getByTestId('mode-tab-inquiry').click();
  await page.locator('#inq_firstThought').fill('처음에는 글자가 이미 많았다고 생각했어요.');
  await page.locator('#inq_learnedAfterChat').fill('백성이 한자를 배우기 어려웠다는 점을 알게 됐어요.');
  await page.locator('#inq_changedOrFurtherQuestion').fill('이제는 새 글자가 꼭 필요했다고 생각해요.');
  await page.getByTestId('mode-tab-presentation').click();
  await page.locator('#pres_coreMessage').fill('훈민정음은 백성을 위해 만든 글자예요.');
  await page.getByTestId('mode-tab-writing').click();
  await page.locator('#write_topicSentence').fill('세종대왕은 백성이 쉽게 쓰는 글자를 만들었어요.');
}

test.describe('뭐냐면 — 익명 학습산출물 수집', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // 공유 페이지 팝업 대신 기존 공유 흐름이 window.open까지 도달했는지만 허용한다.
      window.open = () => ({ opener: null });
    });
  });

  test('[artifact-anonymous-dedup] 최초 UUID, 학생 필드 전송, 재사용·중복·수정 버전을 검증한다', async ({ page }) => {
    const requests = [];
    await page.route(COLLECTOR_URL, async route => {
      requests.push(JSON.parse(route.request().postData()));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, duplicate: false }),
      });
    });

    await page.goto('/');
    await expect.poll(() =>
      page.evaluate(() => localStorage.getItem('mw_anonymous_id'))
    ).toMatch(/^[0-9a-f-]{36}$/i);
    const firstAnonymousId = await page.evaluate(() => localStorage.getItem('mw_anonymous_id'));

    await prepareArtifact(page);
    await page.waitForTimeout(800);
    expect(requests).toHaveLength(0);

    await page.getByTestId('share-artifact-button').click();
    await expect.poll(() => requests.length).toBe(1);

    const payload = requests[0];
    expect(payload.anonymousId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(payload.artifactId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(payload.appIdentifier).toBe('mnm-e2e');
    expect(payload.activityMode).toBe('writing');
    expect(payload.topic).toBe('세종대왕');
    expect(payload.outputType).toBe('multi_mode_learning_artifact');
    expect(payload.understanding.check1).toBe('훈민정음을 만든 까닭을 이해했어요.');
    expect(payload.inquiry.firstThought).toContain('처음에는');
    expect(payload.inquiry.learnedAfterChat).toContain('알게 됐어요');
    expect(payload.inquiry.changedOrFurtherQuestion).toContain('이제는');
    expect(payload.presentation.coreMessage).toContain('백성을 위해');
    expect(payload.writing.topicSentence).toContain('세종대왕은');
    expect(payload.sourceTitle).toBe('');
    expect(payload.sourceUrl).toBe('');

    const serialized = JSON.stringify(payload);
    for (const forbiddenKey of ['name', 'studentName', 'studentNumber', 'email', 'phone', 'school', 'ip', 'fingerprint', 'conversation', 'sourceText', 'easyExplanationSummary', 'analysisByMode', 'legacyEvidence']) {
      expect(Object.prototype.hasOwnProperty.call(payload, forbiddenKey)).toBe(false);
    }
    expect(serialized).not.toContain('AI가 만든 쉬운 설명 전문');
    expect(serialized).not.toContain('이 원문 전문도 연구 payload에는 저장하지 않습니다');

    await page.getByTestId('share-artifact-button').click();
    await page.waitForTimeout(300);
    expect(requests).toHaveLength(1);

    await page.locator('#write_topicSentence').fill('수정한 학생 중심문장입니다.');
    await page.getByTestId('share-artifact-button').click();
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1].artifactId).not.toBe(payload.artifactId);
    expect(requests[1].anonymousId).toBe(payload.anonymousId);

    await page.reload();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('mw_anonymous_id'))).toBe(payload.anonymousId);
    expect(firstAnonymousId).toBe(payload.anonymousId);
  });

  test('[artifact-server-failure] 수집 서버 오류가 기존 공유 링크 생성을 막지 않는다', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.route(COLLECTOR_URL, route => route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: 'test_failure' }),
    }));

    await page.goto('/');
    await prepareArtifact(page);
    await page.getByTestId('share-artifact-button').click();

    await expect(page.getByTestId('share-artifact-button')).toContainText('링크가 복사되었어요');
    const sharedUrl = await page.evaluate(() => navigator.clipboard.readText());
    expect(sharedUrl).toContain('/share?d=');
  });
});
