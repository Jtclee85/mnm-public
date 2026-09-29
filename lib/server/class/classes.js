import { AI_ERROR_CODES } from '../../aiProviderConfig';
import { AiError } from '../ai/errors';
import { redisCommand, redisPipeline } from './redis';
import { encryptSecret, decryptSecret, randomToken, sha256Base64Url } from './crypto';

// 학급 코드: "학교이름-숫자4자리" (예: 해원초-4821). 교사가 만든 날 한국 시간 자정에 만료된다.
// 저장소에는 교사 키를 암호화한 값과 관리 토큰의 해시만 둔다. 관리 토큰 원문은 교사 기기에만 있다.

export const CLASS_CODE_DIGITS = 4;
const SCHOOL_NAME_MAX_LENGTH = 20;
const CREATE_ATTEMPTS = 20;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// 숫자 4자리는 경우의 수가 1만 개뿐이다. 잘못된 코드를 계속 넣어 남의 학급을 맞히지 못하도록
// 접속자별로 10분에 10번까지만 틀릴 수 있게 한다. 한 교실이 같은 공인 IP를 쓰는 환경에서
// 너무 빡빡하면 CLASS_FAILURE_LIMIT 환경변수로 조정한다(E2E 서버도 이 값으로 크게 둔다).
export const DEFAULT_CLASS_FAILURE_LIMIT = 10;
export const CLASS_FAILURE_WINDOW_SECONDS = 600;

export function getClassFailureLimit() {
  const configured = Number.parseInt(process.env.CLASS_FAILURE_LIMIT || '', 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_CLASS_FAILURE_LIMIT;
}

const classKey = (code) => `mnm:class:${code}`;
const failureKey = (clientId) => `mnm:class-fail:${clientId}`;

// 학교 이름은 한글·영문·숫자만 남긴다. 띄어쓰기와 기호는 학생이 입력할 때 헷갈리므로 뺀다.
export function normalizeSchoolName(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[^\p{Script=Hangul}A-Za-z0-9]/gu, '')
    .slice(0, SCHOOL_NAME_MAX_LENGTH);
}

// 학생이 입력한 코드를 저장소 키 형식으로 맞춘다. 띄어쓰기는 지우고, 여러 종류의 줄표는
// '-' 하나로 통일한다. 형식이 맞지 않으면 빈 문자열을 돌려준다.
export function normalizeClassCode(value) {
  const compact = String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[‐‑‒–—―－ー]/g, '-');
  const match = /^(.+)-(\d{4})$/u.exec(compact);
  if (!match) return '';
  const school = normalizeSchoolName(match[1]);
  if (!school || school !== match[1]) return '';
  return `${school}-${match[2]}`;
}

// 다음 한국 시간 자정(UTC ms). 한국은 일광절약시간이 없어 +9시간으로 계산한다.
export function nextKstMidnight(now = Date.now()) {
  return Math.floor((now + KST_OFFSET_MS) / DAY_MS) * DAY_MS + DAY_MS - KST_OFFSET_MS;
}

function secondsUntil(expiresAt, now) {
  return Math.max(60, Math.ceil((expiresAt - now) / 1000));
}

function randomDigits() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 10 ** CLASS_CODE_DIGITS;
  return String(value).padStart(CLASS_CODE_DIGITS, '0');
}

