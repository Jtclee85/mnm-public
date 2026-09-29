const { test, expect } = require('@playwright/test');

// Gemini 서버 계층 단위 검증. 전역 fetch를 가짜로 바꿔 실제 Gemini API를 절대 호출하지 않는다.
// 테스트용 키는 형식만 맞춘 가짜 값이다.

const {
  GEMINI_MODEL,
  generateStream,
  generateOnce,
  generateStructured,
  analyzeImage,
  validateCredential,
  classifyGeminiHttpError,
} = require('../lib/server/ai/gemini');
const { toGeminiContents, toGeminiSchema, GEMINI_OUTPUT_FORMAT_GUARD } = require('../lib/server/ai/messages');
const { aiErrorBody, logAiError, AiError } = require('../lib/server/ai/errors');
const { GEMINI_SAFETY_SETTINGS } = require('../lib/server/ai/safety');
const { AI_KEY_HEADER } = require('../lib/aiProviderConfig');
const { beginAiRequest, fingerprintAiRequest, resetAiRequestGuard } = require('../lib/aiRequestGuard');
const { parseSectionedResponse } = require('../lib/parseResponse');
const chatHandler = require('../pages/api/chat').default;
const chatOnceHandler = require('../pages/api/chat-once').default;
const relevanceHandler = require('../pages/api/relevance').default;
const signTextHandler = require('../pages/api/extract-sign-text').default;
const verifyKeyHandler = require('../pages/api/verify-ai-key').default;

const FAKE_KEY = 'unit-fake-gemini-key-not-real-1234';
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const realFetch = global.fetch;
let calls = [];

