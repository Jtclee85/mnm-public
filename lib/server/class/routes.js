import { AI_ERROR_CODES, CLASS_MANAGE_HEADER } from '../../aiProviderConfig';
import { AiError } from '../ai/errors';
import { getAiProvider } from '../ai/provider';

// 학급 API 라우트 공통 처리. 학급 기능은 사용자 키가 필요한 Gemini 모드에서만 쓴다.

export async function readJsonBody(req) {
  return req.json().catch(() => {
    throw new AiError(AI_ERROR_CODES.INVALID_REQUEST);
  });
}

export function assertClassMode() {
  if (!getAiProvider().requiresClassCode) throw new AiError(AI_ERROR_CODES.INVALID_REQUEST);
}

export function readManageToken(req) {
  return (req.headers.get(CLASS_MANAGE_HEADER) || '').trim();
}

// 학급 응답은 코드·관리 토큰을 담으므로 어떤 캐시에도 남기지 않는다.
export const noStoreJson = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
