import { getUiText } from './i18n';

// 학생 입력 카드(ReflectionCard)의 라벨/placeholder는 언어별로 t에서 가져온다.
export const getReflectionFields = (t = getUiText('ko')) => ({
  understand: [
    {
      key: 'understand_summary',
      label: t.rfUnderstandSummaryLabel,
      placeholder: t.rfUnderstandSummaryPlaceholder
    },
    {
      key: 'understand_newLearning',
      label: t.rfUnderstandNewLearningLabel,
      placeholder: t.rfUnderstandNewLearningPlaceholder
    },
    {
      key: 'understand_questions',
      label: t.rfUnderstandQuestionsLabel,
      placeholder: t.rfUnderstandQuestionsPlaceholder
    }
  ],
  inquiry: [
    {
      key: 'inquiry_thought',
      label: t.rfInquiryThoughtLabel,
      placeholder: t.rfInquiryThoughtPlaceholder
    },
    {
      key: 'inquiry_debate',
      label: t.rfInquiryDebateLabel,
      placeholder: t.rfInquiryDebatePlaceholder
    },
    {
      key: 'inquiry_research',
      label: t.rfInquiryResearchLabel,
      placeholder: t.rfInquiryResearchPlaceholder
    }
  ],
  presentation: [
    {
      key: 'presentation_revision',
      label: t.rfPresentationRevisionLabel,
      placeholder: t.rfPresentationRevisionPlaceholder
    },
    {
      key: 'presentation_message',
      label: t.rfPresentationMessageLabel,
      placeholder: t.rfPresentationMessagePlaceholder
    }
  ],
  writing: [
    {
      key: 'writing_plan',
      label: t.rfWritingPlanLabel,
      placeholder: t.rfWritingPlanPlaceholder
    },
    {
      key: 'writing_feeling',
      label: t.rfWritingFeelingLabel,
      placeholder: t.rfWritingFeelingPlaceholder
    }
  ]
});

// 공유 페이지(항상 한국어로 렌더링)에서 사용하는 한국어 고정 필드
export const REFLECTION_FIELDS = getReflectionFields(getUiText('ko'));

// 공유 페이지와 평가 프롬프트에서 사용하는 단축 레이블
export const REFLECTION_LABELS = {
  understand_summary:    '내가 이해한 내용',
  understand_newLearning:'새롭게 알게 된 점',
  understand_questions:  '아직 궁금한 점',
  inquiry_thought:       '내 생각',
  inquiry_debate:        '친구와 토론해보고 싶은 점',
  inquiry_research:      '추가로 조사하고 싶은 내용',
  presentation_revision: '발표 후 보완하고 싶은 점',
  presentation_message:  '청중에게 전달하고 싶은 핵심 메시지',
  writing_plan:          '내가 더 쓰고 싶은 내용',
  writing_feeling:       '글을 쓰면서 느낀 점'
};

export const MODES = [
  { key: 'understand',    label: '이해 모드',  icon: '🧒' },
  { key: 'inquiry',       label: '탐구 모드',  icon: '🔍' },
  { key: 'presentation',  label: '발표 모드',  icon: '🎤' },
  { key: 'writing',       label: '글쓰기 모드', icon: '✏️' }
];
