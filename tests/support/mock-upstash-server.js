// 테스트 전용 가짜 외부 서비스 서버. 실제 Upstash·Gemini를 쓰지 않고 E2E와 로컬 개발에서
// 교사 키 등록 → 학급 코드 → 학생 AI 사용 흐름을 서버까지 거쳐 확인하기 위해 쓴다.
//
// - Upstash REST 흉내: POST / , POST /pipeline (Bearer 토큰 필요). 명령 처리는 mockUpstashStore.js
// - Gemini REST 흉내: /gemini/v1beta/models/... (GEMINI_API_BASE_URL로 연결)
//     키가 'e2e-valid'로 시작하면 정상, 'e2e-valid-quota'로 시작하면 하루 할당량 초과(429)
// - 테스트 편의: POST /__reset(전체 삭제), GET /__gemini-log(가짜 Gemini가 받은 요청 기록)
//
// 실행: node tests/support/mock-upstash-server.js [port]   (기본 3998, 토큰 mock-upstash-token)
const http = require('http');
const { createMockUpstashStore } = require('./mockUpstashStore');

const PORT = Number(process.argv[2] || process.env.MOCK_UPSTASH_PORT || 3998);
const TOKEN = process.env.MOCK_UPSTASH_TOKEN || 'mock-upstash-token';
const store = createMockUpstashStore();
const geminiLog = [];

const FAKE_GEMINI_TEXT =
  '<understanding_sentence>가짜 Gemini 이해 문장입니다.</understanding_sentence>\n<easy>가짜 Gemini 쉬운설명입니다.</easy>';

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

function handleGemini(req, res, raw) {
  const key = req.headers['x-goog-api-key'] || '';
  const url = req.url.replace(/^\/gemini/, '');
  geminiLog.push({ method: req.method, url, key });

  if (!String(key).startsWith('e2e-valid')) {
    return send(res, 400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid.', details: [{ reason: 'API_KEY_INVALID' }] } });
  }
  if (String(key).startsWith('e2e-valid-quota') && req.method === 'POST') {
    return send(res, 429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED', details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } });
  }
  if (req.method === 'GET') return send(res, 200, { name: url.replace(/^\/v1beta\//, '') });

  const candidate = (text) => ({ candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }] });
  if (url.includes(':streamGenerateContent')) {
    const half = Math.floor(FAKE_GEMINI_TEXT.length / 2);
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(`data: ${JSON.stringify(candidate(FAKE_GEMINI_TEXT.slice(0, half)))}\r\n\r\n`);
    res.end(`data: ${JSON.stringify(candidate(FAKE_GEMINI_TEXT.slice(half)))}\r\n\r\n`);
    return undefined;
  }
  let body = {};
  try { body = JSON.parse(raw || '{}'); } catch {}
  if (body.generationConfig?.responseMimeType === 'application/json') {
    return send(res, 200, candidate(JSON.stringify({ relevant: true, reason: 'mock', redirect: '' })));
  }
  return send(res, 200, candidate(FAKE_GEMINI_TEXT));
}

const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    if (req.method === 'GET' && req.url === '/') return send(res, 200, { ok: true });
    if (req.url.startsWith('/gemini/')) return handleGemini(req, res, raw);
    if (req.method === 'GET' && req.url === '/__gemini-log') return send(res, 200, geminiLog);
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(res, 401, { error: 'WRONGPASS invalid password' });
    if (req.url === '/__reset') {
      store.clear();
      geminiLog.length = 0;
      return send(res, 200, { result: 'OK' });
    }
    let body;
    try {
      body = JSON.parse(raw || 'null');
    } catch {
      return send(res, 400, { error: 'ERR invalid json' });
    }
    const result = store.handle(req.url === '/pipeline' ? '/pipeline' : '', body);
    return send(res, result.status, result.body);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock services listening on http://127.0.0.1:${PORT}`);
});
