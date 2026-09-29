import { getAiProvider, readTeacherApiKey } from '../../../lib/server/ai/provider';
import { aiErrorResponse, jsonResponse, logAiError } from '../../../lib/server/ai/errors';
import { createClass } from '../../../lib/server/class/classes';
import { assertClassMode, noStoreJson, readJsonBody } from '../../../lib/server/class/routes';

// 교사: 자기 Gemini 키로 오늘 쓸 학급 코드를 만든다. 키를 먼저 확인한 뒤 암호화해 저장한다.
// 관리 토큰은 이 응답에서 한 번만 돌려주고, 교사 기기에만 저장된다.
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405);

  try {
    assertClassMode();
    const { schoolName } = await readJsonBody(req);
    const apiKey = readTeacherApiKey(req);
    await getAiProvider().validateCredential({ apiKey });
    const created = await createClass({ schoolName, apiKey });
    return noStoreJson({ ok: true, ...created });
  } catch (error) {
    logAiError('class-create', error);
    return aiErrorResponse(error);
  }
}
