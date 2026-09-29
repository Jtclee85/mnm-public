import { aiErrorResponse, jsonResponse, logAiError } from '../../../lib/server/ai/errors';
import { getClientId, joinClass } from '../../../lib/server/class/classes';
import { assertClassMode, noStoreJson, readJsonBody } from '../../../lib/server/class/routes';

// 학생: 선생님께 받은 학급 코드를 확인한다. 응답에는 학교 이름과 만료 시각만 있고 키는 없다.
// 틀린 코드는 접속자별 시도 횟수에 기록된다.
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method Not Allowed' }, 405);

  try {
    assertClassMode();
    const { code } = await readJsonBody(req);
    const joined = await joinClass({ code, clientId: await getClientId(req) });
    return noStoreJson({ ok: true, ...joined });
  } catch (error) {
    logAiError('class-join', error);
    return aiErrorResponse(error);
  }
}
