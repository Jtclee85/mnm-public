import { useCallback, useEffect, useState } from 'react';
import { AI_KEY_HEADER, AI_SELECTION_HEADER, CLASS_MANAGE_HEADER } from './aiProviderConfig';

// 교사가 이 기기에서 만든 학급 목록. 관리 토큰(키 교체·재발급·삭제 권한)은 이 기기의
// localStorage에만 있고 서버에는 해시만 있다. 만료(한국 시간 자정)된 학급은 목록에서 뺀다.
export const TEACHER_CLASSES_STORAGE_KEY = 'mnmTeacherClasses';

function readStoredClasses(now = Date.now()) {
  try {
    const parsed = JSON.parse(localStorage.getItem(TEACHER_CLASSES_STORAGE_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter(item => item?.code && item?.manageToken && Number(item.expiresAt) > now)
      : [];
  } catch {
    return [];
  }
}

function writeStoredClasses(classes) {
  try { localStorage.setItem(TEACHER_CLASSES_STORAGE_KEY, JSON.stringify(classes)); } catch {}
}

async function postJson(url, body, headers) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.ok === true ? { ok: true, data } : { ok: false, code: data.code || 'unavailable' };
  } catch {
    return { ok: false, code: 'network' };
  }
}

export function useTeacherClasses() {
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    const stored = readStoredClasses();
    writeStoredClasses(stored);
    setClasses(stored);
  }, []);

  const save = useCallback((updater) => {
    setClasses(prev => {
      const next = updater(prev);
      writeStoredClasses(next);
      return next;
    });
  }, []);

  const createClass = useCallback(async ({ schoolName, apiKey, provider = 'gemini' }) => {
    const result = await postJson('/api/class/create', { schoolName }, { [AI_KEY_HEADER]: apiKey, [AI_SELECTION_HEADER]: provider });
    if (!result.ok) return result;
    const { code, school, manageToken, expiresAt, provider: savedProvider } = result.data;
    save(prev => [{ code, school, manageToken, expiresAt, provider: savedProvider }, ...prev.filter(item => item.code !== code)]);
    return { ok: true, code };
  }, [save]);

  const rotateKey = useCallback(async ({ item, apiKey, provider = 'gemini' }) => {
    const result = await postJson('/api/class/update', { code: item.code }, {
      [AI_KEY_HEADER]: apiKey, [AI_SELECTION_HEADER]: provider, [CLASS_MANAGE_HEADER]: item.manageToken,
    });
    if (result.ok) save(prev => prev.map(entry => entry.code === item.code ? { ...entry, provider } : entry));
    return result;
  }, [save]);

  const removeClass = useCallback(async ({ item }) => {
    const result = await postJson('/api/class/delete', { code: item.code }, { [CLASS_MANAGE_HEADER]: item.manageToken });
    // 서버에서 이미 만료·삭제된 학급이면 이 기기 목록에서도 지운다.
    if (result.ok || result.code === 'class_code_invalid') {
      save(prev => prev.filter(entry => entry.code !== item.code));
    }
    return result;
  }, [save]);

  // 새 코드를 먼저 만든 뒤 이전 코드를 지운다. 새 코드 발급이 실패하면 이전 코드를 그대로 둔다.
  const reissueClass = useCallback(async ({ item, apiKey, provider = 'gemini' }) => {
    const created = await createClass({ schoolName: item.school, apiKey, provider });
    if (!created.ok) return created;
    await removeClass({ item });
    return created;
  }, [createClass, removeClass]);

  return { classes, createClass, rotateKey, removeClass, reissueClass };
}
