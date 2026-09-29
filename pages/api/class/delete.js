import { aiErrorResponse, jsonResponse, logAiError } from '../../../lib/server/ai/errors';
import { deleteClass } from '../../../lib/server/class/classes';
import { assertClassMode, noStoreJson, readJsonBody, readManageToken } from '../../../lib/server/class/routes';

// 교사(학급을 만든 기기): 학급과 암호화된 키를 저장소에서 바로 지운다.
// 이후 이 코드로 들어온 학생 요청은 모두 거절된다.
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405);

  try {
    assertClassMode();
    const { code } = await readJsonBody(req);
    const deleted = await deleteClass({ code, manageToken: readManageToken(req) });
    return noStoreJson({ ok: true, ...deleted });
  } catch (error) {
    logAiError('class-delete', error);
    return aiErrorResponse(error);
  }
}
