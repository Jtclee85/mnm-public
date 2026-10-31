const { test, expect } = require('@playwright/test');

// 교사 키 등록 → 학급 코드 → 학생 AI 사용 흐름 검증.
// 외부 서비스는 테스트 전용 가짜 서버(tests/support/mock-upstash-server.js)가 대신한다.
// 실제 Gemini·Upstash는 호출하지 않는다. 키는 형식만 맞춘 가짜 값이다.

const BASE = 'http://localhost:3000';
const MOCK = 'http://127.0.0.1:3998';
const CLASS_HEADER = 'x-mnm-class';
const RESEARCH_TUTORIAL_SEEN_KEY = 'mnmHistoryResearchTutorialSeen';
const APP_TUTORIAL_SEEN_KEY = 'mnmAppUsageTutorialSeen';
const CLASS_SESSION_KEY = 'mnmClassSession';
const DEFAULT_CLASS = { code: '테스트초-0000', school: '테스트초', expiresAt: 4102444800000 };
const TEACHER_KEY = 'e2e-valid-teacher-key-not-real-0001';
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
    origin: BASE,
    localStorage: [
      { name: RESEARCH_TUTORIAL_SEEN_KEY, value: 'true' },
      { name: APP_TUTORIAL_SEEN_KEY, value: 'true' },
      ...extra,
    ],
  }],
});
const joinedStorage = seenStorage([{ name: CLASS_SESSION_KEY, value: JSON.stringify(DEFAULT_CLASS) }]);

// 병렬 테스트가 같은 가짜 저장소를 쓰므로 학교 이름을 테스트마다 다르게 만든다.
const uniqueSchool = () => `E2E${Math.random().toString(36).slice(2, 8)}초`;

async function fillSource(page) {
  await page.getByTestId('topic-input').fill('강화 부근리 지석묘');
  await page.getByTestId('source-textarea').fill(NORMAL_SOURCE);
}

// 교사 화면에서 키를 등록하고 학급 코드를 만든다. 만든 코드를 돌려준다.
async function teacherCreatesClass(page, { key = TEACHER_KEY, school = uniqueSchool(), provider = 'gemini' } = {}) {
  await page.goto(`${BASE}/teacher`);
  await page.getByTestId('teacher-provider').selectOption(provider);
  await page.getByTestId('teacher-open-key-dialog').click();
  await page.getByTestId('ai-key-input').fill(key);
  await page.getByTestId('ai-key-verify').click();
  await expect(page.getByTestId('ai-key-status')).toHaveAttribute('data-status', 'success');
  await page.getByTestId('ai-key-later').click();
  await page.getByTestId('teacher-school-input').fill(school);
  await page.getByTestId('teacher-create-class').click();
  await expect(page.getByTestId('teacher-notice')).toHaveAttribute('data-tone', 'ok');
  const code = (await page.getByTestId('teacher-class-code').first().textContent()).trim();
  expect(code).toMatch(new RegExp(`^${school}-\\d{4}$`));
  return code;
}

// 개발 서버는 페이지·라우트를 처음 요청받을 때 컴파일한다. 여러 테스트가 동시에 처음 접속하면
// 30초를 넘길 수 있어, 이 파일의 테스트 전에 교사 화면과 학급 API를 한 번씩 미리 부른다.
test.beforeAll(async ({ request }) => {
  test.setTimeout(180 * 1000);
  await request.get(`${BASE}/teacher`, { timeout: 170 * 1000 });
  for (const route of ['create', 'join', 'update', 'delete']) {
    await request.post(`${BASE}/api/class/${route}`, { data: {}, timeout: 170 * 1000 });
  }
  await request.post(`${BASE}/api/verify-ai-key`, { timeout: 170 * 1000 });
});

