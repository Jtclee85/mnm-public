import { AI_ERROR_CODES } from '../../aiProviderConfig';

// 공급자(Gemini·OpenAI)의 원본 오류를 앱 공통 오류로 바꾼다.
// 원본 오류 메시지·요청 헤더·키는 브라우저에 절대 돌려주지 않고, code와 정해진 안내문만 보낸다.

const ERROR_SPECS = {
  [AI_ERROR_CODES.MISSING_KEY]: {
    status: 401,
    message: 'Gemini API 키가 필요해요. 키 설정에서 먼저 키를 넣어 주세요.',
  },
  [AI_ERROR_CODES.INVALID_KEY]: {
    status: 401,
    message: 'Gemini API 키를 확인할 수 없어요. 키 설정에서 키를 다시 확인해 주세요.',
  },
  [AI_ERROR_CODES.QUOTA_EXCEEDED]: {
    status: 429,
    message: '오늘 쓸 수 있는 무료 사용량을 모두 썼어요. 내일 다시 시도해 주세요.',
  },
  [AI_ERROR_CODES.RATE_LIMITED]: {
    status: 429,
    message: '지금 너무 많이 사용 중이에요. 잠시 후 다시 시도해 주세요.',
  },
  [AI_ERROR_CODES.UNAVAILABLE]: {
    status: 503,
    message: 'AI 서비스가 잠시 응답하지 않아요. 잠시 후 다시 시도해 주세요.',
  },
  [AI_ERROR_CODES.SAFETY_BLOCKED]: {
    status: 400,
    message: '앗, 이 내용은 학습 도우미가 다루기 어려운 내용이에요. 조사 주제나 자료를 다시 한 번 확인해 줄래?',
  },
  [AI_ERROR_CODES.NETWORK]: {
    status: 502,
    message: 'AI 서비스에 연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
  },
  [AI_ERROR_CODES.BAD_RESPONSE]: {
    status: 502,
    message: 'AI 응답을 읽지 못했어요. 다시 시도해 주세요.',
  },
  [AI_ERROR_CODES.INVALID_REQUEST]: {
    status: 400,
    message: '잘못된 요청입니다.',
  },
  [AI_ERROR_CODES.INPUT_TOO_LONG]: {
    status: 400,
    message: '입력 자료가 너무 깁니다. 조사자료를 짧게 줄여 주세요.',
  },
  [AI_ERROR_CODES.CLASS_CODE_REQUIRED]: {
    status: 401,
    message: '학급 코드가 필요해요. 선생님께 받은 학급 코드를 넣어 주세요.',
  },
  [AI_ERROR_CODES.CLASS_CODE_INVALID]: {
    status: 401,
    message: '학급 코드를 찾을 수 없어요. 코드가 맞는지, 오늘 받은 코드인지 확인해 주세요.',
  },
  [AI_ERROR_CODES.CLASS_UNAVAILABLE]: {
    status: 503,
    message: '학급 기능을 지금 쓸 수 없어요. 선생님께 알려 주세요.',
  },
  [AI_ERROR_CODES.TOO_MANY_ATTEMPTS]: {
    status: 429,
    message: '학급 코드를 너무 여러 번 틀렸어요. 잠시 후 다시 시도해 주세요.',
  },
  [AI_ERROR_CODES.FORBIDDEN]: {
    status: 403,
    message: '이 학급을 관리할 권한이 없어요. 학급을 만든 기기에서 관리해 주세요.',
  },
};

export class AiError extends Error {
  constructor(code, { retryAfterSeconds = 0 } = {}) {
    super(code);
    this.name = 'AiError';
    this.code = ERROR_SPECS[code] ? code : AI_ERROR_CODES.UNAVAILABLE;
    this.status = ERROR_SPECS[this.code].status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const toAiError = (error) =>
  error instanceof AiError ? error : new AiError(AI_ERROR_CODES.UNAVAILABLE);

export const jsonResponse = (body, status) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

export function aiErrorBody(error) {
  const aiError = toAiError(error);
  const body = { error: ERROR_SPECS[aiError.code].message, code: aiError.code };
  if (aiError.retryAfterSeconds > 0) body.retryAfterSeconds = aiError.retryAfterSeconds;
  return body;
}

export function aiErrorResponse(error) {
  const aiError = toAiError(error);
  return jsonResponse(aiErrorBody(aiError), aiError.status);
}

// 운영 로그에는 분류 결과만 남긴다. 원본 오류 객체는 요청 본문·키 일부를 담을 수 있어 출력하지 않는다.
export function logAiError(label, error) {
  const aiError = toAiError(error);
  const detail = error instanceof AiError ? '' : ` (${error?.name || 'Error'})`;
  console.error(`[ai:${label}] ${aiError.code} ${aiError.status}${detail}`);
}
