import { AI_ERROR_CODES } from '../../aiProviderConfig';
import { AiError } from './errors';
import { toGeminiContents, toGeminiSchema, dataUrlToInlinePart } from './messages';
import { GEMINI_SAFETY_SETTINGS, assertUsableApiKey } from './safety';

// Gemini 공급자. 공식 SDK(@google/genai) 대신 REST(generateContent / streamGenerateContent)를
// fetch로 직접 호출한다. Edge runtime에서 Node 전용 API 없이 동작하고, 새 의존성과 번들
// 호환성 문제를 만들지 않기 위해서다.
//
// 모델 선택 근거는 docs/GEMINI_OPERATIONS.md에 기록한다. Gemini 모델 변경은 이 상수만 수정한다.
export const GEMINI_MODEL = 'gemini-3.6-flash';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// E2E 테스트가 서버에서 나가는 Gemini 요청을 가짜 서버(tests/support/mock-upstash-server.js)로
// 돌리기 위한 설정. 운영 환경에서는 설정하지 않는다.
const getGeminiApiBase = () => (process.env.GEMINI_API_BASE_URL || GEMINI_API_BASE).replace(/\/+$/, '');

// 표지판 추출은 thinking 토큰까지 출력 한도에 포함될 수 있어 JSON이 잘리지 않도록 넉넉히 둔다.
const SIGN_TEXT_MAX_OUTPUT_TOKENS = 8192;

const BLOCKED_FINISH_REASONS = new Set([
  'SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'IMAGE_SAFETY',
]);

// ── 오류 분류 ──────────────────────────────────────────────

function parseRetryAfterSeconds(errorBody) {
  const details = Array.isArray(errorBody?.error?.details) ? errorBody.error.details : [];
  const retryInfo = details.find(d => typeof d?.retryDelay === 'string');
  const seconds = retryInfo ? parseFloat(retryInfo.retryDelay) : 0;
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0;
}

// HTTP 상태와 Google 오류 본문을 앱 공통 code로 바꾼다. 본문 원문은 밖으로 내보내지 않는다.
export function classifyGeminiHttpError(status, errorBody) {
  const serialized = JSON.stringify(errorBody || {});
  const retryAfterSeconds = parseRetryAfterSeconds(errorBody);

  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid|API_KEY_SERVICE_BLOCKED|PERMISSION_DENIED/i.test(serialized)) {
    return new AiError(AI_ERROR_CODES.INVALID_KEY);
  }
  if (status === 429) {
    // 하루 한도(PerDay)를 다 쓴 경우와 분당 빈도 제한을 구분해 안내한다.
    const daily = /PerDay|per[ _-]?day|quota_exceeded|daily/i.test(serialized);
    return new AiError(
      daily ? AI_ERROR_CODES.QUOTA_EXCEEDED : AI_ERROR_CODES.RATE_LIMITED,
      { retryAfterSeconds }
    );
  }
  if (status >= 500) return new AiError(AI_ERROR_CODES.UNAVAILABLE);
  if (status === 404) return new AiError(AI_ERROR_CODES.UNAVAILABLE);
  return new AiError(AI_ERROR_CODES.INVALID_REQUEST);
}

// ── 공통 요청 ──────────────────────────────────────────────

