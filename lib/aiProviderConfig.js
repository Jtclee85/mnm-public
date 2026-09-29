// 브라우저와 Edge 서버가 함께 쓰는 AI 공급자 설정.
// AI_PROVIDER는 next.config.js의 env로 빌드 시점에 주입된다. 서버와 화면이 같은 값을
// 봐야 "키를 사용자에게 받을지"와 "서버가 어떤 공급자를 부를지"가 어긋나지 않는다.
// 값을 바꾸면 다시 빌드해야 한다(dev 서버는 재시작).
export const AI_PROVIDER = process.env.AI_PROVIDER === 'openai' ? 'openai' : 'gemini';

// Gemini 모드는 서버에 공용 키를 두지 않고, 사용자가 자기 기기에 저장한 키를 요청마다 보낸다.
export const REQUIRES_USER_AI_KEY = AI_PROVIDER === 'gemini';

// 사용자 키를 싣는 요청 헤더 이름. 일반 접근 로그에서 용도가 드러나지 않게 중립적인 이름을
// 쓴다. 값은 어떤 경우에도 로그·URL·쿠키에 남기지 않는다.
export const AI_KEY_HEADER = 'x-mnm-ref';

// 키 설정 창의 'Google AI Studio에서 키 발급받기' 링크
export const GEMINI_KEY_ISSUE_URL = 'https://aistudio.google.com/apikey';

// 서버가 돌려주는 오류 code. 화면은 이 code로 언어별 안내문을 고른다.
export const AI_ERROR_CODES = Object.freeze({
  MISSING_KEY: 'missing_key',
  INVALID_KEY: 'invalid_key',
  QUOTA_EXCEEDED: 'quota_exceeded',
  RATE_LIMITED: 'rate_limited',
  UNAVAILABLE: 'unavailable',
  SAFETY_BLOCKED: 'safety_blocked',
  NETWORK: 'network',
  BAD_RESPONSE: 'bad_response',
  INVALID_REQUEST: 'invalid_request',
  INPUT_TOO_LONG: 'input_too_long',
  DUPLICATE_REQUEST: 'duplicate_request',
});

// 키 설정 창으로 안내해야 하는 오류
export const AI_KEY_ERROR_CODES = new Set([AI_ERROR_CODES.MISSING_KEY, AI_ERROR_CODES.INVALID_KEY]);

// 공급자 오류로 분류된 응답은 같은 요청을 다시 보내도 결과가 같거나(키·할당량·안전 차단)
// 사용량만 늘어난다. 이 code가 오면 비스트리밍 fallback으로 재요청하지 않는다.
export const isClassifiedAiError = (code) =>
  typeof code === 'string' && Object.values(AI_ERROR_CODES).includes(code);
