import OpenAI from 'openai';
import { AI_ERROR_CODES } from '../../aiProviderConfig';
import { AiError } from './errors';
import { MODEL } from '../chatApiShared';

// 기존 OpenAI 구현을 롤백용으로 보존한 공급자 모듈. AI_PROVIDER=openai로 빌드하면 쓰인다.
// 키는 사용자에게 받지 않고 서버 환경변수 OPENAI_API_KEY를 쓴다.

// Vision(이미지) 입력용 모델 — 기존 extract-sign-text 라우트와 동일
const VISION_MODEL = 'gpt-4o-mini';

// 모듈 로드 시점이 아니라 첫 사용 시점에 만든다. 모듈 스코프에서 만들면 OPENAI_API_KEY가
// 없을 때(예: Gemini 모드) 라우트 전체가 로드 단계에서 죽기 때문이다.
let cachedClient = null;
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new AiError(AI_ERROR_CODES.UNAVAILABLE);
  if (!cachedClient) cachedClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return cachedClient;
}

function toProviderError(error) {
  if (error instanceof AiError) return error;
  if (error?.status === 429) return new AiError(AI_ERROR_CODES.RATE_LIMITED);
  if (error?.status === 400) return new AiError(AI_ERROR_CODES.INVALID_REQUEST);
  return new AiError(AI_ERROR_CODES.UNAVAILABLE);
}

// 기존 정책 유지: 마지막 학생 입력을 omni-moderation으로 검사한다.
// failOpen이면 검사 서비스 오류 시 수업 흐름을 멈추지 않고 통과한다(기존 chat 라우트 동작).
// 관련성 판정은 기존처럼 검사 실패 시 차단(fail-closed)한다.
async function moderateLastUserMessage(messages, { failOpen }) {
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const inputText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';
  if (inputText.length < 2) return;

  let flagged = false;
  try {
    const modResult = await getOpenAI().moderations.create({
      model: 'omni-moderation-latest',
      input: inputText,
    });
    flagged = !!modResult.results[0]?.flagged;
  } catch {
    if (!failOpen) throw new AiError(AI_ERROR_CODES.UNAVAILABLE);
    console.error('[ai:openai] moderation 호출 실패 (통과 처리)');
  }
  if (flagged) throw new AiError(AI_ERROR_CODES.SAFETY_BLOCKED);
}

export async function* generateStream({ messages }) {
  await moderateLastUserMessage(messages, { failOpen: true });
  let stream;
  try {
    stream = await getOpenAI().chat.completions.create({ model: MODEL, messages, stream: true });
  } catch (error) {
    throw toProviderError(error);
  }
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) yield delta;
  }
}

export async function generateOnce({ messages }) {
  await moderateLastUserMessage(messages, { failOpen: true });
  try {
    const completion = await getOpenAI().chat.completions.create({ model: MODEL, messages, stream: false });
    const content = completion.choices?.[0]?.message?.content?.trim() || '';
    if (!content) throw new AiError(AI_ERROR_CODES.BAD_RESPONSE);
    return content;
  } catch (error) {
    throw toProviderError(error);
  }
}

export async function generateStructured({ messages, schema, schemaName = 'result' }) {
  await moderateLastUserMessage(messages, { failOpen: false });
  try {
    const result = await getOpenAI().chat.completions.create({
      model: MODEL,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: { name: schemaName, strict: true, schema },
      },
    });
    return JSON.parse(result.choices[0]?.message?.content || '{}');
  } catch (error) {
    if (error instanceof SyntaxError) throw new AiError(AI_ERROR_CODES.BAD_RESPONSE);
    throw toProviderError(error);
  }
}

export async function analyzeImage({ image, prompt, systemPrompt, schema, schemaName = 'result' }) {
  try {
    const result = await getOpenAI().chat.completions.create({
      model: VISION_MODEL,
      max_tokens: 2000,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: image, detail: 'high' } },
          ],
        },
      ],
      ...(schema
        ? { response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } } }
        : {}),
    });
    const content = result.choices[0]?.message?.content || '';
    return schema ? JSON.parse(content || '{}') : content.trim();
  } catch (error) {
    if (error instanceof SyntaxError) throw new AiError(AI_ERROR_CODES.BAD_RESPONSE);
    throw toProviderError(error);
  }
}

// OpenAI 모드는 서버 키를 쓰므로 사용자 키 확인이 필요 없다.
export async function validateCredential() {
  return { ok: true, model: MODEL };
}
