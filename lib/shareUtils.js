/**
 * URL-safe base64 (RFC 4648) 인코딩
 * 표준 base64의 + → -, / → _ 치환으로 URL 쿼리스트링에서 + 가 공백으로
 * 오해석되는 문제를 방지한다.
 */
export const encodeShareData = (obj) => {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  const binary = Array.from(bytes, b => String.fromCharCode(b)).join('');
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

export const decodeShareData = (str) => {
  try {
    // URL-safe base64 → 표준 base64 복원 후 패딩 추가
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '=='.slice(0, (4 - base64.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch {
    return null;
  }
};