async function newStudentPage(browser, storageState = seenStorage()) {
  const context = await browser.newContext({ storageState, viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  return { context, page };
}

test.describe('교사용 설정', () => {
  test.use({ storageState: EMPTY_STORAGE });

  test('키 없이 학급 코드를 만들려 하면 키 설정부터 안내한다', async ({ page }) => {
    await page.goto(`${BASE}/teacher`);
    await expect(page.getByTestId('teacher-key-status')).toContainText('아직 이 기기에 키가 없어요');
    await page.getByTestId('teacher-school-input').fill('해원초');
    await page.getByTestId('teacher-create-class').click();
    await expect(page.getByTestId('teacher-notice')).toContainText('먼저 ① 선택한 AI의 API 키를 설정해 주세요');
    await expect(page.getByTestId('ai-key-dialog')).toBeVisible();
    // 교사 화면의 키 설정 창은 학급 코드 보관 방식을 안내한다.
    await expect(page.getByTestId('ai-key-dialog')).toContainText('오늘 밤 12시까지 보관');
    const link = page.getByTestId('ai-key-issue-link');
    await expect(link).toHaveAttribute('href', 'https://aistudio.google.com/apikey');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('잘못된 키는 연결 확인에서 거절하고 저장하지 않는다', async ({ page }) => {
    await page.goto(`${BASE}/teacher`);
    await page.getByTestId('teacher-open-key-dialog').click();
    await page.getByTestId('ai-key-input').fill('e2e-wrong-key-not-real-000000');
    await page.getByTestId('ai-key-verify').click();
    await expect(page.getByTestId('ai-key-status')).toHaveAttribute('data-status', 'error');
    await expect(page.getByTestId('ai-key-status')).toContainText('선택한 AI의 API 키를 확인할 수 없어요');
    const stored = await page.evaluate(() => ({ l: localStorage.getItem('mnmGeminiApiKey'), s: sessionStorage.getItem('mnmGeminiApiKey') }));
    expect(stored).toEqual({ l: null, s: null });
  });

  test('키를 등록하면 학급 코드를 만들고, 관리 토큰은 이 기기에만 저장한다', async ({ page }) => {
    const school = uniqueSchool();
    const code = await teacherCreatesClass(page, { school });

    await expect(page.getByTestId('teacher-key-status')).toContainText('••••••••0001');
    await expect(page.getByTestId('teacher-class-item')).toHaveCount(1);
    await expect(page.getByTestId('teacher-class-item')).toContainText('오늘 밤 12시(한국 시간)에 만료');

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mnmTeacherClasses')));
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ code, school });
    expect(saved[0].manageToken.length).toBeGreaterThanOrEqual(40);
    // 교사 키는 기본으로 이 탭(sessionStorage)에만 저장된다.
    expect(await page.evaluate(() => sessionStorage.getItem('mnmGeminiApiKey'))).toBe(TEACHER_KEY);
    expect(await page.evaluate(() => localStorage.getItem('mnmGeminiApiKey'))).toBeNull();
    expect(await page.content()).not.toContain(TEACHER_KEY);
  });

  test('코드 재발급은 새 코드를 만들고 이전 코드를 지우며, 삭제하면 학생이 더 이상 들어올 수 없다', async ({ page, request }) => {
    const oldCode = await teacherCreatesClass(page);

    await page.getByTestId('teacher-reissue-code').click();
    await expect(page.getByTestId('teacher-notice')).toContainText('새 코드를 만들고 이전 코드는 지웠어요');
    await expect(page.getByTestId('teacher-class-item')).toHaveCount(1);
    const newCode = (await page.getByTestId('teacher-class-code').textContent()).trim();
    expect(newCode).not.toBe(oldCode);

    const oldJoin = await request.post(`${BASE}/api/class/join`, { data: { code: oldCode } });
    expect(oldJoin.status()).toBe(401);
    const newJoin = await request.post(`${BASE}/api/class/join`, { data: { code: newCode } });
    expect(newJoin.status()).toBe(200);

    page.once('dialog', dialog => dialog.accept());
    await page.getByTestId('teacher-remove-class').click();
    await expect(page.getByTestId('teacher-notice')).toContainText('학급을 삭제했어요');
    await expect(page.getByTestId('teacher-class-empty')).toBeVisible();
    const afterDelete = await request.post(`${BASE}/api/class/join`, { data: { code: newCode } });
    expect(afterDelete.status()).toBe(401);
  });

  test('다른 기기(관리 토큰 없음)에서는 학급을 지울 수 없다', async ({ page, request }) => {
    const code = await teacherCreatesClass(page);
    const res = await request.post(`${BASE}/api/class/delete`, { data: { code } });
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe('forbidden');
  });
});

test.describe('학생 — 학급 코드로 AI 사용', () => {
  test.use({ storageState: EMPTY_STORAGE });

  test('교사가 만든 코드로 들어와 AI 분석을 쓰고, 학생 쪽에는 키가 전혀 전달되지 않는다', async ({ page: teacherPage, browser, request }) => {
    const code = await teacherCreatesClass(teacherPage);

    const { context, page } = await newStudentPage(browser);
    const traffic = [];
    page.on('request', req => traffic.push({ url: req.url(), headers: req.headers(), body: req.postData() || '' }));
    const responses = [];
    page.on('response', async res => {
      if (res.url().includes('/api/')) responses.push(await res.text().catch(() => ''));
    });
    const consoleLines = [];
    page.on('console', msg => consoleLines.push(msg.text()));

    await page.goto(BASE);
    await expect(page.getByTestId('class-code-dialog')).toBeVisible();
    await page.getByTestId('class-code-input').fill(` ${code} `);
    await page.getByTestId('class-code-join').click();
    await expect(page.getByTestId('class-code-status')).toHaveAttribute('data-status', 'success');
    await expect(page.getByTestId('class-code-current')).toContainText(code);
    await page.getByTestId('class-code-later').click();

    await fillSource(page);
    await page.getByTestId('analyze-button').click();
    // 가짜 Gemini가 만든 결과가 서버를 거쳐 화면에 나온다.
    await expect(page.getByText('가짜 Gemini 쉬운설명입니다.').first()).toBeVisible();

    // 학생의 AI 요청에는 학급 코드만 실린다.
    const chatRequest = traffic.find(t => t.url.endsWith('/api/chat'));
    expect(decodeURIComponent(chatRequest.headers[CLASS_HEADER])).toBe(code);
    // 서버는 교사 키로 Gemini를 불렀다.
    const log = await (await request.get(`${MOCK}/__gemini-log`)).json();
    expect(log.some(entry => entry.url.includes(':streamGenerateContent') && entry.key === TEACHER_KEY)).toBe(true);

    // 키는 학생 브라우저의 요청·응답·저장소·화면·콘솔 어디에도 없다.
    expect(traffic.some(t => t.url.includes(TEACHER_KEY) || t.body.includes(TEACHER_KEY) || JSON.stringify(t.headers).includes(TEACHER_KEY))).toBe(false);
    expect(responses.some(text => text.includes(TEACHER_KEY))).toBe(false);
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(storage).not.toContain(TEACHER_KEY);
    expect(await page.content()).not.toContain(TEACHER_KEY);
    expect(consoleLines.some(line => line.includes(TEACHER_KEY))).toBe(false);
    await context.close();
  });

  test('틀린 코드는 이유를 알려 주고 저장하지 않는다', async ({ page }) => {
    await page.addInitScript(([a, b]) => { localStorage.setItem(a, 'true'); localStorage.setItem(b, 'true'); }, [RESEARCH_TUTORIAL_SEEN_KEY, APP_TUTORIAL_SEEN_KEY]);
    await page.goto(BASE);
    await page.getByTestId('class-code-input').fill('없는학교-1234');
    await page.getByTestId('class-code-join').click();
    await expect(page.getByTestId('class-code-status')).toHaveAttribute('data-status', 'error');
    await expect(page.getByTestId('class-code-status')).toContainText('학급 코드를 찾을 수 없어요');
    expect(await page.evaluate((k) => localStorage.getItem(k), CLASS_SESSION_KEY)).toBeNull();
  });

  test('교사 키의 하루 무료 사용량이 끝나면 학생에게 선생님께 알리라고 안내한다', async ({ page: teacherPage, browser }) => {
    const code = await teacherCreatesClass(teacherPage, { key: 'e2e-valid-quota-key-not-real-0002' });
    const { context, page } = await newStudentPage(browser, seenStorage([
      { name: CLASS_SESSION_KEY, value: JSON.stringify({ code, school: code.split('-')[0], expiresAt: 4102444800000 }) },
    ]));
    await page.goto(BASE);
    await fillSource(page);
    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('analysis-error')).toContainText('오늘 쓸 수 있는 무료 사용량을 모두 썼어요. 선생님께 알려 주세요.');
    await context.close();
  });
});

test.describe('학생 — 첫 방문과 학급 코드 창', () => {
  test.use({ storageState: EMPTY_STORAGE });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, 'true'), RESEARCH_TUTORIAL_SEEN_KEY);
    await page.route('**/api/chat', route => route.abort());
    await page.route('**/api/chat-once', route => route.abort());
    await page.route('**/api/recommended-videos**', route => route.abort());
  });

  test('사용법 6과정을 마치면 학급 코드 창으로 이어진다', async ({ page }) => {
    await page.goto(BASE);
    const tutorial = page.getByTestId('app-usage-tutorial');
    await expect(page.getByText('과정 1 / 6')).toBeVisible();
    await expect(page.getByTestId('class-code-dialog')).toHaveCount(0);
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
    await page.getByTestId('app-tutorial-explore-results').click();

    const dialog = page.getByTestId('class-code-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toContainText('선생님께 받은 학급 코드를 넣으면 AI 기능을 쓸 수 있어요');
    await expect(page.getByLabel('학급 코드', { exact: true })).toBeVisible();
    // 학생 창에는 API 키 입력칸이 없다.
    await expect(page.getByTestId('ai-key-input')).toHaveCount(0);
    await expect(page.getByTestId('class-code-teacher-link')).toHaveAttribute('href', '/teacher');
  });

  test('나중에 보기와 다시 보지 않기로 닫아도 학급 코드 창으로 이어지고, 두 기록은 따로 관리된다', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: '다시 보지 않기' }).click();
    await expect(page.getByTestId('class-code-dialog')).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), APP_TUTORIAL_SEEN_KEY)).toBe('true');
    expect(await page.evaluate((k) => localStorage.getItem(k), CLASS_SESSION_KEY)).toBeNull();

    await page.getByTestId('class-code-later').click();
    await page.reload();
    await expect(page.getByTestId('app-usage-tutorial')).toHaveCount(0);
    await expect(page.getByTestId('class-code-dialog')).toBeVisible();
  });
});

