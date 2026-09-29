import { getAiProvider, readTeacherApiKey } from '../../../lib/server/ai/provider';
import { aiErrorResponse, jsonResponse, logAiError } from '../../../lib/server/ai/errors';
import { updateClassKey } from '../../../lib/server/class/classes';
import { assertClassMode, noStoreJson, readJsonBody, readManageToken } from '../../../lib/server/class/routes';

// 교사(학급을 만든 기기): 학급 코드는 그대로 두고 Gemini 키만 바꾼다.
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405);

  try {
    assertClassMode();
    const { code } = await readJsonBody(req);
    const apiKey = readTeacherApiKey(req);
    await getAiProvider().validateCredential({ apiKey });
    const updated = await updateClassKey({ code, manageToken: readManageToken(req), apiKey });
    return noStoreJson({ ok: true, ...updated });
  } catch (error) {
    logAiError('class-update', error);
    return aiErrorResponse(error);
  }
}
