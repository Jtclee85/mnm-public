const { test, expect } = require('@playwright/test');

// 공개용 Gemini 모드의 사용자 키 흐름 검증.
// 모든 AI API는 page.route로 가로채 실제 Gemini·OpenAI를 호출하지 않는다.
// 키는 형식만 맞춘 가짜 값이다.

const KEY_STORAGE = 'mnmGeminiApiKey';
const KEY_HEADER = 'x-mnm-ref';
const RESEARCH_TUTORIAL_SEEN_KEY = 'mnmHistoryResearchTutorialSeen';
const APP_TUTORIAL_SEEN_KEY = 'mnmAppUsageTutorialSeen';
const TEST_KEY = 'AIzaE2Efake-key-not-real_1234567890';
const NORMAL_SOURCE =
  '강화 부근리 지석묘는 청동기 시대에 만들어진 고인돌로, 강화 지역의 대표적인 문화유산이다. 탁자식 고인돌의 대표 사례로 꼽힌다.';
const FAKE_ANALYSIS_TEXT = `
<understanding_sentence>테스트 이해 문장입니다.</understanding_sentence>
<easy>테스트 쉬운설명입니다.</easy>
`;
const FAKE_SSE_BODY = `data: ${JSON.stringify(FAKE_ANALYSIS_TEXT)}\n\n`;

const EMPTY_STORAGE = { cookies: [], origins: [] };
const seenStorage = (extra = []) => ({
  cookies: [],
  origins: [{
    origin: 'http://localhost:3000',
    localStorage: [
      { name: RESEARCH_TUTORIAL_SEEN_KEY, value: 'true' },
      { name: APP_TUTORIAL_SEEN_KEY, value: 'true' },
      ...extra,
    ],
  }],
});

const readStoredKeys = (page) => page.evaluate((name) => ({
  local: localStorage.getItem(name),
  session: sessionStorage.getItem(name),
}), KEY_STORAGE);

async function mockVerify(page, { ok = true, code = 'invalid_key' } = {}) {
  const seenHeaders = [];
  await page.route('**/api/verify-ai-key', async (route) => {
    seenHeaders.push(route.request().headers()[KEY_HEADER] || '');
    if (ok) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, provider: 'gemini', model: 'gemini-3.5-flash' }) });
    } else {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'x', code }) });
    }
  });
  return seenHeaders;
}

async function fillSource(page) {
  await page.getByTestId('topic-input').fill('강화 부근리 지석묘');
  await page.getByTestId('source-textarea').fill(NORMAL_SOURCE);
}

