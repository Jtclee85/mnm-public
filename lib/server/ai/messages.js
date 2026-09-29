// 앱 전체가 쓰는 OpenAI 형식 messages([{ role, content }])를 Gemini 요청 형식으로 바꾼다.
// 프롬프트 생성(lib/systemPrompt.js)과 화면 코드는 공급자와 무관하게 그대로 둔다.

// Gemini는 응답 전체를 ```로 감싸는 경우가 있어, 파서(lib/parseResponse.js)가 기대하는
// 태그 형식을 그대로 내도록 시스템 지시 끝에 한 번 더 못 박는다.
export const GEMINI_OUTPUT_FORMAT_GUARD = [
  '[출력 형식 — 반드시 지킬 것]',
  '- 응답 전체를 ``` 코드 블록으로 감싸지 마라.',
  '- 위에서 요청한 XML 태그 이름과 순서, 고정 라벨을 바꾸지 말고 그대로 출력하라.',
  '- 태그 밖에 인사말이나 설명을 덧붙이지 마라.',
].join('\n');

const toGeminiRole = (role) => (role === 'assistant' ? 'model' : 'user');

export function toGeminiContents(messages, { formatGuard = false } = {}) {
  const systemTexts = messages
    .filter(m => m.role === 'system' && m.content.trim())
    .map(m => m.content);
  if (formatGuard) systemTexts.push(GEMINI_OUTPUT_FORMAT_GUARD);

  const contents = [];
  for (const message of messages) {
    if (message.role === 'system') continue;
    const text = message.content;
    // 스트리밍 자리표시자처럼 비어 있는 말풍선은 보내지 않는다.
    if (!text.trim()) continue;
    const role = toGeminiRole(message.role);
    const last = contents[contents.length - 1];
    // 같은 역할이 연달아 오면 한 턴으로 합쳐 user/model 교대 순서를 지킨다.
    if (last && last.role === role) {
      last.parts.push({ text });
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }

  // 대화는 학생(user) 차례로 시작해야 한다. 화면의 첫 안내 말풍선처럼 앞에 붙은
  // 도우미 말은 학습 맥락이 아니므로 뺀다.
  while (contents.length > 0 && contents[0].role === 'model') contents.shift();

  const request = { contents };
  if (systemTexts.length > 0) {
    request.systemInstruction = { parts: [{ text: systemTexts.join('\n\n') }] };
  }
  return request;
}

// 앱에서 쓰는 JSON Schema(소문자 type, additionalProperties)를 Gemini responseSchema
// (OpenAPI 부분집합, 대문자 type)로 바꾼다.
export function toGeminiSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const converted = {};
  if (schema.type) converted.type = String(schema.type).toUpperCase();
  if (schema.description) converted.description = schema.description;
  if (Array.isArray(schema.enum)) converted.enum = schema.enum;
  if (schema.properties) {
    converted.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [key, toGeminiSchema(value)])
    );
    converted.propertyOrdering = Object.keys(schema.properties);
  }
  if (Array.isArray(schema.required)) converted.required = schema.required;
  if (schema.items) converted.items = toGeminiSchema(schema.items);
  return converted;
}

// data:image/png;base64,.... → Gemini inlineData 파트
export function dataUrlToInlinePart(dataUrl) {
  const match = /^data:(image\/[a-z]+);base64,(.+)$/is.exec(dataUrl || '');
  if (!match) return null;
  const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  return { inlineData: { mimeType, data: match[2] } };
}
