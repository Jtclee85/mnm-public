// 조사 주제를 직접 묻는 질문이 모델의 확률적 관련성 판정에서 잘못 차단되지 않도록
// 서버가 먼저 확인하는 보수적인 빠른 판정 규칙이다. 명백한 주제 이탈 신호가 있거나
// 핵심어가 모호하면 자동 허용하지 않고 기존 AI 판정으로 넘긴다.

const GENERIC_TOPIC_TOKENS = new Set([
  '강화', '조사', '연구', '자료', '설명', '이야기', '역사', '문화', '사회', '과학',
  '시대', '지역', '사람', '방법', '이유', '의미', '특징', '준비', '발표', '글쓰기',
]);

const CLEAR_DETOUR_PATTERN = /(?:k[\s-]?pop|케이[\s-]?팝|아이돌|걸그룹|보이그룹|연예인|가수|배우|유튜버|게임|만화|애니(?:메이션)?|틱톡|celebrity|idol|girl\s*group|boy\s*group|game|anime|cartoon)/iu;
const PARTICLE_SUFFIX_PATTERN = /(?:에서|으로|에게|부터|까지|처럼|보다|은|는|이|가|을|를|과|와|의|에|로)$/u;

function normalizeText(text) {
  return String(text || '').normalize('NFKC').toLowerCase();
}

function compactText(text) {
  return normalizeText(text).replace(/[^\p{L}\p{N}]+/gu, '');
}

function getDistinctTopicTokens(topic) {
  return normalizeText(topic)
    .split(/[\s,./·:;!?()[\]{}'"“”‘’]+/u)
    .map(token => token.replace(PARTICLE_SUFFIX_PATTERN, '').trim())
    .filter(token => token.length >= 2 && !GENERIC_TOPIC_TOKENS.has(token));
}

export function isDirectTopicQuestion(topic, userText) {
  const normalizedTopic = compactText(topic);
  const normalizedQuestion = compactText(userText);

  if (!normalizedTopic || !normalizedQuestion || CLEAR_DETOUR_PATTERN.test(normalizeText(userText))) {
    return false;
  }

  if (normalizedQuestion.includes(normalizedTopic)) return true;

  return getDistinctTopicTokens(topic)
    .some(token => normalizedQuestion.includes(compactText(token)));
}