test.describe('Gemini 키 — 첫 방문 흐름', () => {
  test.use({ storageState: EMPTY_STORAGE });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, 'true'), RESEARCH_TUTORIAL_SEEN_KEY);
    await page.route('**/api/chat', route => route.abort());
    await page.route('**/api/chat-once', route => route.abort());
    await page.route('**/api/recommended-videos**', route => route.abort());
  });

  test('사용법 6과정을 마치면 키 설정 창으로 이어지고, 필요한 안내와 조작 요소를 모두 갖춘다', async ({ page }) => {
    await page.goto('/');
    const tutorial = page.getByTestId('app-usage-tutorial');
    await expect(page.getByText('과정 1 / 6')).toBeVisible();
    // 사용법 도중에는 키 설정 창이 끼어들지 않는다.
    await expect(page.getByTestId('ai-key-dialog')).toHaveCount(0);

    await tutorial.getByRole('button', { name: '다음' }).click();
    await expect(page.getByTestId('source-textarea')).toHaveValue(/세계문화유산으로 등재되었다/);
    await tutorial.getByRole('button', { name: '다음' }).click();
    await page.getByTestId('analyze-button').click();
    await expect(page.getByText('과정 4 / 6')).toBeVisible();
    await tutorial.getByRole('button', { name: '다음' }).click();
    for (let mode = 1; mode <= 4; mode++) {
      await expect(page.getByText(`모드 ${mode} / 4`)).toBeVisible();
      await tutorial.getByRole('button', { name: '다음' }).click();
    }
    await page.getByTestId('chatbot-toggle-button').click();
    await tutorial.getByRole('button', { name: '다음' }).click();
    await expect(page.getByText('과정 6 / 6')).toBeVisible();
    await expect(page.getByTestId('ai-key-dialog')).toHaveCount(0);
    await page.getByTestId('app-tutorial-explore-results').click();

    const dialog = page.getByTestId('ai-key-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toContainText('Google AI Studio에서 받은 Gemini API 키가 필요해요');
    await expect(dialog).toContainText('이 기기(브라우저)에만 저장돼요');
    await expect(dialog).toContainText('데이터베이스에는 키를 저장하지 않아요');
    await expect(dialog).toContainText('공용 PC에서는 다 쓴 뒤 꼭 [키 삭제]');
    await expect(dialog).toContainText('키 전체를 화면에 다시 보여주지 않아요');

    const input = page.getByTestId('ai-key-input');
    await expect(input).toHaveAttribute('type', 'password');
    await expect(page.getByLabel('Gemini API 키', { exact: true })).toBeVisible();
    await page.getByTestId('ai-key-reveal-toggle').click();
    await expect(input).toHaveAttribute('type', 'text');
    await page.getByTestId('ai-key-reveal-toggle').click();
    await expect(input).toHaveAttribute('type', 'password');

    await expect(page.getByTestId('ai-key-remember')).not.toBeChecked();
    await expect(page.getByTestId('ai-key-verify')).toBeVisible();
    await expect(page.getByTestId('ai-key-later')).toHaveText('나중에 설정');
    await expect(page.getByTestId('ai-key-delete')).toHaveCount(0);

    const link = page.getByTestId('ai-key-issue-link');
    await expect(link).toHaveAttribute('href', 'https://aistudio.google.com/apikey');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('나중에 보기로 닫아도 키가 없으면 키 설정 안내로 이동한다', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '나중에 보기' }).click();
    await expect(page.getByTestId('ai-key-dialog')).toBeVisible();
  });

  test('다시 보지 않기와 키 저장 여부는 따로 관리된다', async ({ page }) => {
    await mockVerify(page);
    await page.goto('/');
    await page.getByRole('button', { name: '다시 보지 않기' }).click();
    // 사용법 기록은 남지만 키가 없으므로 키 안내는 뜬다.
    await expect(page.getByTestId('ai-key-dialog')).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), APP_TUTORIAL_SEEN_KEY)).toBe('true');

    // '나중에 설정'으로 닫은 뒤 다시 방문하면 사용법은 건너뛰고 키 안내만 다시 뜬다.
    await page.getByTestId('ai-key-later').click();
    await page.reload();
    await expect(page.getByTestId('app-usage-tutorial')).toHaveCount(0);
    await expect(page.getByTestId('ai-key-dialog')).toBeVisible();

    // 키를 이 기기에 저장해도 사용법 기록은 그대로다.
    await page.getByTestId('ai-key-input').fill(TEST_KEY);
    await page.getByTestId('ai-key-remember').check();
    await page.getByTestId('ai-key-verify').click();
    await expect(page.getByTestId('ai-key-status')).toHaveAttribute('data-status', 'success');
    expect(await page.evaluate((k) => localStorage.getItem(k), APP_TUTORIAL_SEEN_KEY)).toBe('true');
  });
});

