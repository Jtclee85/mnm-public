const ANONYMOUS_ID_KEY = 'mw_anonymous_id';
const SUBMISSION_STATE_KEY = 'mw_learning_artifact_submissions';
const REQUEST_TIMEOUT_MS = 8000;
const MAX_SAVED_ARTIFACTS = 50;

const endpoint = process.env.NEXT_PUBLIC_ARTIFACT_ENDPOINT || '';
const appIdentifier = process.env.NEXT_PUBLIC_ARTIFACT_APP_ID || 'mnm-web';

// 공유 직후 연속 클릭은 localStorage를 읽기 전에 들어올 수 있으므로 메모리에서도 막는다.
// 원문은 서버나 console로 내보내지 않고 이 탭이 열려 있는 동안 중복 판별에만 쓴다.
const inFlightByContent = new Map();

function cleanText(value, maxLength = 5000) {
  return (value ?? '').toString().trim().slice(0, maxLength);
}

function cleanSection(section = {}) {
  return Object.fromEntries(
    Object.entries(section).map(([key, value]) => [key, cleanText(value)])
  );
}

export function initializeAnonymousId() {
  if (typeof window === 'undefined') return '';

  try {
    const savedId = localStorage.getItem(ANONYMOUS_ID_KEY);
    if (savedId) return savedId;
    if (typeof crypto?.randomUUID !== 'function') return '';

    const anonymousId = crypto.randomUUID();
    localStorage.setItem(ANONYMOUS_ID_KEY, anonymousId);
    return anonymousId;
  } catch {
    return '';
  }
}

// 공유 링크에 포함되는 AI 쉬운설명·원문·대화는 받지 않는다. 실제 학생 입력 구조만
// 명시적으로 골라 payload를 만들면 이후 shareData가 늘어나도 연구 서버로 새 필드가
// 뜻하지 않게 전송되지 않는다.
export function buildLearningArtifactPayload({
  activityMode,
  topic,
  modeInputs = {},
  appVersion = '',
}) {
  return {
    appVersion: cleanText(appVersion, 100),
    activityMode: cleanText(activityMode, 50),
    topic: cleanText(topic, 500),
    sourceTitle: '',
    sourceUrl: '',
    outputType: 'multi_mode_learning_artifact',
    understanding: cleanSection(modeInputs.understanding),
    inquiry: cleanSection(modeInputs.inquiry),
    presentation: cleanSection(modeInputs.presentation),
    writing: cleanSection(modeInputs.writing),
  };
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function hashArtifactContent(serializedContent) {
  const bytes = new TextEncoder().encode(serializedContent);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function readSubmissionState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SUBMISSION_STATE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && parsed.artifacts
      ? parsed
      : { version: 1, artifacts: {} };
  } catch {
    return { version: 1, artifacts: {} };
  }
}

function writeSubmissionState(state) {
  try {
    const entries = Object.entries(state.artifacts || {})
      .sort(([, a], [, b]) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .slice(0, MAX_SAVED_ARTIFACTS);
    localStorage.setItem(SUBMISSION_STATE_KEY, JSON.stringify({ version: 1, artifacts: Object.fromEntries(entries) }));
  } catch {}
}

function isUsableEndpoint(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
}

async function sendArtifact(payload, serializedContent) {
  const anonymousId = initializeAnonymousId();
  if (!anonymousId || typeof crypto?.subtle?.digest !== 'function') return { status: 'unavailable' };

  const contentHash = await hashArtifactContent(serializedContent);
  const state = readSubmissionState();
  const previous = state.artifacts[contentHash];
  if (previous?.sentAt) return { status: 'duplicate', artifactId: previous.artifactId };

  const artifactId = previous?.artifactId || crypto.randomUUID();
  state.artifacts[contentHash] = {
    artifactId,
    sentAt: '',
    updatedAt: new Date().toISOString(),
  };
  writeSubmissionState(state);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      // Apps Script에 불필요한 CORS preflight가 생기지 않도록 JSON 문자열을
      // simple request가 허용하는 text/plain으로 보낸다. 서버에서 JSON.parse한다.
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
        artifactId,
        anonymousId,
        appIdentifier,
      }),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) throw new Error('artifact submission rejected');

    const latestState = readSubmissionState();
    latestState.artifacts[contentHash] = {
      artifactId,
      sentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeSubmissionState(latestState);
    return { status: result.duplicate ? 'duplicate' : 'submitted', artifactId };
  } catch {
    return { status: 'failed', artifactId };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function submitLearningArtifact(payload) {
  if (typeof window === 'undefined' || !isUsableEndpoint(endpoint)) {
    return Promise.resolve({ status: 'disabled' });
  }

  const serializedContent = stableStringify(payload);
  const existingRequest = inFlightByContent.get(serializedContent);
  if (existingRequest) return existingRequest;

  const request = sendArtifact(payload, serializedContent)
    .finally(() => inFlightByContent.delete(serializedContent));
  inFlightByContent.set(serializedContent, request);
  return request;
}