function parseRecord(raw) {
  if (typeof raw !== 'string') return null;
  try {
    const record = JSON.parse(raw);
    return record && record.v === 1 && record.encKey ? record : null;
  } catch {
    return null;
  }
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// 요청한 사람을 구분하는 값. 저장소에 IP 원문을 남기지 않도록 해시로 바꾼다.
export async function getClientId(req) {
  const forwarded = req.headers.get('x-forwarded-for') || '';
  const ip = req.headers.get('x-real-ip') || forwarded.split(',')[0].trim() || 'unknown';
  return (await sha256Base64Url(`mnm-client:${ip}`)).slice(0, 22);
}

async function recordFailure(clientId) {
  const key = failureKey(clientId);
  const count = await redisCommand('INCR', key);
  if (Number(count) === 1) await redisCommand('EXPIRE', key, CLASS_FAILURE_WINDOW_SECONDS);
}

// ── 교사: 학급 만들기 ─────────────────────────────────────

export async function createClass({ schoolName, apiKey, now = Date.now() }) {
  const school = normalizeSchoolName(schoolName);
  if (!school) throw new AiError(AI_ERROR_CODES.INVALID_REQUEST);

  const manageToken = randomToken();
  const manageHash = await sha256Base64Url(manageToken);
  const expiresAt = nextKstMidnight(now);
  const ttl = secondsUntil(expiresAt, now);

  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
    const code = `${school}-${randomDigits()}`;
    const record = {
      v: 1,
      school,
      encKey: await encryptSecret(apiKey, code),
      manageHash,
      createdAt: now,
      expiresAt,
    };
    // NX: 같은 날 같은 학교에 이미 있는 코드는 덮어쓰지 않고 다른 숫자로 다시 뽑는다.
    const result = await redisCommand('SET', classKey(code), JSON.stringify(record), 'NX', 'EX', ttl);
    if (result === 'OK') return { code, school, manageToken, expiresAt };
  }
  throw new AiError(AI_ERROR_CODES.CLASS_UNAVAILABLE);
}

// ── 학생: 코드 확인과 AI 요청용 키 조회 ─────────────────────

async function loadClassForStudent(rawCode, clientId, now) {
  const code = normalizeClassCode(rawCode);
  const [failures, raw] = await redisPipeline([
    ['GET', failureKey(clientId)],
    ['GET', classKey(code || 'invalid')],
  ]);
  if (Number(failures) >= getClassFailureLimit()) throw new AiError(AI_ERROR_CODES.TOO_MANY_ATTEMPTS);

  const record = code ? parseRecord(raw) : null;
  if (!record || record.expiresAt <= now) {
    await recordFailure(clientId);
    throw new AiError(AI_ERROR_CODES.CLASS_CODE_INVALID);
  }
  return { code, record };
}

export async function joinClass({ code: rawCode, clientId, now = Date.now() }) {
  const { code, record } = await loadClassForStudent(rawCode, clientId, now);
  return { code, school: record.school, expiresAt: record.expiresAt };
}

// AI 요청 처리 중에만 교사 키를 복호화해 돌려준다. 호출한 쪽은 지역 변수로만 쓴다.
export async function resolveClassApiKey({ code: rawCode, clientId, now = Date.now() }) {
  if (!String(rawCode || '').trim()) throw new AiError(AI_ERROR_CODES.CLASS_CODE_REQUIRED);
  const { code, record } = await loadClassForStudent(rawCode, clientId, now);
  return decryptSecret(record.encKey, code);
}

// ── 교사: 이 기기에서 관리 ─────────────────────────────────

async function loadClassForManager(rawCode, manageToken, now) {
  const code = normalizeClassCode(rawCode);
  const record = code ? parseRecord(await redisCommand('GET', classKey(code))) : null;
  if (!record || record.expiresAt <= now) throw new AiError(AI_ERROR_CODES.CLASS_CODE_INVALID);
  const tokenHash = await sha256Base64Url(String(manageToken || ''));
  if (!manageToken || !safeEqual(tokenHash, record.manageHash)) throw new AiError(AI_ERROR_CODES.FORBIDDEN);
  return { code, record };
}

export async function updateClassKey({ code: rawCode, manageToken, apiKey, now = Date.now() }) {
  const { code, record } = await loadClassForManager(rawCode, manageToken, now);
  const updated = { ...record, encKey: await encryptSecret(apiKey, code) };
  await redisCommand('SET', classKey(code), JSON.stringify(updated), 'XX', 'EX', secondsUntil(record.expiresAt, now));
  return { code, school: record.school, expiresAt: record.expiresAt };
}

export async function deleteClass({ code: rawCode, manageToken, now = Date.now() }) {
  const { code } = await loadClassForManager(rawCode, manageToken, now);
  await redisCommand('DEL', classKey(code));
  return { code };
}
