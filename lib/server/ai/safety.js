import { AI_ERROR_CODES } from '../../aiProviderConfig';
import { AiError } from './errors';

// 한국어 기준 약 12,500 토큰 이내로 제어 (시스템 프롬프트 포함).
// 프론트가 분석용 자료를 7,000자로 줄여 보내므로 평소엔 도달하지 않는 안전망이다.
export const MAX_TOTAL_CHARS = 25000;

// 표지판 사진: base64 문자열 길이 기준 상한 — 디코딩하면 약 8MB. 클라이언트는 1280px로
// 미리 압축해서 보내므로 보통 이보다 훨씬 작고, 이 값은 변조된 클라이언트를 막는 안전장치다.
export const MAX_IMAGE_BASE64_LENGTH = 11_000_000;
export const ALLOWED_IMAGE_DATA_URL = /^data:image\/(jpeg|jpg|png|webp);base64,/i;

// Gemini 2.5·3 계열은 안전 필터 기본값이 꺼져 있다(공식 문서: default block threshold Off).
// 초등학생이 쓰는 서비스이므로 네 범주를 모두 명시적으로 켠다. OpenAI 모드의
// omni-moderation 검사를 대신하는 1차 안전장치다.
export const GEMINI_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
];

const ALLOWED_ROLES = new Set(['system', 'user', 'assistant']);

// 채팅 계열 요청의 messages 형식과 길이를 검사한다. 문제가 있으면 AiError를 던진다.
export function assertValidChatMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new AiError(AI_ERROR_CODES.INVALID_REQUEST);
  }

  const wellFormed = messages.every(
    m => m && ALLOWED_ROLES.has(m.role) && typeof m.content === 'string'
  );
  if (!wellFormed || !messages.some(m => m.role === 'user')) {
    throw new AiError(AI_ERROR_CODES.INVALID_REQUEST);
  }

  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    throw new AiError(AI_ERROR_CODES.INPUT_TOO_LONG);
  }
}

// Google API 키는 영문·숫자·'-'·'_'로만 이뤄진다. 형식이 다르면 외부로 보내지 않고 바로
// 거절해, 헤더 주입이나 엉뚱한 문자열이 Google로 전달되는 일을 막는다.
const API_KEY_PATTERN = /^[A-Za-z0-9_-]{20,120}$/;

export function normalizeApiKey(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function assertUsableApiKey(apiKey) {
  if (!apiKey) throw new AiError(AI_ERROR_CODES.MISSING_KEY);
  if (!API_KEY_PATTERN.test(apiKey)) throw new AiError(AI_ERROR_CODES.INVALID_KEY);
}