function jsonReply(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function textCandidate(text, extra = {}) {
  return { candidates: [{ content: { role: 'model', parts: [{ text }] }, ...extra }] };
}

function sseReply(events) {
  const body = events.map(e => `data: ${JSON.stringify(e)}\r\n\r\n`).join('');
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

// 가짜 Gemini 서버 — 요청을 기록하고 handler가 정한 응답을 돌려준다.
function mockGemini(handler) {
  global.fetch = async (url, init = {}) => {
    const call = {
      url: String(url),
      method: init.method || 'GET',
      headers: init.headers || {},
      body: init.body ? JSON.parse(init.body) : null,
    };
    calls.push(call);
    return handler(call);
  };
}

function appRequest(path, body, { key = FAKE_KEY, method = 'POST' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (key !== null) headers[AI_KEY_HEADER] = key;
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function collect(iterator) {
  const out = [];
  for await (const piece of iterator) out.push(piece);
  return out;
}

test.beforeEach(() => {
  calls = [];
  resetAiRequestGuard();
});

test.afterEach(() => {
  global.fetch = realFetch;
});

test.describe('Gemini 메시지 변환', () => {
  test('system은 systemInstruction으로, assistant는 model로 바꾸고 같은 역할은 합친다', () => {
    const request = toGeminiContents([
      { role: 'system', content: '시스템 규칙' },
      { role: 'assistant', content: '처음 안내 말풍선' },
      { role: 'user', content: '질문 1' },
      { role: 'user', content: '질문 1 보충' },
      { role: 'assistant', content: '' },
      { role: 'assistant', content: '답변 1' },
      { role: 'user', content: '질문 2' },
    ], { formatGuard: true });

    expect(request.systemInstruction.parts[0].text).toContain('시스템 규칙');
    expect(request.systemInstruction.parts[0].text).toContain(GEMINI_OUTPUT_FORMAT_GUARD);
    // 앞에 붙은 도우미 말풍선은 빠지고, user로 시작해 user로 끝난다.
    expect(request.contents.map(c => c.role)).toEqual(['user', 'model', 'user']);
    expect(request.contents[0].parts.map(p => p.text)).toEqual(['질문 1', '질문 1 보충']);
  });

  test('JSON Schema를 Gemini responseSchema 형식으로 바꾼다', () => {
    const schema = toGeminiSchema({
      type: 'object',
      additionalProperties: false,
      properties: { relevant: { type: 'boolean' }, warnings: { type: 'array', items: { type: 'string' } } },
      required: ['relevant', 'warnings'],
    });
    expect(schema).toEqual({
      type: 'OBJECT',
      properties: { relevant: { type: 'BOOLEAN' }, warnings: { type: 'ARRAY', items: { type: 'STRING' } } },
      propertyOrdering: ['relevant', 'warnings'],
      required: ['relevant', 'warnings'],
    });
  });
});

test.describe('Gemini 요청과 응답', () => {
  test('스트리밍: SSE 조각을 텍스트로 이어 주고 thinking 파트는 뺀다. 키는 헤더로만 보낸다', async () => {
    mockGemini(() => sseReply([
      { candidates: [{ content: { parts: [{ text: '생각 중', thought: true }] } }] },
      textCandidate('<easy>고인돌은'),
      textCandidate(' 무덤이에요.</easy>', { finishReason: 'STOP' }),
    ]));

    const pieces = await collect(generateStream({
      messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }],
      apiKey: FAKE_KEY,
    }));

    expect(pieces.join('')).toBe('<easy>고인돌은 무덤이에요.</easy>');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`);
    expect(calls[0].url).not.toContain(FAKE_KEY);
    expect(calls[0].headers['x-goog-api-key']).toBe(FAKE_KEY);
    expect(calls[0].body.safetySettings).toEqual(GEMINI_SAFETY_SETTINGS);
  });

  test('스트리밍 도중 안전 차단되면 받은 곳까지만 보내고 오류로 끊지 않는다', async () => {
    mockGemini(() => sseReply([
      textCandidate('앞부분 답변'),
      { candidates: [{ content: { parts: [] }, finishReason: 'SAFETY' }] },
    ]));
    const pieces = await collect(generateStream({ messages: [{ role: 'user', content: 'U' }], apiKey: FAKE_KEY }));
    expect(pieces).toEqual(['앞부분 답변']);
  });

  test('비스트리밍: 전체 텍스트를 돌려주고, 프롬프트 차단은 safety_blocked로 바꾼다', async () => {
    mockGemini(() => jsonReply(textCandidate('  완성된 답변  ')));
    await expect(generateOnce({ messages: [{ role: 'user', content: 'U' }], apiKey: FAKE_KEY })).resolves.toBe('완성된 답변');

    mockGemini(() => jsonReply({ promptFeedback: { blockReason: 'SAFETY' } }));
    await expect(generateOnce({ messages: [{ role: 'user', content: 'U' }], apiKey: FAKE_KEY }))
      .rejects.toMatchObject({ code: 'safety_blocked', status: 400 });
  });

  test('구조화 출력: responseSchema를 보내고, 코드 블록으로 감싼 JSON도 읽는다', async () => {
    mockGemini(() => jsonReply(textCandidate('```json\n{"relevant":true,"reason":"ok","redirect":""}\n```')));
    const parsed = await generateStructured({
      messages: [{ role: 'user', content: 'U' }],
      schema: { type: 'object', properties: { relevant: { type: 'boolean' } }, required: ['relevant'] },
      apiKey: FAKE_KEY,
    });
    expect(parsed).toEqual({ relevant: true, reason: 'ok', redirect: '' });
    expect(calls[0].body.generationConfig.responseMimeType).toBe('application/json');
    expect(calls[0].body.generationConfig.responseSchema.type).toBe('OBJECT');
  });

  test('구조화 출력이 JSON이 아니면 원문을 노출하지 않고 bad_response로 바꾼다', async () => {
    mockGemini(() => jsonReply(textCandidate('이건 JSON이 아니에요')));
    const error = await generateStructured({ messages: [{ role: 'user', content: 'U' }], schema: { type: 'object' }, apiKey: FAKE_KEY })
      .catch(e => e);
    expect(error).toBeInstanceOf(AiError);
    expect(error.code).toBe('bad_response');
    expect(JSON.stringify(aiErrorBody(error))).not.toContain('이건 JSON이 아니에요');
  });

  test('이미지 분석: data URL을 inlineData로 보낸다(jpg → image/jpeg)', async () => {
    mockGemini(() => jsonReply(textCandidate('{"text":"안내문","warnings":[]}')));
    const jpg = TINY_PNG.replace('image/png', 'image/jpg');
    const parsed = await analyzeImage({ image: jpg, prompt: 'P', systemPrompt: 'S', schema: { type: 'object' }, apiKey: FAKE_KEY });
    expect(parsed).toEqual({ text: '안내문', warnings: [] });
    const parts = calls[0].body.contents[0].parts;
    expect(parts[1].inlineData.mimeType).toBe('image/jpeg');
    expect(calls[0].body.systemInstruction.parts[0].text).toBe('S');
  });

  test('키 확인은 생성 요청이 아닌 모델 정보 조회(GET)로 한다', async () => {
    mockGemini(() => jsonReply({ name: `models/${GEMINI_MODEL}` }));
    await expect(validateCredential({ apiKey: FAKE_KEY })).resolves.toEqual({ ok: true, model: GEMINI_MODEL });
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}`);
  });
});

test.describe('Gemini 오류 분류', () => {
  test('잘못된 키·하루 할당량·분당 제한·서비스 장애를 구분한다', () => {
    expect(classifyGeminiHttpError(400, { error: { status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }).code).toBe('invalid_key');
    expect(classifyGeminiHttpError(403, { error: { status: 'PERMISSION_DENIED' } }).code).toBe('invalid_key');

    const daily = classifyGeminiHttpError(429, {
      error: { status: 'RESOURCE_EXHAUSTED', details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] },
    });
    expect(daily.code).toBe('quota_exceeded');
    expect(daily.status).toBe(429);

    const perMinute = classifyGeminiHttpError(429, {
      error: {
        status: 'RESOURCE_EXHAUSTED',
        details: [
          { violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] },
          { retryDelay: '17s' },
        ],
      },
    });
    expect(perMinute.code).toBe('rate_limited');
    expect(perMinute.retryAfterSeconds).toBe(17);

    expect(classifyGeminiHttpError(503, {}).code).toBe('unavailable');
    expect(classifyGeminiHttpError(400, { error: { status: 'INVALID_ARGUMENT' } }).code).toBe('invalid_request');
  });

  test('네트워크 오류는 network로 바꾼다', async () => {
    global.fetch = async () => { throw new TypeError('fetch failed'); };
    await expect(generateOnce({ messages: [{ role: 'user', content: 'U' }], apiKey: FAKE_KEY }))
      .rejects.toMatchObject({ code: 'network' });
  });

  test('형식이 맞지 않는 키는 Google로 보내지 않고 invalid_key로 거절한다', async () => {
    mockGemini(() => jsonReply({}));
    await expect(generateOnce({ messages: [{ role: 'user', content: 'U' }], apiKey: 'bad key\r\nX-Other: 1' }))
      .rejects.toMatchObject({ code: 'invalid_key' });
    expect(calls).toHaveLength(0);
  });

  test('운영 로그에는 분류 code만 남기고 원본 오류 내용은 출력하지 않는다', () => {
    const lines = [];
    const original = console.error;
    console.error = (...args) => lines.push(args.join(' '));
    try {
      logAiError('unit', new Error(`upstream said ${FAKE_KEY}`));
      logAiError('unit', new AiError('quota_exceeded'));
    } finally {
      console.error = original;
    }
    expect(lines.join('\n')).not.toContain(FAKE_KEY);
    expect(lines[1]).toContain('quota_exceeded 429');
  });
});

