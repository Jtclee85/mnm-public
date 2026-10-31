import { AiError } from './errors';
import { AI_PROVIDER, AI_KEY_HEADER, AI_SELECTION_HEADER, CLASS_CODE_HEADER, AI_ERROR_CODES } from '../../aiProviderConfig';
import * as gemini from './gemini';
import * as openai from './openai';
import { normalizeApiKey, assertUsableApiKey } from './safety';
import { getClientId, resolveClassApiKey, resolveClassCredential } from '../class/classes';

// 현재 공급자를 고르고 라우트가 쓰는 공통 인터페이스를 제공한다.
//   generateStream({ messages, apiKey })        → 텍스트 조각을 내보내는 async iterator
//   generateOnce({ messages, apiKey })          → 전체 텍스트
//   generateStructured({ messages, schema, apiKey, schemaName }) → JSON 객체
//   analyzeImage({ image, prompt, systemPrompt, schema, apiKey, schemaName }) → 텍스트 또는 JSON
//   validateCredential({ apiKey })              → { ok, model }
// 모든 실패는 lib/server/ai/errors.js의 AiError로 던진다.

const PROVIDERS = {
  gemini: { name: 'gemini', requiresClassCode: true, ...gemini },
  openai: { name: 'openai', requiresClassCode: false, ...openai },
};

export function getAiProvider() {
  return PROVIDERS[AI_PROVIDER] || PROVIDERS.gemini;
}

// 학급 코드는 한글 학교 이름을 담으므로 브라우저가 encodeURIComponent로 보낸다.
export function readClassCodeHeader(req) {
  const raw = req.headers.get(CLASS_CODE_HEADER) || '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return '';
  }
}

// 학생 AI 요청: 요청 헤더의 학급 코드로 교사 키를 찾아 복호화한다. 키는 이 요청을 처리하는
// 지역 변수로만 쓰고, 전역·캐시·로그·응답에 남기지 않는다. OpenAI 모드는 서버 키를 쓴다.
export async function resolveApiKey(req, provider = getAiProvider()) {
  if (!provider.requiresClassCode) return '';
  const apiKey = await resolveClassApiKey({
    code: readClassCodeHeader(req),
    clientId: await getClientId(req),
  });
  assertUsableApiKey(apiKey);
  return apiKey;
}

// 교사용 화면: 키 확인·학급 만들기·키 교체에서 교사가 직접 보낸 키를 읽는다.
export function readTeacherApiKey(req) {
  const apiKey = normalizeApiKey(req.headers.get(AI_KEY_HEADER));
  assertUsableApiKey(apiKey);
  return apiKey;
}

// 교사 선택값은 허용된 두 공급자만 받는다. 학생 요청은 이 헤더를 신뢰하지 않는다.
export function readTeacherProvider(req) {
  const name = req.headers.get(AI_SELECTION_HEADER) || 'gemini';
  if (!Object.prototype.hasOwnProperty.call(PROVIDERS, name)) throw new AiError(AI_ERROR_CODES.INVALID_REQUEST);
  return PROVIDERS[name];
}

export async function resolveAiRequest(req) {
  if (!getAiProvider().requiresClassCode) return { provider: getAiProvider(), apiKey: '' };
  const credential = await resolveClassCredential({ code: readClassCodeHeader(req), clientId: await getClientId(req) });
  assertUsableApiKey(credential.apiKey);
  return { provider: PROVIDERS[credential.provider], apiKey: credential.apiKey };
}
