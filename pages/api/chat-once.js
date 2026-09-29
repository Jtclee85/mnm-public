import {
  MODEL,
  getOpenAI,
  jsonResponse,
  validateChatMessages,
  openaiErrorResponse,
} from '../../lib/server/chatApiShared';

// /api/chat(SSE 스트리밍)이 학교망·보안 프로그램 등에서 차단될 때 쓰는
// 비스트리밍 fallback. 검증·모델·정책은 chatApiShared로 /api/chat과 동일하다.
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
    const completion = await getOpenAI().chat.completions.create({
      model: MODEL,
      messages,
      stream: false,
    });

    const content = completion.choices?.[0]?.message?.content?.trim() || '';

    if (!content) {
      return jsonResponse({ error: '빈 응답이 반환되었습니다.' }, 500);
    }

    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error("OpenAI 비스트리밍 API 호출 오류:", error);
    return openaiErrorResponse(error);
  }
}