test.describe('학생 — 학급 없이 AI 기능을 누를 때', () => {
  test.use({ storageState: seenStorage() });

  test('분석 시작을 누르면 요청 없이 학급 코드 창을 열고, 조사 주제와 자료는 그대로 둔다', async ({ page }) => {
    let chatCalls = 0;
    await page.route('**/api/chat**', route => { chatCalls += 1; return route.abort(); });
    await page.goto(BASE);
    await page.getByTestId('class-code-later').click();
    await fillSource(page);
    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('class-code-dialog')).toBeVisible();
    await expect(page.getByTestId('class-code-required-notice')).toContainText('AI 기능을 쓰려면 먼저 선생님께 받은 학급 코드를 넣어 주세요');
    await page.getByTestId('class-code-later').click();
    await expect(page.getByTestId('topic-input')).toHaveValue('강화 부근리 지석묘');
    await expect(page.getByTestId('source-textarea')).toHaveValue(NORMAL_SOURCE);
    expect(chatCalls).toBe(0);
  });
});

test.describe('학생 — 학급에 들어온 상태', () => {
  test.use({ storageState: joinedStorage });

  test('같은 날 다시 오면 학급 코드 창을 건너뛰고, 머리글에서 확인하거나 나갈 수 있다', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByTestId('topic-input')).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.getByTestId('class-code-dialog')).toHaveCount(0);

    await page.getByTestId('open-class-code-button').click();
    await expect(page.getByTestId('class-code-current')).toContainText(DEFAULT_CLASS.code);
    await expect(page.getByTestId('class-code-later')).toHaveText('닫기');
    await page.getByTestId('class-code-leave').click();
    await expect(page.getByTestId('class-code-status')).toContainText('학급에서 나왔어요');
    expect(await page.evaluate((k) => localStorage.getItem(k), CLASS_SESSION_KEY)).toBeNull();
  });

  test('학급에서 나간 뒤 챗봇 질문을 보내면 요청 없이 학급 코드 창을 열고 질문을 남긴다', async ({ page }) => {
    let chatCalls = 0;
    await page.route('**/api/chat', route => {
      chatCalls += 1;
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY });
    });
    await page.goto(BASE);
    await fillSource(page);
    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('result-canvas')).toBeVisible();
    expect(chatCalls).toBe(1);

    await page.getByTestId('open-class-code-button').click();
    await page.getByTestId('class-code-leave').click();
    await page.getByTestId('class-code-later').click();

    await page.getByTestId('chatbot-toggle-button').click();
    await page.getByTestId('chatbot-input').fill('청동기 시대 사람들은 어떻게 살았나요?');
    await page.getByTestId('chatbot-send-button').click();
    await expect(page.getByTestId('class-code-dialog')).toBeVisible();
    await page.getByTestId('class-code-later').click();
    await expect(page.getByTestId('chatbot-input')).toHaveValue('청동기 시대 사람들은 어떻게 살았나요?');
    expect(chatCalls).toBe(1);
  });

  test('만료 시각이 지난 학급 기록은 버리고 다시 코드를 받는다', async ({ page }) => {
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [CLASS_SESSION_KEY, JSON.stringify({ ...DEFAULT_CLASS, expiresAt: Date.now() - 1000 })]);
    await page.goto(BASE);
    await expect(page.getByTestId('class-code-dialog')).toBeVisible();
  });

  test('분석 중 학급 코드가 만료되면 입력을 유지한 채 학급 코드 창으로 안내하고 fallback하지 않는다', async ({ page }) => {
    let onceCalls = 0;
    await page.route('**/api/chat', route => route.fulfill({
      status: 401, contentType: 'application/json',
      body: JSON.stringify({ error: 'x', code: 'class_code_invalid' }),
    }));
    await page.route('**/api/chat-once', route => { onceCalls += 1; return route.abort(); });

    await page.goto(BASE);
    await fillSource(page);
    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('class-code-dialog')).toBeVisible();
    await expect(page.getByTestId('class-code-required-notice')).toContainText('학급 코드를 찾을 수 없어요');
    await page.getByTestId('class-code-later').click();
    await expect(page.getByTestId('analysis-error')).toContainText('학급 코드를 찾을 수 없어요');
    await page.getByTestId('analysis-error-open-class-code').click();
    await expect(page.getByTestId('class-code-dialog')).toBeVisible();
    await expect(page.getByTestId('topic-input')).toHaveValue('강화 부근리 지석묘');
    await expect(page.getByTestId('source-textarea')).toHaveValue(NORMAL_SOURCE);
    expect(onceCalls).toBe(0);
  });

  test('선생님 키 문제는 학급 코드 창을 열지 않고 선생님께 알리라고 안내한다', async ({ page }) => {
    await page.route('**/api/chat', route => route.fulfill({
      status: 401, contentType: 'application/json',
      body: JSON.stringify({ error: 'x', code: 'invalid_key' }),
    }));
    await page.goto(BASE);
    await fillSource(page);
    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('analysis-error')).toContainText('선생님의 AI 키를 확인할 수 없어요. 선생님께 알려 주세요.');
    await expect(page.getByTestId('class-code-dialog')).toHaveCount(0);
  });

  test('AI 요청마다 학급 코드 헤더를 보내고, 스트리밍이 막히면 비스트리밍으로 한 번만 다시 받는다', async ({ page }) => {
    let streamCalls = 0;
    const onceHeaders = [];
    await page.route('**/api/chat', async (route) => {
      streamCalls += 1;
      expect(decodeURIComponent(route.request().headers()[CLASS_HEADER])).toBe(DEFAULT_CLASS.code);
      await route.fulfill({ status: 502, contentType: 'text/html', body: '<html>blocked</html>' });
    });
    await page.route('**/api/chat-once', async (route) => {
      onceHeaders.push(decodeURIComponent(route.request().headers()[CLASS_HEADER]));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: FAKE_ANALYSIS_TEXT }) });
    });
    await page.goto(BASE);
    await fillSource(page);
    await page.getByTestId('analyze-button').click();
    await expect(page.getByText('테스트 쉬운설명입니다.').first()).toBeVisible();
    expect(streamCalls).toBe(1);
    expect(onceHeaders).toEqual([DEFAULT_CLASS.code]);
  });

  test('요청 빈도 제한(429)은 잠시 후 다시 시도하라고 안내한다', async ({ page }) => {
    await page.route('**/api/chat', route => route.fulfill({
      status: 429, contentType: 'application/json',
      body: JSON.stringify({ error: 'x', code: 'rate_limited' }),
    }));
    await page.goto(BASE);
    await fillSource(page);
    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('analysis-error')).toContainText('잠시 후 다시 시도해 주세요');
  });

  test('분석 버튼을 같은 순간에 여러 번 눌러도 요청은 한 번만 나간다', async ({ page }) => {
    let chatCalls = 0;
    let release;
    await page.route('**/api/chat', async (route) => {
      chatCalls += 1;
      await new Promise(resolve => { release = resolve; });
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY });
    });
    await page.goto(BASE);
    await fillSource(page);
    await page.getByTestId('analyze-button').evaluate((button) => {
      button.click();
      button.click();
      button.click();
    });
    await expect.poll(() => typeof release).toBe('function');
    await page.waitForTimeout(300);
    expect(chatCalls).toBe(1);
    await expect(page.getByTestId('analysis-error')).toHaveCount(0);
    release();
    await expect(page.getByText('테스트 쉬운설명입니다.').first()).toBeVisible();
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
    await page.goto(BASE);
    await fillSource(page);
    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('result-canvas')).toBeVisible();
    await page.getByTestId('chatbot-toggle-button').click();
    await page.getByTestId('chatbot-input').fill('지석묘는 왜 만들었어요?');
    await page.getByTestId('chatbot-send-button').click();
    await expect.poll(() => chatCalls).toBe(2);
    expect(relevanceCalls).toBe(0);
  });

  test('사진 글자 읽기도 학급 코드 헤더를 보내고, 할당량 초과 안내를 보여 준다', async ({ page }) => {
    const headers = [];
    await page.route('**/api/extract-sign-text', async (route) => {
      headers.push(decodeURIComponent(route.request().headers()[CLASS_HEADER]));
      await route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'x', code: 'quota_exceeded' }) });
    });
    await page.goto(BASE);
    await page.getByTestId('sign-reader-button').click();
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByTestId('sign-reader-permission-agree').click();
    const chooser = await chooserPromise;
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await chooser.setFiles({ name: 'sign.png', mimeType: 'image/png', buffer: png });
    await page.getByTestId('sign-reader-extract-button').click();
    await expect(page.getByTestId('sign-reader-modal')).toContainText('오늘 쓸 수 있는 무료 사용량을 모두 썼어요');
    expect(headers).toEqual([DEFAULT_CLASS.code]);
  });

  test('익명 산출물 전송에는 학급 코드 헤더가 섞이지 않는다', async ({ page }) => {
    await page.addInitScript(() => { window.open = () => ({ opener: null }); });
    await page.route('**/api/chat', route => route.fulfill({ status: 200, contentType: 'text/event-stream', body: FAKE_SSE_BODY }));
    const collected = [];
    await page.route('**/__artifact-test-collector', async (route) => {
      collected.push({ body: route.request().postData() || '', headers: route.request().headers() });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, duplicate: false }) });
    });
    await page.goto(BASE);
    await fillSource(page);
    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('result-canvas')).toBeVisible();
    await page.locator('#u_check1').fill('고인돌은 무덤이라는 것을 알았어요.');
    await page.getByTestId('share-artifact-button').click();
    await expect.poll(() => collected.length).toBe(1);
    expect(collected[0].headers[CLASS_HEADER]).toBeUndefined();
    expect(collected[0].body).not.toContain(DEFAULT_CLASS.code);
  });
});