test.describe('API 라우트 계약 (Gemini 모드)', () => {
  const messages = [{ role: 'system', content: 'S' }, { role: 'user', content: '고인돌이 뭐야?' }];

  test('/api/chat: 기존 SSE 계약(data: JSON 문자열)을 유지한다', async () => {
    mockGemini(() => sseReply([textCandidate('<easy>첫 조각'), textCandidate(' 둘째 조각</easy>')]));
    const res = await chatHandler(appRequest('/api/chat', { messages }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    const body = await res.text();
    expect(body).toBe(`data: ${JSON.stringify('<easy>첫 조각')}\n\ndata: ${JSON.stringify(' 둘째 조각</easy>')}\n\n`);
  });

  test('/api/chat: 키가 없으면 Gemini를 부르지 않고 401 missing_key를 돌려준다', async () => {
    mockGemini(() => jsonReply({}));
    const res = await chatHandler(appRequest('/api/chat', { messages }, { key: null }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'missing_key' });
    expect(calls).toHaveLength(0);
  });

  test('/api/chat: 하루 무료 할당량 초과는 SSE를 열기 전에 429 quota_exceeded로 알린다', async () => {
    mockGemini(() => jsonReply({ error: { status: 'RESOURCE_EXHAUSTED', message: `quota for ${FAKE_KEY}`, details: [{ violations: [{ quotaId: 'PerDay' }] }] } }, 429));
    const res = await chatHandler(appRequest('/api/chat', { messages }));
    expect(res.status).toBe(429);
    const text = await res.text();
    expect(JSON.parse(text).code).toBe('quota_exceeded');
    // 원본 오류 메시지와 키는 응답에 없다.
    expect(text).not.toContain(FAKE_KEY);
    expect(text).not.toContain('RESOURCE_EXHAUSTED');
  });

  test('/api/chat: 입력이 너무 길면 Gemini를 부르지 않는다', async () => {
    mockGemini(() => jsonReply({}));
    const res = await chatHandler(appRequest('/api/chat', { messages: [{ role: 'user', content: 'x'.repeat(25001) }] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'input_too_long' });
    expect(calls).toHaveLength(0);
  });

  test('/api/chat-once: 기존 { content } 계약을 유지한다', async () => {
    mockGemini(() => jsonReply(textCandidate('비스트리밍 답변')));
    const res = await chatOnceHandler(appRequest('/api/chat-once', { messages }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ content: '비스트리밍 답변' });
    expect(calls[0].url).toContain(':generateContent');
  });

  test('/api/relevance: 주제 핵심어 직접 질문은 Gemini를 부르지 않고 허용한다', async () => {
    mockGemini(() => jsonReply({}));
    const res = await relevanceHandler(appRequest('/api/relevance', {
      topic: '강화 부근리 지석묘', sourceText: '지석묘 자료', userText: '지석묘는 왜 만들었어?',
    }));
    expect(await res.json()).toEqual({ relevant: true, reason: 'direct_topic_keyword', redirect: '' });
    expect(calls).toHaveLength(0);
  });

  test('/api/relevance: 구조화 응답을 기존 스키마로 돌려준다', async () => {
    mockGemini(() => jsonReply(textCandidate(JSON.stringify({ relevant: false, reason: 'off_topic', redirect: '조사 주제로 돌아가 볼까요?', extra: '숨김' }))));
    const res = await relevanceHandler(appRequest('/api/relevance', {
      topic: '강화 부근리 지석묘', sourceText: '지석묘 자료', userText: '아이돌 좋아해?',
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ relevant: false, reason: 'off_topic', redirect: '조사 주제로 돌아가 볼까요?' });
    expect(calls[0].body.generationConfig.responseSchema.required).toEqual(['relevant', 'reason', 'redirect']);
  });

  test('/api/relevance: JSON 파싱 실패는 내부 응답을 노출하지 않고 relevance_check_failed로 끝낸다', async () => {
    mockGemini(() => jsonReply(textCandidate('내부 응답 원문')));
    const res = await relevanceHandler(appRequest('/api/relevance', {
      topic: '강화 부근리 지석묘', sourceText: '지석묘 자료', userText: '오늘 뭐 먹지?',
    }));
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ relevant: false, reason: 'relevance_check_failed', redirect: '' });
    expect(text).not.toContain('내부 응답 원문');
  });

  test('/api/relevance: 키가 없으면 401 missing_key로 알린다', async () => {
    const res = await relevanceHandler(appRequest('/api/relevance', {
      topic: '강화 부근리 지석묘', sourceText: '지석묘 자료', userText: '오늘 뭐 먹지?',
    }, { key: null }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ relevant: false, code: 'missing_key' });
  });

  test('/api/extract-sign-text: 이미지 텍스트를 추출하고 형식·용량 제한을 유지한다', async () => {
    mockGemini(() => jsonReply(textCandidate(JSON.stringify({ text: '국보 제1호', warnings: [] }))));
    const ok = await signTextHandler(appRequest('/api/extract-sign-text', { image: TINY_PNG }));
    expect(await ok.json()).toEqual({ text: '국보 제1호', warnings: [] });

    const gif = await signTextHandler(appRequest('/api/extract-sign-text', { image: 'data:image/gif;base64,AAAA' }));
    expect(gif.status).toBe(400);

    const huge = await signTextHandler(appRequest('/api/extract-sign-text', { image: `data:image/png;base64,${'A'.repeat(11_000_001)}` }));
    expect(huge.status).toBe(400);
    expect(calls).toHaveLength(1);
  });

  test('/api/extract-sign-text: 429는 사용량 안내 code로 전달한다', async () => {
    mockGemini(() => jsonReply({ error: { status: 'RESOURCE_EXHAUSTED' } }, 429));
    const res = await signTextHandler(appRequest('/api/extract-sign-text', { image: TINY_PNG }));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ code: 'rate_limited' });
  });

  test('/api/verify-ai-key: 성공과 잘못된 키를 구분한다', async () => {
    mockGemini(() => jsonReply({ name: `models/${GEMINI_MODEL}` }));
    const ok = await verifyKeyHandler(appRequest('/api/verify-ai-key', undefined));
    expect(await ok.json()).toEqual({ ok: true, provider: 'gemini', model: GEMINI_MODEL });

    mockGemini(() => jsonReply({ error: { status: 'INVALID_ARGUMENT', message: 'API key not valid.' } }, 400));
    const bad = await verifyKeyHandler(appRequest('/api/verify-ai-key', undefined));
    expect(bad.status).toBe(401);
    const text = await bad.text();
    expect(JSON.parse(text).code).toBe('invalid_key');
    expect(text).not.toContain(FAKE_KEY);
  });
});

