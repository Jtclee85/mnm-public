// 기본 수준: 초등 4~6학년이 부담 없이 읽을 수 있는 수준.
// 내용의 깊이는 유지하되 문장·낱말·질문·활동 지시의 표현 난이도를 낮춘다.
// (저학년용 단순화가 아님 — 상세 지침은 systemPrompt.js의 LEVEL_GUIDES 참고)
export const DEFAULT_STUDENT_LEVEL = 'standard';

export const gradeLevelMap = {
  low: '초등 저학년',
  standard: '초등 4~6학년 (내용은 유지하되 표현은 쉽게)',
  high: '초등 4~6학년', // 이전 저장 세션 호환용
  발표: '발표 준비용'
};

export const modeMap = {
  understand: '이해 모드',
  inquiry: '탐구 모드',
  presentation: '발표 준비 모드',
  writing: '글쓰기 모드'
};

export const extractTagBlock = (text, tag) => {
  if (!text) return '';
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
};

const splitLines = (text) => {
  if (!text) return [];
  return text
    .split(/\r?\n|•|·/g)
    .map((line) => line.trim())
    .filter(Boolean);
};

export const parseQuizBlock = (quizText) => {
  if (!quizText) return null;

  const lines = quizText
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean);

  let question = '';
  let answer = '';
  let explanation = '';
  let options = [];
  let type = 'mcq';
  let inOptions = false;

  for (const line of lines) {
    if (/^문제\s*:/i.test(line)) {
      question = line.replace(/^문제\s*:/i, '').trim();
      continue;
    }
    if (/^선택지\s*:/i.test(line)) {
      inOptions = true;
      continue;
    }
    if (/^정답\s*:/i.test(line)) {
      inOptions = false;
      answer = line.replace(/^정답\s*:/i, '').trim();
      continue;
    }
    if (/^해설\s*:/i.test(line)) {
      inOptions = false;
      explanation = line.replace(/^해설\s*:/i, '').trim();
      continue;
    }
    if (inOptions) {
      const opt = line.replace(/^[0-9]+\.\s*/, '').trim();
      if (opt) options.push(opt);
    }
  }

  if (options.length === 2 && options.includes('O') && options.includes('X')) {
    type = 'ox';
  }

  if (!question && lines.length > 0) {
    question = lines[0];
  }

  // OX 퀴즈가 아닌 경우 선택지를 무작위로 섞고 정답 인덱스 갱신
  if (type !== 'ox' && options.length > 1) {
    const correctText = options[Math.max(0, parseInt(answer, 10) - 1)];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    answer = String(options.indexOf(correctText) + 1);
  }

  return { type, question, options, answer, explanation };
};