test.describe('Gemini 키 — 저장·변경·삭제', () => {
  test.use({ storageState: seenStorage() });

  test('연결 확인에 성공하면 기본으로 sessionStorage에만 저장하고, 키 전체를 다시 보여주지 않는다', async ({ page }) => {
    const headers = await mockVerify(page);
    await page.goto('/');
    await expect(page.getByTestId('ai-key-dialog')).toBeVisible();

    // 앞뒤 공백은 지운다.
    await page.getByTestId('ai-key-input').fill(`   ${TEST_KEY}  `);
    await page.getByTestId('ai-key-verify').click();

    await expect(page.getByTestId('ai-key-status')).toHaveAttribute('data-status', 'success');
    await expect(page.getByTestId('ai-key-status')).toContainText('연결되었어요');
    expect(headers).toEqual([TEST_KEY]);
    expect(await readStoredKeys(page)).toEqual({ local: null, session: TEST_KEY });

    // 입력칸은 비워지고, 저장된 키는 끝 4자리만 보인다.
    await expect(page.getByTestId('ai-key-input')).toHaveValue('');
    await expect(page.getByTestId('ai-key-saved')).toContainText('••••••••7890');
    await expect(page.getByTestId('ai-key-saved')).toContainText('이 창에서만 사용 중');
    const html = await page.content();
    expect(html).not.toContain(TEST_KEY);
    expect(page.url()).not.toContain(TEST_KEY);
  });

  test("'이 기기에 저장'을 고른 경우에만 localStorage에 저장한다", async ({ page }) => {
    await mockVerify(page);
    await page.goto('/');
    await page.getByTestId('ai-key-input').fill(TEST_KEY);
    await page.getByTestId('ai-key-remember').check();
    await page.getByTestId('ai-key-verify').click();
    await expect(page.getByTestId('ai-key-status')).toHaveAttribute('data-status', 'success');
    expect(await readStoredKeys(page)).toEqual({ local: TEST_KEY, session: null });
    await expect(page.getByTestId('ai-key-saved')).toContainText('이 기기에 저장됨');
  });

  test('연결 확인에 실패하면 이유를 알려 주고 키를 저장하지 않는다', async ({ page }) => {
    await mockVerify(page, { ok: false, code: 'invalid_key' });
    await page.goto('/');
    await page.getByTestId('ai-key-input').fill(TEST_KEY);
    await page.getByTestId('ai-key-verify').click();
    await expect(page.getByTestId('ai-key-status')).toHaveAttribute('data-status', 'error');
    await expect(page.getByTestId('ai-key-status')).toContainText('Gemini API 키를 확인할 수 없어요');
    expect(await readStoredKeys(page)).toEqual({ local: null, session: null });
  });

  test('빈 키로는 연결 확인 요청을 보내지 않는다', async ({ page }) => {
    const headers = await mockVerify(page);
    await page.goto('/');
    await page.getByTestId('ai-key-verify').click();
    await expect(page.getByTestId('ai-key-status')).toContainText('키를 먼저 입력해 주세요');
    expect(headers).toHaveLength(0);
  });
});

