import { useCallback, useEffect, useState } from 'react';
import { AI_KEY_HEADER } from './aiProviderConfig';

// 학생·교사가 넣은 Gemini API 키를 브라우저에만 보관한다.
// - 기본: sessionStorage(탭을 닫으면 사라짐)
// - '이 기기에 저장'을 고른 경우에만 localStorage
// 키는 이 hook의 state와 위 저장소 한 곳에만 둔다. URL·쿠키·콘솔·산출물 전송에는 넣지 않는다.
export const AI_KEY_STORAGE_KEY = 'mnmGeminiApiKey';

function readStoredKey() {
  try {
    const local = localStorage.getItem(AI_KEY_STORAGE_KEY);
    if (local) return { key: local, remember: true };
  } catch {}
  try {
    const session = sessionStorage.getItem(AI_KEY_STORAGE_KEY);
    if (session) return { key: session, remember: false };
  } catch {}
  return { key: '', remember: false };
}

function removeStoredKey() {
  try { localStorage.removeItem(AI_KEY_STORAGE_KEY); } catch {}
  try { sessionStorage.removeItem(AI_KEY_STORAGE_KEY); } catch {}
}

export function useAiKey() {
  const [apiKey, setApiKey] = useState('');
  const [remember, setRemember] = useState(false);
  // SSR 결과와 첫 렌더를 맞추기 위해 저장소는 마운트 뒤에 읽는다. 읽기 전에는
  // '키 없음'으로 단정하지 않아야 키 설정 창이 잠깐 번쩍이지 않는다.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = readStoredKey();
    setApiKey(stored.key);
    setRemember(stored.remember);
    setLoaded(true);
  }, []);

  const saveKey = useCallback((rawKey, { remember: rememberOnDevice = false } = {}) => {
    const trimmed = (rawKey || '').trim();
    if (!trimmed) return false;
    removeStoredKey();
    try {
      if (rememberOnDevice) localStorage.setItem(AI_KEY_STORAGE_KEY, trimmed);
      else sessionStorage.setItem(AI_KEY_STORAGE_KEY, trimmed);
    } catch {
      // 저장소를 쓸 수 없는 브라우저(개인정보 보호 모드 등)에서는 이 화면을 여는 동안만 쓴다.
    }
    setApiKey(trimmed);
    setRemember(rememberOnDevice);
    return true;
  }, []);

  const clearKey = useCallback(() => {
    removeStoredKey();
    setApiKey('');
    setRemember(false);
  }, []);

  // AI 요청에 붙일 헤더. 키가 없으면 헤더를 만들지 않는다.
  const buildAiHeaders = useCallback(
    (headers = {}) => (apiKey ? { ...headers, [AI_KEY_HEADER]: apiKey } : { ...headers }),
    [apiKey]
  );

  return { apiKey, hasKey: !!apiKey, remember, loaded, saveKey, clearKey, buildAiHeaders };
}

// 화면에 키를 다시 보여줄 때는 끝 4자리만 남긴다.
export function maskAiKey(key) {
  if (!key) return '';
  return `••••••••${key.slice(-4)}`;
}
