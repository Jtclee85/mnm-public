// 3차 구조 개편 — 별도 '생각 워크시트' 대신 각 모드(이해/탐구/발표준비/글쓰기준비)
// 안에서 직접 입력하는 워크시트 필드 정의 + 기존 워크시트 데이터 마이그레이션.
//
// 저장은 기존 useStudentNotes 훅의 평평한(flat) key-value 구조를 그대로 재사용한다
// (조사 주제별 localStorage 저장/디바운스 자동저장/새로고침 유지 로직 변경 없음).
// 새 필드는 `u_`(이해), `inq_`(탐구), `pres_`(발표준비), `write_`(글쓰기준비) 접두어로
// 네임스페이스를 나눠서 기존 `ws_`(옛 생각 워크시트) 키와 절대 충돌하지 않게 한다.

export const FALLBACK_CHECK_QUESTIONS = [
  '이 자료는 무엇에 대한 설명인가요?',
  '가장 중요한 낱말 2개를 골라 써 보세요.',
  '새롭게 알게 된 점은 무엇인가요?',
  '친구에게 설명한다면 어떤 말로 시작하고 싶나요?',
];

export const PRESENTATION_FIELDS = [
  { key: 'pres_coreMessage',       labelKey: 'presentationCoreMessageLabel',       placeholderKey: 'presentationCoreMessagePlaceholder' },
  { key: 'pres_point1',            labelKey: 'presentationPointLabel',             placeholderKey: 'presentationPoint1Placeholder', numbered: 1 },
  { key: 'pres_point2',            labelKey: 'presentationPointLabel',             placeholderKey: 'presentationPoint2Placeholder', numbered: 2 },
  { key: 'pres_point3',            labelKey: 'presentationPointLabel',             placeholderKey: 'presentationPoint3Placeholder', numbered: 3 },
  { key: 'pres_expectedQuestion',  labelKey: 'presentationExpectedQuestionLabel',  placeholderKey: 'presentationExpectedQuestionPlaceholder' },
  { key: 'pres_preparedAnswer',    labelKey: 'presentationPreparedAnswerLabel',    placeholderKey: 'presentationPreparedAnswerPlaceholder' },
  { key: 'pres_openingSentence',   labelKey: 'presentationOpeningLabel',           placeholderKey: 'presentationOpeningPlaceholder' },
  { key: 'pres_closingSentence',   labelKey: 'presentationClosingLabel',           placeholderKey: 'presentationClosingPlaceholder' },
];

export const WRITING_FIELDS = [
  { key: 'write_topicSentence',   labelKey: 'writingTopicSentenceLabel',   placeholderKey: 'writingTopicSentencePlaceholder' },
  { key: 'write_support1',        labelKey: 'writingSupportLabel',         placeholderKey: 'writingSupport1Placeholder', numbered: 1 },
  { key: 'write_support2',        labelKey: 'writingSupportLabel',         placeholderKey: 'writingSupport2Placeholder', numbered: 2 },
  { key: 'write_support3',        labelKey: 'writingSupportLabel',         placeholderKey: 'writingSupport3Placeholder', numbered: 3 },
  { key: 'write_evidence',        labelKey: 'writingEvidenceInputLabel',   placeholderKey: 'writingEvidenceInputPlaceholder' },
  { key: 'write_closingThought',  labelKey: 'writingClosingThoughtLabel',  placeholderKey: 'writingClosingThoughtPlaceholder' },
  { key: 'write_openingSentence', labelKey: 'writingOpeningLabel',         placeholderKey: 'writingOpeningPlaceholder' },
  { key: 'write_closingSentence', labelKey: 'writingClosingLabel',         placeholderKey: 'writingClosingPlaceholder' },
];

