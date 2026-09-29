import { AI_PROVIDER, AI_KEY_HEADER } from '../../aiProviderConfig';
import * as gemini from './gemini';
import * as openai from './openai';
import { normalizeApiKey, assertUsableApiKey } from './safety';

// 현재 공급자를 고르고 라우트가 쓰는 공통 인터페이스를 제공한다.
//   generateStream({ messages, apiKey })        → 텍스트 조각을 내보내는 async iterator
//   generateOnce({ messages, apiKey })          → 전체 텍스트
//   generateStructured({ messages, schema, apiKey, schemaName }) → JSON 객체
//   analyzeImage({ image, prompt, systemPrompt, schema, apiKey, schemaName }) → 텍스트 또는 JSON
//   validateCredential({ apiKey })              → { ok, model }
// 모든 실패는 lib/server/ai/errors.js의 AiError로 던진다.

const PROVIDERS = {
  gemini: { name: 'gemini', requiresUserKey: true, ...gemini },
  openai: { name: 'openai', requiresUserKey: false, ...openai },
};

export function getAiProvider() {
  return PROVIDERS[AI_PROVIDER] || PROVIDERS.gemini;
}

// 요청 헤더에서 사용자 키를 꺼낸다. 키는 이 요청을 처리하는 지역 변수로만 쓰고,
// 전역·캐시·로그에 남기지 않는다. OpenAI 모드에서는 사용자 키를 읽지 않는다.
export function resolveApiKey(req, provider = getAiProvider()) {
  if (!provider.requiresUserKey) return '';
  const apiKey = normalizeApiKey(req.headers.get(AI_KEY_HEADER));
  assertUsableApiKey(apiKey);
  return apiKey;
}