async function callGemini(path, { apiKey, method = 'POST', body }) {
  assertUsableApiKey(apiKey);

  let res;
  try {
    res = await fetch(`${getGeminiApiBase()}/${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // 키는 URL(query string)이 아니라 헤더로만 보낸다. 서버·프록시 로그에 URL이 남아도 키가 새지 않는다.
        'x-goog-api-key': apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new AiError(AI_ERROR_CODES.NETWORK);
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw classifyGeminiHttpError(res.status, errorBody);
  }
  return res;
}

// 응답 한 덩어리에서 학생에게 보여줄 텍스트만 꺼낸다. thinking 파트는 제외한다.
export function extractCandidateText(data) {
  if (data?.promptFeedback?.blockReason) {
    throw new AiError(AI_ERROR_CODES.SAFETY_BLOCKED);
  }
  const candidate = data?.candidates?.[0];
  const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
  const text = parts
    .filter(part => typeof part?.text === 'string' && part.thought !== true)
    .map(part => part.text)
    .join('');

  if (!text && BLOCKED_FINISH_REASONS.has(candidate?.finishReason)) {
    throw new AiError(AI_ERROR_CODES.SAFETY_BLOCKED);
  }
  return { text, finishReason: candidate?.finishReason || '' };
}

const buildRequest = (messages, extra = {}) => ({
  ...toGeminiContents(messages, { formatGuard: extra.formatGuard }),
  safetySettings: GEMINI_SAFETY_SETTINGS,
  ...(extra.generationConfig ? { generationConfig: extra.generationConfig } : {}),
});

// 모델이 지시를 어기고 JSON을 ```json 블록으로 감싸도 읽을 수 있게 벗겨 낸다.
function parseJsonText(text) {
  const unwrapped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(unwrapped);
  } catch {
    throw new AiError(AI_ERROR_CODES.BAD_RESPONSE);
  }
}

// ── SSE 파싱 ───────────────────────────────────────────────

// streamGenerateContent?alt=sse 응답을 이벤트(JSON) 단위로 읽는다.
async function* readSseEvents(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const parseEvent = (rawEvent) => {
    const dataLines = rawEvent
      .split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart());
    if (dataLines.length === 0) return null;
    try {
      return JSON.parse(dataLines.join('\n'));
    } catch {
      throw new AiError(AI_ERROR_CODES.BAD_RESPONSE);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop();
      for (const rawEvent of events) {
        const event = parseEvent(rawEvent);
        if (event) yield event;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      const event = parseEvent(buffer);
      if (event) yield event;
    }
  } finally {
    reader.releaseLock?.();
  }
}

// ── 공통 인터페이스 구현 ───────────────────────────────────

export async function* generateStream({ messages, apiKey }) {
  const res = await callGemini(
    `models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`,
    { apiKey, body: buildRequest(messages, { formatGuard: true }) }
  );
  if (!res.body) throw new AiError(AI_ERROR_CODES.BAD_RESPONSE);

  let sentAny = false;
  for await (const event of readSseEvents(res.body)) {
    let text = '';
    try {
      ({ text } = extractCandidateText(event));
    } catch (error) {
      // 답변 일부를 이미 보낸 뒤 안전 필터에 걸리면 거기서 멈춘다. 오류로 끊으면
      // 화면이 같은 요청을 다시 보내 무료 사용량만 두 번 쓰게 된다.
      if (sentAny && error?.code === AI_ERROR_CODES.SAFETY_BLOCKED) return;
      throw error;
    }
    if (text) {
      sentAny = true;
      yield text;
    }
  }
}

export async function generateOnce({ messages, apiKey }) {
  const res = await callGemini(`models/${GEMINI_MODEL}:generateContent`, {
    apiKey,
    body: buildRequest(messages, { formatGuard: true }),
  });
  const data = await res.json().catch(() => {
    throw new AiError(AI_ERROR_CODES.BAD_RESPONSE);
  });
  const { text } = extractCandidateText(data);
  if (!text.trim()) throw new AiError(AI_ERROR_CODES.BAD_RESPONSE);
  return text.trim();
}

export async function generateStructured({ messages, schema, apiKey }) {
  const res = await callGemini(`models/${GEMINI_MODEL}:generateContent`, {
    apiKey,
    body: buildRequest(messages, {
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(schema),
      },
    }),
  });
  const data = await res.json().catch(() => {
    throw new AiError(AI_ERROR_CODES.BAD_RESPONSE);
  });
  const { text } = extractCandidateText(data);
  if (!text.trim()) throw new AiError(AI_ERROR_CODES.BAD_RESPONSE);
  return parseJsonText(text);
}

export async function analyzeImage({ image, prompt, systemPrompt, schema, apiKey }) {
  const imagePart = dataUrlToInlinePart(image);
  if (!imagePart) throw new AiError(AI_ERROR_CODES.INVALID_REQUEST);

  const res = await callGemini(`models/${GEMINI_MODEL}:generateContent`, {
    apiKey,
    body: {
      ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
      contents: [{ role: 'user', parts: [{ text: prompt }, imagePart] }],
      safetySettings: GEMINI_SAFETY_SETTINGS,
      generationConfig: {
        maxOutputTokens: SIGN_TEXT_MAX_OUTPUT_TOKENS,
        ...(schema
          ? { responseMimeType: 'application/json', responseSchema: toGeminiSchema(schema) }
          : {}),
      },
    },
  });
  const data = await res.json().catch(() => {
    throw new AiError(AI_ERROR_CODES.BAD_RESPONSE);
  });
  const { text } = extractCandidateText(data);
  if (!text.trim()) throw new AiError(AI_ERROR_CODES.BAD_RESPONSE);
  return schema ? parseJsonText(text) : text.trim();
}

// 키 확인은 답변 생성 요청 없이 모델 정보 조회(models.get)로 한다. 생성 토큰을 쓰지 않고,
// 이 키로 선택한 모델에 접근할 수 있는지도 함께 확인된다.
export async function validateCredential({ apiKey }) {
  await callGemini(`models/${GEMINI_MODEL}`, { apiKey, method: 'GET' });
  return { ok: true, model: GEMINI_MODEL };
}
