import { resolveAiRequest } from '../../lib/server/ai/provider';
import { AiError, aiErrorResponse, jsonResponse, logAiError } from '../../lib/server/ai/errors';
import { assertValidChatMessages } from '../../lib/server/ai/safety';
import { AI_ERROR_CODES } from '../../lib/aiProviderConfig';

// /api/chat(SSE 스트리밍)이 학교망·보안 프로그램 등에서 차단될 때 쓰는
// 비스트리밍 fallback. 검증·모델·안전 정책은 공급자 공통 계층으로 /api/chat과 동일하다.
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  try {
    const { messages } = await req.json().catch(() => {
      throw new AiError(AI_ERROR_CODES.INVALID_REQUEST);
    });
    assertValidChatMessages(messages);

    const { provider, apiKey } = await resolveAiRequest(req);
    const content = await provider.generateOnce({ messages, apiKey });

    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    logAiError('chat-once', error);
    return aiErrorResponse(error);
  }
}
