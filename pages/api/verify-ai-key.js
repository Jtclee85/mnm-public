import { getAiProvider, resolveApiKey } from '../../lib/server/ai/provider';
import { aiErrorResponse, jsonResponse, logAiError } from '../../lib/server/ai/errors';

// 키 설정 창의 '연결 확인' 버튼 전용. 답변 생성 요청 없이 모델 정보 조회로 키를 확인한다.
// 키는 요청 헤더로만 받고, 응답·로그에 키나 키 일부를 담지 않는다.
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  try {
    const provider = getAiProvider();
    const apiKey = resolveApiKey(req, provider);
    const { model } = await provider.validateCredential({ apiKey });
    return jsonResponse({ ok: true, provider: provider.name, model }, 200);
  } catch (error) {
    logAiError('verify-ai-key', error);
    return aiErrorResponse(error);
  }
}