export const parseSectionedResponse = (rawText) => {
  const easy = extractTagBlock(rawText, 'easy');
  const summary = extractTagBlock(rawText, 'summary');
  const keywords = extractTagBlock(rawText, 'keywords');
  const vocabulary = extractTagBlock(rawText, 'vocabulary');
  const questions = extractTagBlock(rawText, 'questions');
  const searches = extractTagBlock(rawText, 'searches');
  const reteach = extractTagBlock(rawText, 'reteach');
  const further = extractTagBlock(rawText, 'further');
  const understandingSentence = extractTagBlock(rawText, 'understanding_sentence');
  const understandingVocabulary = extractTagBlock(rawText, 'understanding_vocabulary');
  const understandingReading = extractTagBlock(rawText, 'understanding_reading');
  const understandingChecklist = extractTagBlock(rawText, 'understanding_checklist');
  const understandingMisconceptions = extractTagBlock(rawText, 'understanding_misconceptions');
  const understandingCheck = extractTagBlock(rawText, 'understanding_check');
  const understandingQuiz = extractTagBlock(rawText, 'understanding_quiz');
  const inquiryQuestions = extractTagBlock(rawText, 'inquiry_questions');
  const inquiryRefine = extractTagBlock(rawText, 'inquiry_refine');
  const inquiryClues = extractTagBlock(rawText, 'inquiry_clues');
  const inquiryCompare = extractTagBlock(rawText, 'inquiry_compare');
  const inquiryEvidenceInference = extractTagBlock(rawText, 'inquiry_evidence_inference');
  const inquirySearches = extractTagBlock(rawText, 'inquiry_searches');
  const inquiryCard = extractTagBlock(rawText, 'inquiry_card');
  const presentationTitle = extractTagBlock(rawText, 'presentation_title');
  const presentationScript = extractTagBlock(rawText, 'presentation_script');
  const presentationOrder = extractTagBlock(rawText, 'presentation_order');
  const expectedQuestions = extractTagBlock(rawText, 'expected_questions');
  const presentationMessages = extractTagBlock(rawText, 'presentation_messages');
  const presentationAudience = extractTagBlock(rawText, 'presentation_audience');
  const presentationFlow = extractTagBlock(rawText, 'presentation_flow');
  const presentationEvidence = extractTagBlock(rawText, 'presentation_evidence');
  const presentationQuestions = extractTagBlock(rawText, 'presentation_questions');
  const presentationVisualPlan = extractTagBlock(rawText, 'presentation_visual_plan');
  const presentationTemplates = extractTagBlock(rawText, 'presentation_templates');
  const presentationChecklist = extractTagBlock(rawText, 'presentation_checklist');
  const teacher = extractTagBlock(rawText, 'teacher');
  const quiz = extractTagBlock(rawText, 'quiz');
  const evaluation = extractTagBlock(rawText, 'evaluation');
  const writingOutline = extractTagBlock(rawText, 'writing_outline');
  // 글쓰기 모드 — 완성문 대신 학생이 직접 쓰도록 돕는 발판 자료
  const writingTopicSentences = extractTagBlock(rawText, 'writing_topic_sentences');
  const writingSupportDirections = extractTagBlock(rawText, 'writing_support_directions');
  const writingEvidence = extractTagBlock(rawText, 'writing_evidence');
  const writingTemplates = extractTagBlock(rawText, 'writing_templates');
  const writingChecklist = extractTagBlock(rawText, 'writing_checklist');

  return {
    easy,
    summaryLines: splitLines(summary),
    keywordLines: splitLines(keywords),
    vocabularyLines: splitLines(vocabulary),
    questionLines: splitLines(questions),
    searchLines: splitLines(searches),
    reteachLines: splitLines(reteach),
    furtherLines: splitLines(further),
    understandingSentence,
    understandingVocabulary,
    understandingReading,
    understandingChecklistLines: splitLines(understandingChecklist),
    understandingMisconceptionLines: splitLines(understandingMisconceptions),
    understandingCheckLines: splitLines(understandingCheck),
    understandingQuiz: parseQuizBlock(understandingQuiz),
    inquiryQuestions,
    inquiryRefine,
    inquiryClues,
    inquiryCompare,
    inquiryEvidenceInference,
    inquirySearches,
    inquiryCard,
    presentationTitle,
    presentationScriptLines: splitLines(presentationScript),
    presentationOrderLines: splitLines(presentationOrder),
    expectedQuestionLines: splitLines(expectedQuestions),
    presentationMessages,
    presentationAudienceLines: splitLines(presentationAudience),
    presentationFlow,
    presentationEvidenceLines: splitLines(presentationEvidence),
    presentationQuestions,
    presentationVisualPlan,
    presentationTemplateLines: splitLines(presentationTemplates),
    presentationChecklistLines: splitLines(presentationChecklist),
    teacher,
    quiz,
    evaluation,
    writingOutline,
    writingTopicSentences,
    writingSupportDirections,
    writingEvidenceLines: splitLines(writingEvidence),
    writingTemplateLines: splitLines(writingTemplates),
    writingChecklistLines: splitLines(writingChecklist)
  };
};

export const copyText = async (text) => {
  await navigator.clipboard.writeText(text);
};