// 옛 별도 '생각 워크시트'(ThinkingWorksheetDrawer) 필드 → 새 모드별 필드.
// 의미가 분명히 대응되는 항목만 옮기고, 애매한 항목(자료에서 증거 찾기 활동 등)은
// 그대로 옛 키에 남겨 둔다 — 데이터를 지우지 않고, 새 스키마를 억지로 채우지 않기 위함.
export const LEGACY_TO_MODE_FIELD_MIGRATIONS = [
  // 기초 이해 → 이해모드 자기 확인 질문 (같은 순서의 4문항으로 대응)
  ['ws_basic_subject',  'u_check1'],
  ['ws_basic_keyword',  'u_check2'],
  ['ws_basic_learned',  'u_check3'],
  ['ws_basic_confused', 'u_check4'],

  // 생각 넓히기 → 탐구모드 (선택한 질문 / 처음 생각 / 생각이 바뀐 점만 명확히 대응)
  ['ws_deep_question', 'inq_selectedQuestion'],
  ['ws_deep_first',    'inq_firstThought'],
  ['ws_deep_changed',  'inq_changedOrFurtherQuestion'],

  // 발표 준비 → 발표준비모드
  ['ws_pres_core', 'pres_coreMessage'],
  ['ws_pres_p1',   'pres_point1'],
  ['ws_pres_p2',   'pres_point2'],
  ['ws_pres_p3',   'pres_point3'],
  ['ws_pres_q',    'pres_expectedQuestion'],
  ['ws_pres_a',    'pres_preparedAnswer'],

  // 글쓰기 개요 → 글쓰기준비모드
  ['ws_write_topic',    'write_topicSentence'],
  ['ws_write_s1',       'write_support1'],
  ['ws_write_s2',       'write_support2'],
  ['ws_write_s3',       'write_support3'],
  ['ws_write_evidence', 'write_evidence'],
  ['ws_write_closing',  'write_closingThought'],
];

// '자료에서 증거 찾기' 활동은 4개 새 모드 중 어느 하나로 깔끔하게 대응되지 않으므로
// 억지로 옮기지 않는다. 대신 4차(공유 페이지) 작업에서 쓸 수 있도록 원래 키를 그대로
// 보존하면서, legacyEvidence라는 이름으로도 조회할 수 있게 셀렉터만 제공한다.
export function getLegacyEvidenceFields(notes) {
  if (!notes) return null;
  const { ws_ev_claim, ws_ev_evidence1, ws_ev_evidence2, ws_ev_connection, ws_ev_final } = notes;
  const hasAny = ws_ev_claim || ws_ev_evidence1 || ws_ev_evidence2 || ws_ev_connection || ws_ev_final;
  if (!hasAny) return null;
  return {
    claim: ws_ev_claim || '',
    evidence1: ws_ev_evidence1 || '',
    evidence2: ws_ev_evidence2 || '',
    connection: ws_ev_connection || '',
    final: ws_ev_final || '',
  };
}

// 옛 워크시트 데이터를 새 모드별 필드로 1회성 복사한다(새 필드가 비어 있을 때만).
// ThinkingWorksheetDrawer.js의 LEGACY_FIELD_MIGRATIONS와 동일한 "삭제 없이 보존" 원칙.
export function migrateLegacyWorksheetFields(notes, updateNote) {
  if (!notes) return;
  LEGACY_TO_MODE_FIELD_MIGRATIONS.forEach(([oldKey, newKey]) => {
    if (notes[oldKey] && !notes[newKey]) {
      updateNote(newKey, notes[oldKey]);
    }
  });
}

// 이해모드 자기 확인 질문 — AI가 만든 질문이 있으면 그걸 쓰고, 없거나 부족하면
// 기본 질문으로 채운다. 저장 키(u_check1~4)는 질문 내용과 무관하게 항상 위치 기준.
export function getUnderstandCheckQuestions(result) {
  const aiLines = result?.understandingCheckLines?.length > 0
    ? result.understandingCheckLines
    : result?.reteachLines?.length > 0
      ? result.reteachLines
      : [];
  const source = aiLines.length > 0 ? aiLines : FALLBACK_CHECK_QUESTIONS;
  return source.slice(0, 4);
}