test.describe('Gemini 키 — 저장된 키가 있을 때', () => {
  test.use({ storageState: seenStorage([{ name: KEY_STORAGE, value: TEST_KEY }]) });

  test('다음 방문에는 키 설정 창을 건너뛰고, 설정에서 키를 바꾸거나 지울 수 있다', async ({ page }) => {
    const headers = await mockVerify(page);
    await page.goto('/');
    await expect(page.getByTestId('topic-input')).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.getByTestId('ai-key-dialog')).toHaveCount(0);

    await page.getByTestId('open-ai-key-settings-button').click();
    await expect(page.getByTestId('ai-key-saved')).toContainText('••••••••7890');
    await expect(page.getByTestId('ai-key-later')).toHaveText('닫기');

    // 키 변경 — 기존 키가 이 기기에 저장돼 있었으므로 '이 기기에 저장' 선택을 이어받는다.
    const newKey = 'AIzaE2Esecond-fake-key-not-real_4321';
    await expect(page.getByTestId('ai-key-remember')).toBeChecked();
    await page.getByTestId('ai-key-input').fill(newKey);
    await page.getByTestId('ai-key-verify').click();
    await expect(page.getByTestId('ai-key-status')).toHaveAttribute('data-status', 'success');
    expect(headers).toEqual([newKey]);
    expect(await readStoredKeys(page)).toEqual({ local: newKey, session: null });
    await expect(page.getByTestId('ai-key-saved')).toContainText('••••••••4321');

    // 키 삭제
    await page.getByTestId('ai-key-delete').click();
    await expect(page.getByTestId('ai-key-status')).toContainText('키를 삭제했어요');
    await expect(page.getByTestId('ai-key-saved')).toHaveCount(0);
    expect(await readStoredKeys(page)).toEqual({ local: null, session: null });
  });

  test('AI 요청마다 전용 헤더로 키를 보내고, URL·산출물 전송·콘솔에는 키가 없다', async ({ page }) => {
    const consoleLines = [];
    page.on('console', msg => consoleLines.push(msg.text()));
    const requestUrls = [];
    page.on('request', req => requestUrls.push(req.url()));
    await page.addInitScript(() => { window.open = () => ({ opener: null }); });

    const chatHeaders = [];
    await page.route('**/api/chat', async (route) => {
      chatHeaders.push(route.request().headers()[KEY_HEADER]);
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY });
    });
    const relevanceHeaders = [];
    await page.route('**/api/relevance', async (route) => {
      relevanceHeaders.push(route.request().headers()[KEY_HEADER]);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ relevant: true, reason: '', redirect: '' }) });
    });
    const collected = [];
    await page.route('**/__artifact-test-collector', async (route) => {
      collected.push({ body: route.request().postData() || '', headers: route.request().headers() });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, duplicate: false }) });
    });

    await page.goto('/');
    await fillSource(page);
    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('result-canvas')).toBeVisible();
    expect(chatHeaders[0]).toBe(TEST_KEY);

    // 주제 핵심어를 직접 묻지 않는 질문 → 관련성 판정 API에도 키 헤더가 붙는다.
    await page.getByTestId('chatbot-toggle-button').click();
    await page.getByTestId('chatbot-input').fill('청동기 시대 사람들은 어떻게 살았나요?');
    await page.getByTestId('chatbot-send-button').click();
    await expect.poll(() => relevanceHeaders.length).toBe(1);
    expect(relevanceHeaders[0]).toBe(TEST_KEY);
    await expect.poll(() => chatHeaders.length).toBe(2);

    // 공유 → 익명 산출물 전송에는 키가 섞이지 않는다.
    await page.getByTestId('chatbot-toggle-button').click();
    await page.locator('#u_check1').fill('고인돌은 무덤이라는 것을 알았어요.');
    await page.getByTestId('share-artifact-button').click();
    await expect.poll(() => collected.length).toBe(1);
    expect(collected[0].body).not.toContain(TEST_KEY);
    expect(JSON.stringify(collected[0].headers)).not.toContain(TEST_KEY);
    expect(collected[0].headers[KEY_HEADER]).toBeUndefined();

    expect(requestUrls.some(url => url.includes(TEST_KEY))).toBe(false);
    expect(consoleLines.some(line => line.includes(TEST_KEY))).toBe(false);
    expect((await page.context().cookies()).some(c => c.value.includes(TEST_KEY))).toBe(false);
  });

  test('주제 핵심어를 직접 묻는 질문은 관련성 판정 API를 부르지 않는다', async ({ page }) => {
    let relevanceCalls = 0;
    await page.route('**/api/relevance', async (route) => {
      relevanceCalls += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ relevant: true }) });
    });
    let chatCalls = 0;
    await page.route('**/api/chat', async (route) => {
      chatCalls += 1;
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY });
    });

    await page.goto('/');
    await fillSource(page);
    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('result-canvas')).toBeVisible();

    await page.getByTestId('chatbot-toggle-button').click();
    await page.getByTestId('chatbot-input').fill('지석묘는 왜 만들었어요?');
    await page.getByTestId('chatbot-send-button').click();
    await expect.poll(() => chatCalls).toBe(2);
    expect(relevanceCalls).toBe(0);
  });

  test('스트리밍이 막히면 비스트리밍으로 한 번만 다시 받는다', async ({ page }) => {
    let streamCalls = 0;
    const onceHeaders = [];
    await page.route('**/api/chat', async (route) => {
      streamCalls += 1;
      await route.fulfill({ status: 502, contentType: 'text/html', body: '<html>blocked</html>' });
    });
    await page.route('**/api/chat-once', async (route) => {
      onceHeaders.push(route.request().headers()[KEY_HEADER]);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: FAKE_ANALYSIS_TEXT }) });
    });

    await page.goto('/');
    await fillSource(page);
    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('result-canvas')).toBeVisible();
    await expect(page.getByText('테스트 쉬운설명입니다.').first()).toBeVisible();
    expect(streamCalls).toBe(1);
    expect(onceHeaders).toEqual([TEST_KEY]);
  });

  test('하루 무료 할당량 초과(429)는 사용량 안내를 보여 주고 fallback으로 다시 보내지 않는다', async ({ page }) => {
    let onceCalls = 0;
    await page.route('**/api/chat', route => route.fulfill({
      status: 429, contentType: 'application/json',
      body: JSON.stringify({ error: 'server text', code: 'quota_exceeded' }),
    }));
    await page.route('**/api/chat-once', route => { onceCalls += 1; return route.abort(); });

    await page.goto('/');
    await fillSource(page);
    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('analysis-error')).toContainText('오늘 쓸 수 있는 무료 사용량을 모두 썼어요');
    await expect(page.getByTestId('analysis-error-open-key-settings')).toHaveCount(0);
    expect(onceCalls).toBe(0);
  });

  test('요청 빈도 제한(429)은 잠시 후 다시 시도하라고 안내한다', async ({ page }) => {
    await page.route('**/api/chat', route => route.fulfill({
      status: 429, contentType: 'application/json',
      body: JSON.stringify({ error: 'server text', code: 'rate_limited' }),
    }));
    await page.goto('/');
    await fillSource(page);
    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('analysis-error')).toContainText('잠시 후 다시 시도해 주세요');
  });

  test('분석 중 잘못된 키 오류가 나면 입력을 유지한 채 키 설정으로 안내한다', async ({ page }) => {
    let onceCalls = 0;
    await page.route('**/api/chat', route => route.fulfill({
      status: 401, contentType: 'application/json',
      body: JSON.stringify({ error: 'server text', code: 'invalid_key' }),
    }));
    await page.route('**/api/chat-once', route => { onceCalls += 1; return route.abort(); });

    await page.goto('/');
    await fillSource(page);
    await page.getByTestId('analyze-button').click();

    // 오류 즉시 키 설정 창이 열리고, 닫은 뒤에도 에러 박스에서 다시 열 수 있다.
    await expect(page.getByTestId('ai-key-dialog')).toBeVisible();
    await expect(page.getByTestId('ai-key-required-notice')).toContainText('Gemini API 키를 확인할 수 없어요');
    await page.getByTestId('ai-key-later').click();
    await expect(page.getByTestId('analysis-error')).toContainText('Gemini API 키를 확인할 수 없어요');
    await page.getByTestId('analysis-error-open-key-settings').click();
    await expect(page.getByTestId('ai-key-dialog')).toBeVisible();

    await expect(page.getByTestId('topic-input')).toHaveValue('강화 부근리 지석묘');
    await expect(page.getByTestId('source-textarea')).toHaveValue(NORMAL_SOURCE);
    expect(onceCalls).toBe(0);
  });

  test('분석 버튼을 연달아 눌러도 요청은 한 번만 나간다', async ({ page }) => {
    let chatCalls = 0;
    let release;
    await page.route('**/api/chat', async (route) => {
      chatCalls += 1;
      await new Promise(resolve => { release = resolve; });
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY });
    });
    await page.goto('/');
    await fillSource(page);
    // React가 버튼을 비활성화하기 전, 같은 순간에 세 번 누른다.
    await page.getByTestId('analyze-button').evaluate((button) => {
      button.click();
      button.click();
      button.click();
    });
    await expect.poll(() => typeof release).toBe('function');
    await page.waitForTimeout(300);
    expect(chatCalls).toBe(1);
    // 막힌 클릭이 진행 중인 분석 화면을 닫거나 오류를 띄우지 않는다.
    await expect(page.getByTestId('analysis-error')).toHaveCount(0);
    release();
    await expect(page.getByText('테스트 쉬운설명입니다.').first()).toBeVisible();
  });

  test('사진 글자 읽기도 키 헤더를 보내고, 할당량 초과 안내를 보여 준다', async ({ page }) => {
    const headers = [];
    await page.route('**/api/extract-sign-text', async (route) => {
      headers.push(route.request().headers()[KEY_HEADER]);
      await route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'x', code: 'quota_exceeded' }) });
    });
    await page.goto('/');
    await page.getByTestId('sign-reader-button').click();
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByTestId('sign-reader-permission-agree').click();
    const chooser = await chooserPromise;
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await chooser.setFiles({ name: 'sign.png', mimeType: 'image/png', buffer: png });
    await page.getByTestId('sign-reader-extract-button').click();
    await expect(page.getByTestId('sign-reader-modal')).toContainText('오늘 쓸 수 있는 무료 사용량을 모두 썼어요');
    expect(headers).toEqual([TEST_KEY]);
  });
});