test.describe('학생 — 쉬운한국어와 화면 크기', () => {
  test.use({ storageState: seenStorage() });

  test('쉬운한국어로 바꾸면 학급 코드 창도 쉬운한국어로 보인다', async ({ page }) => {
    await page.goto(BASE);
    await page.getByTestId('class-code-later').click();
    await page.locator('select').first().selectOption('ko-easy');
    await page.getByTestId('open-class-code-button').click();
    const dialog = page.getByTestId('class-code-dialog');
    await expect(dialog).toContainText('학급 코드 넣기');
    await expect(dialog).toContainText('선생님이 준 학급 코드를 넣어요.');
    await expect(page.getByTestId('class-code-later')).toHaveText('나중에 넣기');
  });

  test('1920×1080에서 창이 화면 안에 들어온다', async ({ page }) => {
    await page.goto(BASE);
    const box = await page.getByTestId('class-code-dialog').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1920);
    expect(box.y + box.height).toBeLessThanOrEqual(1080);
  });
});

test.describe('모바일', () => {
  test.use({ viewport: { width: 390, height: 844 }, storageState: seenStorage() });

  test('학생 학급 코드 창과 교사 화면이 화면 밖으로 넘치지 않는다', async ({ page }) => {
    await page.goto(BASE);
    const dialog = page.getByTestId('class-code-dialog');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    for (const id of ['class-code-input', 'class-code-join', 'class-code-later']) {
      const el = await page.getByTestId(id).boundingBox();
      expect(el.x + el.width).toBeLessThanOrEqual(390);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await page.goto(`${BASE}/teacher`);
    await expect(page.getByTestId('teacher-page')).toBeVisible();
    for (const id of ['teacher-school-input', 'teacher-create-class', 'teacher-open-key-dialog']) {
      const el = await page.getByTestId(id).boundingBox();
      expect(el.x).toBeGreaterThanOrEqual(0);
      expect(el.x + el.width).toBeLessThanOrEqual(390);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

test.describe('교사 AI 공급자 선택', () => {
  test.use({ storageState: EMPTY_STORAGE });
  test('공급자를 바꾸면 저장된 키가 섞이지 않고 공급자별로 삭제한다', async ({ page }) => {
    await teacherCreatesClass(page);
    await page.getByTestId('teacher-provider').selectOption('openai');
    await expect(page.getByTestId('teacher-key-status')).toContainText('아직');
    await page.getByTestId('teacher-open-key-dialog').click();
    await expect(page.getByTestId('ai-key-issue-link')).toHaveAttribute('href', 'https://platform.openai.com/api-keys');
    await page.getByTestId('ai-key-input').fill('e2e-valid-openai-not-real-2222');
    await page.getByTestId('ai-key-verify').click();
    await expect(page.getByTestId('ai-key-status')).toHaveAttribute('data-status', 'success');
    await page.getByTestId('ai-key-later').click();
    await page.getByTestId('teacher-provider').selectOption('gemini');
    await expect(page.getByTestId('teacher-key-status')).toContainText('0001');
    await page.getByTestId('teacher-provider').selectOption('openai');
    await page.getByTestId('teacher-open-key-dialog').click();
    await page.getByTestId('ai-key-delete').click();
    expect(await page.evaluate(() => ({ gemini: !!sessionStorage.getItem('mnmGeminiApiKey'), openai: sessionStorage.getItem('mnmOpenAiApiKey') }))).toEqual({ gemini: true, openai: null });
  });

  test('OpenAI 학급 코드로 학생이 네 AI 경로를 쓰고 키는 받지 않는다', async ({ page, browser }) => {
    const code = await teacherCreatesClass(page, { provider: 'openai' });
    await expect(page.getByTestId('teacher-class-item').first()).toContainText('OpenAI');
    const { context, page: student } = await newStudentPage(browser);
    try {
      await student.goto(BASE);
      await student.getByTestId('class-code-input').fill(code);
      await student.getByTestId('class-code-join').click();
      await expect(student.getByTestId('class-code-status')).toHaveAttribute('data-status', 'success');
      await student.getByTestId('class-code-later').click();
      await fillSource(student);
      await student.getByTestId('analyze-button').click();
      await expect(student.getByText('가짜 OpenAI 쉬운설명입니다.').first()).toBeVisible();
      const results = await student.evaluate(async (classCode) => {
        const headers = { 'Content-Type': 'application/json', 'x-mnm-class': encodeURIComponent(classCode) };
        const bodies = {
          'chat-once': { messages: [{ role: 'user', content: '고인돌 설명' }] },
          relevance: { topic: '고인돌', sourceText: '청동기 시대 무덤', userText: '오늘 뭐 먹지?' },
          'extract-sign-text': { image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' },
        };
        return Promise.all(Object.entries(bodies).map(async ([path, body]) => {
          const response = await fetch('/api/' + path, { method: 'POST', headers, body: JSON.stringify(body) });
          return { status: response.status, data: await response.json() };
        }));
      }, code);
      expect(results.map(r => r.status)).toEqual([200, 200, 200]);
      expect(results[0].data.content).toContain('OpenAI');
      expect(results[1].data.relevant).toBe(true);
      expect(results[2].data.text).toContain('OpenAI');
      expect(JSON.stringify(results)).not.toContain(TEACHER_KEY);
      expect(await student.evaluate(() => localStorage.getItem('mnmOpenAiApiKey'))).toBeNull();
    } finally { await context.close(); }
  });
});
