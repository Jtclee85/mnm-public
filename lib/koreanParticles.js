/**
 * 한글 음절의 마지막 글자가 받침으로 끝나는지 판별한다.
 * 한글이 아니거나 빈 문자열이면 받침 없음(false)으로 취급한다.
 */
export function hasFinalConsonant(text = '') {
  const trimmed = String(text).trim();
  if (!trimmed) return false;

  // 끝에 붙은 공백/문장부호를 제거하고 마지막 의미 있는 글자를 찾는다.
  const cleaned = trimmed.replace(/[\s.,!?~…'"“”‘’()[\]{}<>:;]+$/g, '');
  if (!cleaned) return false;

  const code = cleaned.charCodeAt(cleaned.length - 1);

  // 한글 완성형 범위: 가(0xAC00) ~ 힣(0xD7A3). 한글이 아니면 받침 없음으로 취급한다.
  if (code < 0xac00 || code > 0xd7a3) return false;

  return (code - 0xac00) % 28 !== 0;
}

/** 받침 유무에 따라 주격 조사 '이' 또는 '가'를 붙인 문자열을 돌려준다. */
export function withSubjectParticle(text = '') {
  const trimmed = String(text).trim();
  if (!trimmed) return '';
  return `${trimmed}${hasFinalConsonant(trimmed) ? '이' : '가'}`;
}
