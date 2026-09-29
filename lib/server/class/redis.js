import { AI_ERROR_CODES } from '../../aiProviderConfig';
import { AiError } from '../ai/errors';

// Upstash Redis REST 클라이언트. Edge runtime에서 fetch만으로 동작하고 새 의존성을 쓰지 않는다.
// 요청 형식: POST {url} + JSON 배열 ["SET","k","v","EX",100], 응답 {"result":...} | {"error":"..."}.
// Vercel Marketplace 연결은 KV_REST_API_* 이름을, Upstash 콘솔은 UPSTASH_REDIS_REST_* 이름을
// 쓰므로 둘 다 읽는다.

function getConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

export function isClassStoreConfigured() {
  return !!getConfig();
}

async function post(path, body) {
  const config = getConfig();
  if (!config) throw new AiError(AI_ERROR_CODES.CLASS_UNAVAILABLE);

  let res;
  try {
    res = await fetch(`${config.url}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new AiError(AI_ERROR_CODES.CLASS_UNAVAILABLE);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new AiError(AI_ERROR_CODES.CLASS_UNAVAILABLE);
  return data;
}

// 명령 하나를 실행하고 result를 돌려준다.
export async function redisCommand(...args) {
  const data = await post('', args.map(String));
  if (data.error) throw new AiError(AI_ERROR_CODES.CLASS_UNAVAILABLE);
  return data.result;
}

// 여러 명령을 한 번에 실행하고 result 배열을 돌려준다.
export async function redisPipeline(commands) {
  const data = await post('/pipeline', commands.map(cmd => cmd.map(String)));
  if (!Array.isArray(data) || data.some(item => item?.error)) {
    throw new AiError(AI_ERROR_CODES.CLASS_UNAVAILABLE);
  }
  return data.map(item => item.result);
}