test.describe('응답 파서 호환성', () => {
  test('Gemini가 지시를 어기고 코드 블록으로 감싸도 기존 파서가 태그를 읽는다', () => {
    const fenced = '```xml\n<understanding_sentence>고인돌은 무덤이다.</understanding_sentence>\n<easy>고인돌은 옛날 무덤이에요.</easy>\n```';
    const parsed = parseSectionedResponse(fenced);
    expect(parsed.understandingSentence).toBe('고인돌은 무덤이다.');
    expect(parsed.easy).toContain('고인돌은 옛날 무덤이에요.');
  });
});

test.describe('중복 요청 방지', () => {
  test('진행 중이거나 방금 성공한 같은 요청은 막고, 실패한 요청은 바로 다시 보낼 수 있다', () => {
    const fp = fingerprintAiRequest([{ role: 'user', content: '같은 요청' }]);
    const release = beginAiRequest(fp);
    expect(release).toBeTruthy();
    expect(beginAiRequest(fp)).toBeNull();

    release({ succeeded: true });
    expect(beginAiRequest(fp)).toBeNull();
    const retry = beginAiRequest(fp, { allowRepeat: true });
    expect(retry).toBeTruthy();
    retry({ succeeded: false });

    const other = fingerprintAiRequest([{ role: 'user', content: '다른 요청' }]);
    const failed = beginAiRequest(other);
    failed({ succeeded: false });
    expect(beginAiRequest(other)).toBeTruthy();
  });

  test('성공 후 3초가 지나면 같은 요청을 다시 보낼 수 있다', () => {
    const fp = fingerprintAiRequest('시간 지난 요청');
    beginAiRequest(fp)({ succeeded: true });
    expect(beginAiRequest(fp, { now: Date.now() + 3100 })).toBeTruthy();
  });
});
