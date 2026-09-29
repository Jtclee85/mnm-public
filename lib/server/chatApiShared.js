// OpenAI 공급자(롤백용, AI_PROVIDER=openai)의 채팅 모델 상수.
// 공급자 공통 계층은 lib/server/ai/에 있다. moderation·입력 검증·오류 변환은
// lib/server/ai/openai.js, safety.js, errors.js로 옮겼고, Gemini 모델은
// lib/server/ai/gemini.js의 GEMINI_MODEL에서 관리한다.

// 접근 불가 시 'gpt-5-mini' 또는 기존 'gpt-4o-mini'로 폴백 가능
export const MODEL = "gpt-5.4-mini";