test.describe('Gemini 키 — 키 없이 AI 기능을 누를 때', () => {
  test.use({ storageState: seenStorage() });

  test('분석 시작을 누르면 요청 없이 키 설정 창을 열고, 조사 주제와 자료는 그대로 둔다', async ({ page }) => {
    let chatCalls = 0;
    await page.route('**/api/chat**', route => { chatCalls += 1; return route.abort(); });
    await page.goto('/');
    await page.getByTestId('ai-key-later').click();

    await fillSource(page);
    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('ai-key-dialog')).toBeVisible();
    await expect(page.getByTestId('ai-key-required-notice')).toContainText('AI 분석을 시작하려면 먼저 Gemini API 키를 설정해 주세요');
    await page.getByTestId('ai-key-later').click();

    await expect(page.getByTestId('topic-input')).toHaveValue('강화 부근리 지석묘');
    await expect(page.getByTestId('source-textarea')).toHaveValue(NORMAL_SOURCE);
    await expect(page.getByTestId('result-canvas')).toHaveCount(0);
    expect(chatCalls).toBe(0);
  });

  test('키를 넣은 뒤 같은 자리에서 바로 분석을 이어 갈 수 있다', async ({ page }) => {
    await mockVerify(page);
    await page.route('**/api/chat', route => route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY }));
    await page.goto('/');
    await page.getByTestId('ai-key-later').click();
    await fillSource(page);
    await page.getByTestId('analyze-button').click();
    await page.getByTestId('ai-key-input').fill(TEST_KEY);
    await page.getByTestId('ai-key-verify').click();
    await expect(page.getByTestId('ai-key-status')).toHaveAttribute('data-status', 'success');
    await page.getByTestId('ai-key-later').click();
    await page.getByTestId('analyze-button').click();
    await expect(page.getByText('테스트 쉬운설명입니다.').first()).toBeVisible();
  });
});

