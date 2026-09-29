import OpenAI from "openai";

// /api/chat(스트리밍)과 /api/chat-once(비스트리밍 fallback)가 모델·입력 제한·
// moderation 정책을 반드시 동일하게 쓰도록 이 파일에 공통화한다.
// 두 라우트 모두 Edge runtime이므로 Node 전용 API는 사용하지 않는다.

// 접근 불가 시 'gpt-5-mini' 또는 기존 'gpt-4o-mini'로 폴백 가능
export const MODEL = "gpt-5.4-mini";

// 한국어 기준 약 12,500 토큰 이내로 제어 (시스템 프롬프트 포함).
// 프론트가 분석용 자료를 7,000자로 줄여 보내므로 평소엔 도달하지 않는 안전망이다.
export const MAX_TOTAL_CHARS = 25000;

// 모듈 로드 시점이 아니라 첫 사용 시점에 생성한다. 모듈 스코프에서 만들면
// OPENAI_API_KEY가 없을 때 라우트 전체가 로드 단계에서 죽어 JSON 대신
// HTML 오류 페이지가 반환되기 때문.
let cachedClient = null;
export function getOpenAI() {
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return cachedClient;
}

export const jsonResponse = (body, status) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

// 요청 본문의 messages를 검증한다.
// 통과하면 null, 실패하면 그대로 반환할 오류 Response를 돌려준다.
export async function validateChatMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: '잘못된 요청입니다.' }, 400);
  }

  const totalChars = messages.reduce(
    (sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0),
    0
  );

  if (totalChars > MAX_TOTAL_CHARS) {
    return jsonResponse(
      { error: '입력 자료가 너무 깁니다. 조사자료를 짧게 줄여 주세요.' },
      400
    );
  }

  // 마지막 user 메시지만 검사 (시스템 프롬프트·이전 대화는 이미 통제된 내용)
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const inputText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';

  if (inputText.length >= 2) {
    try {
      const modResult = await getOpenAI().moderations.create({
        model: 'omni-moderation-latest',
        input: inputText,
      });

      if (modResult.results[0]?.flagged) {
        return jsonResponse(
          {
            error: '앗, 이 내용은 학습 도우미가 다루기 어려운 내용이에요. 조사 주제나 자료를 다시 한 번 확인해 줄래?',
          },
          400
        );
      }
    } catch (modError) {
      // fail-open: moderation 호출 실패 시 수업 흐름을 멈추지 않고 통과.
      // 보안을 강화하려면 여기서 400을 반환하는 fail-closed로 변경할 것.
      console.error("Moderation API 호출 오류 (통과 처리):", modError);
    }
  }

  return null;
}

// OpenAI 호출 실패를 사용자용 오류 Response로 변환한다.
export function openaiErrorResponse(error) {
  if (error?.status === 429) {
    return jsonResponse(
      { error: '지금 너무 많이 사용 중이에요. 잠시 후 다시 시도해 주세요.' },
      429
    );
  }

  return jsonResponse({ error: '오류가 발생했습니다. 다시 시도해 주세요.' }, 500);
}
