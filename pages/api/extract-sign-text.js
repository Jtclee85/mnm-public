import { getAiProvider, resolveApiKey } from '../../lib/server/ai/provider';
import { aiErrorBody, logAiError, toAiError } from '../../lib/server/ai/errors';
import { ALLOWED_IMAGE_DATA_URL, MAX_IMAGE_BASE64_LENGTH } from '../../lib/server/ai/safety';
import { AI_ERROR_CODES } from '../../lib/aiProviderConfig';

export const config = {
  runtime: 'edge',
};

// 파일 형식·용량 제한은 lib/server/ai/safety.js에서 관리한다(형식: jpg·png·webp, base64 약 11MB).
// 클라이언트는 1280px로 미리 압축해서 보내므로 보통 이보다 훨씬 작다.

const SIGN_TEXT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    text: { type: 'string' },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['text', 'warnings'],
};

// 사용자가 이해할 수 있는 안내가 필요한 오류만 code 그대로 전달하고,
// 나머지는 기존처럼 "글자를 읽지 못했다" 안내로 통일한다.
const PASS_THROUGH_ERROR_CODES = new Set([
  AI_ERROR_CODES.MISSING_KEY,
  AI_ERROR_CODES.INVALID_KEY,
  AI_ERROR_CODES.QUOTA_EXCEEDED,
  AI_ERROR_CODES.RATE_LIMITED,
  AI_ERROR_CODES.CLASS_CODE_REQUIRED,
  AI_ERROR_CODES.CLASS_CODE_INVALID,
  AI_ERROR_CODES.CLASS_UNAVAILABLE,
  AI_ERROR_CODES.TOO_MANY_ATTEMPTS,
  AI_ERROR_CODES.SAFETY_BLOCKED,
  AI_ERROR_CODES.UNAVAILABLE,
  AI_ERROR_CODES.NETWORK,
]);

const jsonHeaders = { 'Content-Type': 'application/json' };

const SYSTEM_PROMPT = `이 이미지는 박물관 안내판 또는 전시해설 사진이다.
사진 속 글자를 가능한 한 원문 그대로 추출하라. 내용을 요약하거나 쉬운 말로 바꾸지 마라.
잘 보이지 않거나 확실하지 않은 부분은 추측해서 지어내지 말고 [판독 불가]로 표시하라.
제목, 소제목, 본문, 번호, 줄바꿈 구조를 최대한 유지하라.
전시물 이름, 시대, 설명문을 구분할 수 있으면 그 구조를 살려서 추출하라.
사진에 안내판/전시해설 글자가 전혀 보이지 않으면 text를 빈 문자열로 두고 warnings에 그 이유를 한국어로 짧게 적어라.
사진이 흐리거나 일부 문장이 확실하지 않으면 warnings 배열에 한국어로 짧게 메모하라. 문제가 없으면 빈 배열로 두어라.
text와 warnings 이외의 다른 내용은 절대 출력하지 마라.`;

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: jsonHeaders });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청입니다.' }), { status: 400, headers: jsonHeaders });
  }

  const image = typeof body?.image === 'string' ? body.image : '';

  if (!image || !ALLOWED_IMAGE_DATA_URL.test(image)) {
    return new Response(
      JSON.stringify({ error: 'jpg, png, webp 형식의 사진만 올릴 수 있어요.' }),
      { status: 400, headers: jsonHeaders }
    );
  }

  if (image.length > MAX_IMAGE_BASE64_LENGTH) {
    return new Response(
      JSON.stringify({ error: '사진 용량이 너무 커요. 더 작은 사진으로 다시 시도해 주세요.' }),
      { status: 400, headers: jsonHeaders }
    );
  }

  // 이미지(개인정보 포함 가능성이 있는 원본 데이터)와 키는 어떤 경우에도 로그에 남기지 않는다.
  try {
    const provider = getAiProvider();
    const apiKey = await resolveApiKey(req, provider);
    const parsed = await provider.analyzeImage({
      apiKey,
      image,
      systemPrompt: SYSTEM_PROMPT,
      prompt: '이 사진 속 안내판 또는 전시해설 글자를 원문 그대로 추출해줘.',
      schema: SIGN_TEXT_SCHEMA,
      schemaName: 'sign_text_result',
    });

    const text = typeof parsed?.text === 'string' ? parsed.text.trim() : '';
    const warnings = Array.isArray(parsed?.warnings) ? parsed.warnings.filter(w => typeof w === 'string' && w.trim()) : [];

    if (!text) {
      return new Response(
        JSON.stringify({
          error: '사진에서 글자를 읽지 못했습니다. 더 밝고 정면에 가까운 사진으로 다시 시도해 주세요.',
          warnings,
        }),
        { status: 200, headers: jsonHeaders }
      );
    }

    return new Response(JSON.stringify({ text, warnings }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    // 분류된 code만 기록하고, 요청 본문(이미지 데이터)은 절대 로그에 남기지 않는다.
    logAiError('extract-sign-text', error);
    const aiError = toAiError(error);

    if (PASS_THROUGH_ERROR_CODES.has(aiError.code)) {
      return new Response(JSON.stringify(aiErrorBody(aiError)), { status: aiError.status, headers: jsonHeaders });
    }

    return new Response(
      JSON.stringify({ error: '사진에서 글자를 읽지 못했습니다. 더 밝고 정면에 가까운 사진으로 다시 시도해 주세요.' }),
      { status: 500, headers: jsonHeaders }
    );
  }
}
