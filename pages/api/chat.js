import {
  MODEL,
  getOpenAI,
  jsonResponse,
  validateChatMessages,
  openaiErrorResponse,
} from '../../lib/server/chatApiShared';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  const { messages } = await req.json();

  const validationError = await validateChatMessages(messages);
  if (validationError) return validationError;

  try {
    const stream = await getOpenAI().chat.completions.create({
      model: MODEL,
      messages,
      stream: true,
    });

    const webStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || "";
          if (delta) {
            const encoded = new TextEncoder().encode(`data: ${JSON.stringify(delta)}\n\n`);
            controller.enqueue(encoded);
          }
        }
        controller.close();
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
    console.error("OpenAI API 호출 오류:", error);
    return openaiErrorResponse(error);
  }
}