test.describe('Gemini 키 — 쉬운한국어와 화면 크기', () => {
  test.use({ storageState: seenStorage() });

  test('쉬운한국어로 바꾸면 키 설정 창도 쉬운한국어로 보인다', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('ai-key-later').click();
    await page.locator('select').first().selectOption('ko-easy');
    await page.getByTestId('open-ai-key-settings-button').click();
    const dialog = page.getByTestId('ai-key-dialog');
    await expect(dialog).toContainText('Gemini 키 넣기');
    await expect(dialog).toContainText('키는 이 컴퓨터에만 저장해요.');
    await expect(page.getByTestId('ai-key-later')).toHaveText('나중에 하기');
  });

  test('1920×1080에서 창이 화면 안에 들어오고 본문 입력을 지우지 않는다', async ({ page }) => {
    await page.goto('/');
    const box = await page.getByTestId('ai-key-dialog').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1920);
    expect(box.y + box.height).toBeLessThanOrEqual(1080);
  });
});

test.describe('Gemini 키 — 모바일', () => {
  test.use({ viewport: { width: 390, height: 844 }, storageState: seenStorage() });

  test('모바일에서도 창과 버튼이 화면 밖으로 넘치지 않는다', async ({ page }) => {
    await page.goto('/');
    const dialog = page.getByTestId('ai-key-dialog');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    for (const id of ['ai-key-input', 'ai-key-reveal-toggle', 'ai-key-verify', 'ai-key-later']) {
      const el = await page.getByTestId(id).boundingBox();
      expect(el.x).toBeGreaterThanOrEqual(0);
      expect(el.x + el.width).toBeLessThanOrEqual(390);
    }
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);
  });
});
