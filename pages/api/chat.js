import { getAiProvider, resolveApiKey } from '../../lib/server/ai/provider';
import { AiError, aiErrorResponse, jsonResponse, logAiError } from '../../lib/server/ai/errors';
import { assertValidChatMessages } from '../../lib/server/ai/safety';
import { AI_ERROR_CODES } from '../../lib/aiProviderConfig';

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

    const provider = getAiProvider();
    const apiKey = await resolveApiKey(req, provider);
    const iterator = provider.generateStream({ messages, apiKey });

    // 첫 조각을 받은 뒤에 SSE를 시작한다. 키 오류·할당량 초과·안전 차단처럼 시작 단계에서
    // 나는 오류를 HTTP 상태와 code로 알려야 화면이 fallback 재요청 없이 바로 안내할 수 있다.
    const first = await iterator.next();
    if (first.done) throw new AiError(AI_ERROR_CODES.BAD_RESPONSE);

    const encoder = new TextEncoder();
    const send = (controller, text) =>
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(text)}\n\n`));

    const webStream = new ReadableStream({
      async start(controller) {
        send(controller, first.value);
        try {
          for (let step = await iterator.next(); !step.done; step = await iterator.next()) {
            send(controller, step.value);
          }
          controller.close();
        } catch (error) {
          // 스트림 도중 끊김 — 화면은 받은 분량에 따라 완료 처리하거나 한 번만 fallback한다.
          logAiError('chat-stream', error);
          controller.error(new Error('stream interrupted'));
        }
      },
      cancel() {
        iterator.return?.();
      },
    });

    return new Response(webStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    logAiError('chat', error);
    return aiErrorResponse(error);
  }
}
