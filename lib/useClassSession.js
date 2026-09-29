import { useCallback, useEffect, useState } from 'react';
import { CLASS_CODE_HEADER } from './aiProviderConfig';

// 학생이 들어온 학급(코드·학교 이름·만료 시각)을 브라우저에 기억한다.
// 학급 코드는 교사 키가 아니고 그날 한국 시간 자정에 만료되므로, 같은 날 탭을 새로 열어도
// 다시 입력하지 않게 localStorage에 둔다. 교사 키는 학생 브라우저에 전달되지 않는다.
export const CLASS_SESSION_STORAGE_KEY = 'mnmClassSession';

function readStoredSession(now = Date.now()) {
  try {
    const parsed = JSON.parse(localStorage.getItem(CLASS_SESSION_STORAGE_KEY) || 'null');
    if (parsed?.code && Number(parsed.expiresAt) > now) return parsed;
    localStorage.removeItem(CLASS_SESSION_STORAGE_KEY);
  } catch {}
  return null;
}

export function useClassSession() {
  const [session, setSession] = useState(null);
  // SSR 결과와 첫 렌더를 맞추기 위해 저장소는 마운트 뒤에 읽는다. 읽기 전에는
  // '학급 없음'으로 단정하지 않아야 학급 코드 창이 잠깐 번쩍이지 않는다.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSession(readStoredSession());
    setLoaded(true);
  }, []);

  // 만료 시각(자정)이 지나면 학급에서 자동으로 나간다.
  useEffect(() => {
    if (!session) return undefined;
    const remaining = Number(session.expiresAt) - Date.now();
    const id = setTimeout(() => {
      try { localStorage.removeItem(CLASS_SESSION_STORAGE_KEY); } catch {}
      setSession(null);
    }, Math.max(0, Math.min(remaining, 2 ** 31 - 1)));
    return () => clearTimeout(id);
  }, [session]);

  // 서버에 코드를 확인한 뒤에만 저장한다. 결과: { ok: true } 또는 { ok: false, code, error }
  const joinClass = useCallback(async (rawCode) => {
    const code = (rawCode || '').trim();
    let data = {};
    let ok = false;
    try {
      const res = await fetch('/api/class/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      data = await res.json().catch(() => ({}));
      ok = res.ok && data.ok === true;
    } catch {
      return { ok: false, code: 'network' };
    }
    if (!ok) return { ok: false, code: data.code || 'class_code_invalid', error: data.error || '' };

    const next = { code: data.code, school: data.school, expiresAt: data.expiresAt };
    try { localStorage.setItem(CLASS_SESSION_STORAGE_KEY, JSON.stringify(next)); } catch {}
    setSession(next);
    return { ok: true };
  }, []);

  const leaveClass = useCallback(() => {
    try { localStorage.removeItem(CLASS_SESSION_STORAGE_KEY); } catch {}
    setSession(null);
  }, []);

  // AI 요청에 붙일 헤더. 한글 학교 이름이 들어가므로 헤더 규칙(ISO-8859-1)에 맞게 인코딩한다.
  const buildClassHeaders = useCallback(
    (headers = {}) => (session?.code
      ? { ...headers, [CLASS_CODE_HEADER]: encodeURIComponent(session.code) }
      : { ...headers }),
    [session]
  );

  return { session, hasClass: !!session, loaded, joinClass, leaveClass, buildClassHeaders };
}
