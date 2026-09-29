// 같은 AI 요청이 짧은 시간에 두 번 나가지 않게 막는다. 무료 사용량은 키 소유자의
// Google 프로젝트 단위로 계산되므로, 버튼 연타나 중복 이벤트가 곧 할당량 낭비다.
// 요청 원문은 저장하지 않고 해시만 이 탭의 메모리에 잠깐 둔다.

// 같은 요청이 끝난 뒤에도 이 시간 안에는 다시 보내지 않는다.
export const AI_REQUEST_REPEAT_WINDOW_MS = 3000;

const inFlight = new Set();
const recentlyFinished = new Map();

// FNV-1a 32비트 — 동일 요청 판별용이며 보안 목적의 해시가 아니다.
export function fingerprintAiRequest(payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`;
}

// 요청을 시작해도 되면 끝났을 때 부를 release 함수를, 중복이면 null을 돌려준다.
// allowRepeat은 응답 형식이 빠져 한 번 더 받는 경우처럼 의도된 재요청에만 쓴다.
export function beginAiRequest(fingerprint, { allowRepeat = false, now = Date.now() } = {}) {
  for (const [key, finishedAt] of recentlyFinished) {
    if (now - finishedAt > AI_REQUEST_REPEAT_WINDOW_MS) recentlyFinished.delete(key);
  }
  if (inFlight.has(fingerprint)) return null;
  if (!allowRepeat && recentlyFinished.has(fingerprint)) return null;

  inFlight.add(fingerprint);
  let released = false;
  // 실패한 요청은 기록하지 않는다. 키를 고친 직후처럼 학생이 바로 다시 시도할 수 있어야 한다.
  return ({ succeeded = true } = {}) => {
    if (released) return;
    released = true;
    inFlight.delete(fingerprint);
    if (succeeded) recentlyFinished.set(fingerprint, Date.now());
  };
}

export function resetAiRequestGuard() {
  inFlight.clear();
  recentlyFinished.clear();
}
