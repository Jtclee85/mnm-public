import { getLanguageOption } from "../../lib/i18n";
import { isDirectTopicQuestion } from "../../lib/chatRelevance";
import { getAiProvider, resolveApiKey } from "../../lib/server/ai/provider";
import { aiErrorBody, logAiError, toAiError } from "../../lib/server/ai/errors";
import { AI_ERROR_CODES } from "../../lib/aiProviderConfig";

export const config = {
  runtime: 'edge',
};

const MAX_SOURCE_CHARS = 6000;
const MAX_CONVERSATION_CHARS = 2500;

const jsonHeaders = { 'Content-Type': 'application/json' };

// 키 누락·키 오류·사용량 초과는 화면이 키 설정 안내나 사용량 안내를 띄울 수 있도록
// HTTP 상태와 code를 함께 돌려준다. 그 밖의 판정 실패는 기존처럼 200 + relevant:false다.
const PASS_THROUGH_ERROR_CODES = new Set([
  AI_ERROR_CODES.MISSING_KEY,
  AI_ERROR_CODES.INVALID_KEY,
  AI_ERROR_CODES.QUOTA_EXCEEDED,
  AI_ERROR_CODES.RATE_LIMITED,
]);

const RELEVANCE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    relevant: { type: 'boolean' },
    reason: { type: 'string' },
    redirect: { type: 'string' },
  },
  required: ['relevant', 'reason', 'redirect'],
};

const relevanceResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: jsonHeaders });
  }

  const body = await req.json().catch(() => ({}));
  const { topic = '', sourceText = '', userText = '', language = 'ko', conversation = [] } = body || {};
  const trimmedTopic = String(topic).trim();
  const trimmedSource = String(sourceText).trim();
  const trimmedUserText = String(userText).trim();
  const targetLanguage = getLanguageOption(language).targetName;

  if (!trimmedTopic || !trimmedSource || !trimmedUserText) {
    return new Response(
      JSON.stringify({
        relevant: false,
        reason: 'missing_context',
        redirect: '',
      }),
      { status: 200, headers: jsonHeaders }
    );
  }

  // 조사 주제의 구체적인 핵심어를 직접 묻는 질문은 AI 판정 없이 바로 허용한다.
  // 확률적인 판정의 오판을 막고, 무료 사용량도 아낀다. 아이돌·게임처럼 명백한 이탈
  // 신호가 함께 있는 질문은 이 규칙에서 제외되어 아래 AI 판정을 계속 거친다.
  // 이어지는 /api/chat 요청은 공급자 안전 검사(Gemini safetySettings, OpenAI moderation)를 그대로 거친다.
  if (isDirectTopicQuestion(trimmedTopic, trimmedUserText)) {
    return relevanceResponse({ relevant: true, reason: 'direct_topic_keyword', redirect: '' });
  }

  const provider = getAiProvider();
  let apiKey = '';
  try {
    apiKey = resolveApiKey(req, provider);
  } catch (error) {
    const aiError = toAiError(error);
    return relevanceResponse({ relevant: false, reason: aiError.code, redirect: '', ...aiErrorBody(aiError) }, aiError.status);
  }

  const recentConversation = Array.isArray(conversation)
    ? conversation
        .slice(-6)
        .map(msg => `${msg?.role === 'user' ? '학생' : '도우미'}: ${String(msg?.content || '').slice(0, 500)}`)
        .join('\n')
        .slice(0, MAX_CONVERSATION_CHARS)
    : '';

  const sourceExcerpt = trimmedSource.slice(0, MAX_SOURCE_CHARS);

  try {
    const parsed = await provider.generateStructured({
      apiKey,
      schema: RELEVANCE_SCHEMA,
      schemaName: 'relevance_result',
      messages: [
        {
          role: 'system',
          content: [
            '너는 초등 사회과 조사학습 AI 코스웨어의 주제 이탈 감지기다.',
            '학생 질문이 현재 조사 주제, 원본 자료, 분석 결과, 발표 준비, 글쓰기, 탐구 확장과 실질적으로 관련 있는지 판정한다.',
            '허용: 조사 주제 직접 질문, 원본 자료 내용, 관련 배경지식, 관련 인물/장소/시대/개념, 발표/글쓰기 도움, 최근 대화의 맥락을 잇는 질문.',
            '차단: K-POP, 연예인, 게임, 만화, 친구 이야기, 잡담, 현재 조사 주제와 연결되지 않는 다른 주제.',
            '애매하지만 학생이 조사 주제와 연결하려는 의도가 보이면 relevant=true로 판정한다.',
            '차단할 때 redirect는 다정하고 짧게, 조사 주제로 돌아오도록 안내한다.',
            `redirect는 반드시 ${targetLanguage}로 작성한다.`,
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `[조사 주제]\n${trimmedTopic}`,
            `[원본 자료 발췌]\n${sourceExcerpt}`,
            `[최근 대화]\n${recentConversation || '없음'}`,
            `[학생 질문]\n${trimmedUserText}`,
            `[출력 언어]\n${targetLanguage}`,
            '위 학생 질문이 현재 조사학습과 관련 있으면 relevant=true, 아니면 false로 판정해라.',
          ].join('\n\n'),
        },
      ],
    });

    // 형식이 어긋난 응답도 학생에게 원문을 보여주지 않고, 정해진 필드만 골라 돌려준다.
    return relevanceResponse({
      relevant: parsed?.relevant === true,
      reason: typeof parsed?.reason === 'string' ? parsed.reason : '',
      redirect: typeof parsed?.redirect === 'string' && parsed.redirect.trim()
        ? parsed.redirect
        : '',
    });
  } catch (error) {
    logAiError('relevance', error);
    const aiError = toAiError(error);

    // 공급자 안전 검사에 걸린 질문은 기존 moderation 차단과 같은 이유 코드로 알린다.
    if (aiError.code === AI_ERROR_CODES.SAFETY_BLOCKED) {
      return relevanceResponse({ relevant: false, reason: 'moderation_flagged', redirect: '' });
    }
    if (PASS_THROUGH_ERROR_CODES.has(aiError.code)) {
      return relevanceResponse({ relevant: false, reason: aiError.code, redirect: '', ...aiErrorBody(aiError) }, aiError.status);
    }
    return relevanceResponse({ relevant: false, reason: 'relevance_check_failed', redirect: '' });
  }
}
