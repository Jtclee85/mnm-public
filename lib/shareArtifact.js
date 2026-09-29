// 4차 구조 개편 — 공유 페이지가 "AI 결과 공유"가 아니라 "학생이 직접 정리한
// 학습 산출물 공유"가 되도록, 저장된 notes(평평한 key-value)에서 모드별 학생
// 작성 내용만 뽑아 nested 구조로 만든다. notes 자체는 변형하지 않는다.
export function buildModeInputs(notes = {}) {
  return {
    understanding: {
      check1: notes.u_check1 || '',
      check2: notes.u_check2 || '',
      check3: notes.u_check3 || '',
      check4: notes.u_check4 || '',
    },
    inquiry: {
      selectedQuestion: notes.inq_selectedQuestion || '',
      selectedQuestionType: notes.inq_selectedQuestionType || '',
      firstThought: notes.inq_firstThought || '',
      reason: notes.inq_reason || '',
      learnedAfterChat: notes.inq_learnedAfterChat || '',
      changedOrFurtherQuestion: notes.inq_changedOrFurtherQuestion || '',
    },
    presentation: {
      coreMessage: notes.pres_coreMessage || '',
      point1: notes.pres_point1 || '',
      point2: notes.pres_point2 || '',
      point3: notes.pres_point3 || '',
      expectedQuestion: notes.pres_expectedQuestion || '',
      preparedAnswer: notes.pres_preparedAnswer || '',
      openingSentence: notes.pres_openingSentence || '',
      closingSentence: notes.pres_closingSentence || '',
    },
    writing: {
      topicSentence: notes.write_topicSentence || '',
      support1: notes.write_support1 || '',
      support2: notes.write_support2 || '',
      support3: notes.write_support3 || '',
      evidence: notes.write_evidence || '',
      closingThought: notes.write_closingThought || '',
      openingSentence: notes.write_openingSentence || '',
      closingSentence: notes.write_closingSentence || '',
    },
  };
}

// 객체 안에 학생이 실제로 쓴 값이 하나라도 있는지 — 빈 섹션을 통째로 숨기는 데 사용
export function hasAnyValue(obj) {
  if (!obj) return false;
  return Object.values(obj).some(v => (v ?? '').toString().trim().length > 0);
}

// 공유 URL이 너무 길어지지 않도록 보조 자료(원본자료/쉬운설명)만 적당히 잘라 보존한다.
// 학생 작성 내용(모드별 입력값)은 자르지 않는다 — 산출물이 핵심이기 때문.
export function truncateForShare(text, maxLength) {
  const value = (text || '').trim();
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
}
