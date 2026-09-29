import { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import SectionCard from './SectionCard';
import BulletList from './BulletList';
import QuizCard from './QuizCard';
import ThinkingWorksheetDrawer from './ThinkingWorksheetDrawer';
import WritingOutlineCard from './WritingOutlineCard';
import WritingChecklist from './WritingChecklist';
import WritingSectionBlocks from './WritingSectionBlocks';
import PresentationBlocks from './PresentationBlocks';
import InquiryQuestionButtons from './InquiryQuestionButtons';
import ResearchLoadingTips from './ResearchLoadingTips';
import WorksheetField from './WorksheetField';
import { copyText } from '../lib/parseResponse';
import { getUiText, LANGUAGE_OPTIONS } from '../lib/i18n';
import { PRESENTATION_FIELDS, WRITING_FIELDS, getUnderstandCheckQuestions } from '../lib/modeWorksheetFields';

export const TAB_OPTIONS = [
  { value: 'understand',   labelKey: 'modeUnderstand',   icon: '🧒' },
  { value: 'inquiry',      labelKey: 'modeInquiry',      icon: '🔍' },
  { value: 'presentation', labelKey: 'modePresentation', icon: '🎤' },
  { value: 'writing',      labelKey: 'modeWriting',      icon: '✏️' },
];

const TOOL_CONFIG = [
  { key: 'quiz',       labelKey: 'quizTool',       tipKey: 'quizTip' },
  { key: 'evaluation', labelKey: 'evaluationTool', tipKey: 'evaluationTip' },
  { key: 'teacher',    labelKey: 'teacherTool',    tipKey: 'teacherTip' },
];

// 1차 구조 개편: 퀴즈/나 어땠어?/교과평어는 학생 활동 중심 흐름으로 정리하는 동안
// 잠시 숨긴다. 퀴즈는 추후 이해모드로 통합 예정이므로 로직/버튼 정의는 보존한다.
const HIDDEN_TOOL_KEYS = ['quiz', 'evaluation', 'teacher'];
const SHARE_COPY_SUCCESS_MESSAGE = '링크가 복사되었어요. 이제 패들릿이나 게시판에 붙여넣기 할 수 있어요.';
const SHARE_COPY_FALLBACK_MESSAGE = '산출물 페이지를 새 창으로 열었어요. 주소 복사가 되지 않으면 주소창의 링크를 직접 복사해 주세요.';
const SHARE_POPUP_BLOCKED_MESSAGE = '새 창이 차단되었어요. 복사된 링크를 주소창에 붙여넣어 확인할 수 있어요.';

function appendShareNoticeParam(url, notice) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}notice=${encodeURIComponent(notice)}`;
}

export default function ResultCanvas({
  activeMode, onTabClick, onClose,
  analysisByMode, loadingMode,
  toolResults, quizKey, parsedQuiz, quizResult, setQuizResult,
  onQuiz, onEvaluation, onTeacherComment,
  isBusy, loadingTool,
  notes, updateNote, saveStatus, handleShare, onShareTutorialComplete,
  isMobile, isCompact = false, isStacked = false,
  onAskChatbotWithQuestion, t = getUiText('ko'),
  language, onLanguageChange,
  topic,
  onOpenWorksheet, isWorksheetActive,
}) {
  const [hoveredTool, setHoveredTool] = useState(null);
  // 모바일 전용 — 데스크탑은 왼쪽 패널에서 워크시트를 열기 때문에(onOpenWorksheet) 이 state는 쓰지 않음
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  // 4차 구조 개편 — 학습 산출물 공유 버튼. 옛 ThinkingWorksheetDrawer의
  // handleShareClick과 동일한 UX(클립보드 복사 → 실패 시 새 탭 열기)를 재사용한다.
  const [shareState, setShareState] = useState('idle');
  const canvasRef    = useRef(null);
  const canvasBodyRef = useRef(null);
  const quizCardRef   = useRef(null);
  const evalCardRef   = useRef(null);
  const teacherCardRef = useRef(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.style.opacity = '0';
    // 좁은 노트북 화면에서 오른쪽 진입 애니메이션을 쓰면 0.22초 동안 패널이
    // viewport 밖으로 나가 가로 스크롤이 생길 수 있다. 컴팩트/세로 화면은
    // 아래에서 살짝 올라오게 해 레이아웃 폭을 끝까지 고정한다.
    el.style.transform = (isMobile || isCompact || isStacked)
      ? 'translateY(12px)'
      : 'translateX(24px)';
    const id = requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    return () => cancelAnimationFrame(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollCanvasTo = (ref) => {
    setTimeout(() => {
      if (!ref.current || !canvasBodyRef.current) return;
      const container = canvasBodyRef.current;
      const elTop = ref.current.getBoundingClientRect().top;
      const containerTop = container.getBoundingClientRect().top;
      container.scrollTop += elTop - containerTop - 16;
    }, 150);
  };

  useEffect(() => { if (toolResults.quiz)       scrollCanvasTo(quizCardRef);    }, [toolResults.quiz]);
  useEffect(() => { if (toolResults.evaluation)  scrollCanvasTo(evalCardRef);    }, [toolResults.evaluation]);
  useEffect(() => { if (toolResults.teacher)     scrollCanvasTo(teacherCardRef); }, [toolResults.teacher]);

  // 모드를 바꿀 때 이전 모드에서 읽던 위치가 남지 않도록 실제 결과 본문의 세로 위치를
  // 최상단으로 되돌린다. 바깥 canvas의 포커스 이동에 따른 가로 스크롤도 함께 막는다.
  useEffect(() => {
    if (canvasRef.current) canvasRef.current.scrollLeft = 0;
    if (canvasBodyRef.current) canvasBodyRef.current.scrollTop = 0;
  }, [activeMode]);

  const result = analysisByMode[activeMode] || {};
  const isTabLoading = loadingMode === activeMode;

  // 탐구 질문 버튼 클릭 → 바로 챗봇에 보내지 않고, 선택한 질문만 저장한다.
  // 학생이 먼저 '내 처음 생각'을 쓴 뒤, 별도 버튼으로 챗봇에게 물어보게 한다.
  const handleSelectQuestion = (question, type) => {
    updateNote('inq_selectedQuestion', question);
    updateNote('inq_selectedQuestionType', type || '');
  };

  // 4차 구조 개편 — 학습 산출물 공유 링크를 복사하고 즉시 새 탭으로 열어 결과를 확인하게 한다.
  const handleShareClick = async () => {
    if (!handleShare) return;
    const url = handleShare();
    if (!url) return;

    let copySucceeded = false;
    try {
      await navigator.clipboard.writeText(url);
      copySucceeded = true;
    } catch {}

    const notice = copySucceeded ? 'copied' : 'copy-failed';
    const opened = window.open(appendShareNoticeParam(url, notice), '_blank');
    if (opened) {
      try { opened.opener = null; } catch {}
    } else {
      window.alert(copySucceeded ? SHARE_POPUP_BLOCKED_MESSAGE : SHARE_COPY_FALLBACK_MESSAGE);
    }

    setShareState('copied');
    setTimeout(() => setShareState('idle'), 4000);
    onShareTutorialComplete?.();
  };

  const renderModeContent = () => {
    if (isTabLoading) {
      // 기다리는 동안 지루하지 않게 자료조사 꿀팁을 돌아가며 보여준다
      return <ResearchLoadingTips mode={activeMode} t={t} isMobile={isMobile} />;
    }

    if (activeMode === 'understand') return (
      <>
        {/* '한 문장으로 이해하기' / '조사자료를 쉬운 말로 바꾸면'은 왼쪽 '쉬운설명' 패널에서
            상시 참고할 수 있으므로, 오른쪽 결과 영역에서는 중복 표시하지 않는다. */}
        <SectionCard title={t.understandReadingTitle} icon="🧩" isMobile={isMobile}>
          <PresentationBlocks
            text={result.understandingReading}
            fallbackLines={result.summaryLines}
            isMobile={isMobile}
            emptyText={t.understandReadingEmpty}
          />
        </SectionCard>
        <SectionCard title={t.understandChecklistTitle} icon="📋" isMobile={isMobile}>
          <WritingChecklist items={result.understandingChecklistLines} isMobile={isMobile} emptyText={t.understandChecklistEmpty} />
        </SectionCard>
        <SectionCard title={t.understandMisconceptionsTitle} icon="🧭" isMobile={isMobile}>
          <BulletList items={result.understandingMisconceptionLines} isMobile={isMobile} emptyText={t.understandMisconceptionsEmpty} />
        </SectionCard>
        <div data-testid="tutorial-worksheet-understand">
          <SectionCard title={t.understandCheckTitle} icon="✅" isMobile={isMobile}>
            <div style={s.checkList}>
              {getUnderstandCheckQuestions(result).map((question, idx) => (
                <div key={idx} style={s.checkItem}>
                  <p style={s.checkQuestion}>{idx + 1}. {question}</p>
                  <WorksheetField
                    id={`u_check${idx + 1}`}
                    value={notes?.[`u_check${idx + 1}`]}
                    onChange={v => updateNote(`u_check${idx + 1}`, v)}
                    placeholder={t.checkAnswerPlaceholder}
                    isMobile={isMobile}
                    rows={2}
                  />
                </div>
              ))}
            </div>
            {result.understandingQuiz && (
              <div data-testid="understanding-quiz" style={s.understandQuizBox}>
                <p style={s.understandQuizLabel}>🎯 {t.quizTitle}</p>
                <QuizCard
                  key={result.understandingQuiz.question}
                  quizData={result.understandingQuiz}
                  onReset={onQuiz}
                  isMobile={isMobile}
                  onResult={setQuizResult}
                  t={t}
                />
              </div>
            )}
          </SectionCard>
        </div>
        {(result.understandingSentence || result.easy) && (
          <p style={s.coachHint}>{t.understandChatHint}</p>
        )}
      </>
    );

    if (activeMode === 'inquiry') return (
      <>
        <div data-testid="tutorial-worksheet-inquiry" style={s.tutorialWorksheetGroup}>
        <SectionCard title={t.inquiryQuestionsTitle} icon="❓" isMobile={isMobile}>
          <p style={s.sectionLead}>{t.inquiryQuestionsLead}</p>
          <InquiryQuestionButtons
            text={result.inquiryQuestions}
            fallbackLines={result.questionLines}
            onQuestionAsk={handleSelectQuestion}
            selectedQuestion={notes?.inq_selectedQuestion}
            isMobile={isMobile}
            emptyText={t.inquiryQuestionsEmpty}
          />
        </SectionCard>
        {/* 3차 구조 개편 — 탐구 질문을 고른 뒤 바로 챗봇으로 보내지 않고,
            먼저 내 생각을 쓰게 한 다음 챗봇 대화로 이어지게 한다. */}
        <SectionCard title={t.inquiryFirstThoughtTitle} icon="✍️" isMobile={isMobile}>
          <div style={s.fieldGroup}>
            <div style={s.selectedQuestionBox}>
              <span style={s.selectedQuestionLabel}>{t.inquirySelectedQuestionLabel}</span>
              {notes?.inq_selectedQuestion ? (
                <span data-testid="inquiry-selected-question" style={s.selectedQuestionText}>
                  {notes.inq_selectedQuestionType && (
                    <span style={s.typeBadge}>{notes.inq_selectedQuestionType}</span>
                  )}
                  {notes.inq_selectedQuestion}
                </span>
              ) : (
                <span style={s.selectedQuestionEmpty}>{t.inquirySelectedQuestionEmpty}</span>
              )}
            </div>
            <WorksheetField
              id="inq_firstThought"
              label={t.inquiryFirstThoughtLabel}
              value={notes?.inq_firstThought}
              onChange={v => updateNote('inq_firstThought', v)}
              placeholder={t.inquiryFirstThoughtPlaceholder}
              isMobile={isMobile}
            />
            <WorksheetField
              id="inq_reason"
              label={t.inquiryReasonLabel}
              value={notes?.inq_reason}
              onChange={v => updateNote('inq_reason', v)}
              placeholder={t.inquiryReasonPlaceholder}
              isMobile={isMobile}
            />
            <button
              type="button"
              data-testid="ask-chatbot-with-question-button"
              style={{ ...s.askChatbotBtn, ...(!notes?.inq_selectedQuestion ? s.askChatbotBtnDisabled : {}) }}
              disabled={!notes?.inq_selectedQuestion}
              onClick={() => onAskChatbotWithQuestion?.(notes.inq_selectedQuestion)}
            >
              💬 {t.inquiryAskChatbotButton}
            </button>
          </div>
        </SectionCard>

        <SectionCard title={t.inquiryAfterChatTitle} icon="🗒️" isMobile={isMobile}>
          <div style={s.fieldGroup}>
            <WorksheetField
              id="inq_learnedAfterChat"
              label={t.inquiryLearnedLabel}
              value={notes?.inq_learnedAfterChat}
              onChange={v => updateNote('inq_learnedAfterChat', v)}
              placeholder={t.inquiryLearnedPlaceholder}
              isMobile={isMobile}
            />
            <WorksheetField
              id="inq_changedOrFurtherQuestion"
              label={t.inquiryChangedLabel}
              value={notes?.inq_changedOrFurtherQuestion}
              onChange={v => updateNote('inq_changedOrFurtherQuestion', v)}
              placeholder={t.inquiryChangedPlaceholder}
              isMobile={isMobile}
            />
          </div>
        </SectionCard>
        </div>
      </>
    );

    if (activeMode === 'presentation') return (
      <>
        <SectionCard title={t.presentationMessagesTitle} icon="💡" isMobile={isMobile}>
          {t.presentationMessagesLead && <p style={s.sectionLead}>{t.presentationMessagesLead}</p>}
          <PresentationBlocks
            text={result.presentationMessages || result.presentationTitle}
            isMobile={isMobile}
            emptyText={t.presentationMessagesEmpty}
          />
        </SectionCard>
        <SectionCard title={t.presentationAudienceTitle} icon="🎤" isMobile={isMobile}>
          <BulletList items={result.presentationAudienceLines} isMobile={isMobile} emptyText={t.presentationAudienceEmpty} />
        </SectionCard>
        <SectionCard title={t.presentationFlowTitle} icon="📍" isMobile={isMobile}>
          <PresentationBlocks
            text={result.presentationFlow}
            fallbackLines={result.presentationOrderLines}
            isMobile={isMobile}
            emptyText={t.presentationFlowEmpty}
          />
        </SectionCard>
        <SectionCard title={t.presentationEvidenceTitle} icon="🗂️" isMobile={isMobile}>
          <BulletList items={result.presentationEvidenceLines} isMobile={isMobile} emptyText={t.presentationEvidenceEmpty} />
        </SectionCard>
        <SectionCard title={t.presentationQuestionsTitle} icon="🙋" isMobile={isMobile}>
          <PresentationBlocks
            text={result.presentationQuestions}
            fallbackLines={result.expectedQuestionLines}
            isMobile={isMobile}
            emptyText={t.presentationQuestionsEmpty}
          />
        </SectionCard>
        <SectionCard title={t.presentationVisualPlanTitle} icon="🖼️" isMobile={isMobile}>
          <PresentationBlocks
            text={result.presentationVisualPlan}
            isMobile={isMobile}
            emptyText={t.presentationVisualPlanEmpty}
          />
        </SectionCard>
        <SectionCard title={t.presentationTemplatesTitle} icon="🗣️" isMobile={isMobile}>
          <BulletList items={result.presentationTemplateLines?.length > 0 ? result.presentationTemplateLines : result.presentationScriptLines} isMobile={isMobile} emptyText={t.presentationTemplatesEmpty} />
        </SectionCard>
        {/* 3차 구조 개편 — 완성 대본 대신, 학생이 직접 발표 흐름/문장을 채우는 입력 카드 */}
        <div data-testid="tutorial-worksheet-presentation">
          <SectionCard title={t.presentationPrepTitle} icon="🎤" isMobile={isMobile}>
            <div style={s.fieldGroup}>
              {PRESENTATION_FIELDS.map(({ key, labelKey, placeholderKey, numbered }) => (
                <WorksheetField
                  key={key}
                  id={key}
                  label={numbered ? `${t[labelKey]} ${numbered}` : t[labelKey]}
                  value={notes?.[key]}
                  onChange={v => updateNote(key, v)}
                  placeholder={t[placeholderKey]}
                  isMobile={isMobile}
                />
              ))}
            </div>
          </SectionCard>
        </div>
        <SectionCard title={t.presentationChecklistTitle} icon="✅" isMobile={isMobile}>
          <WritingChecklist items={result.presentationChecklistLines} isMobile={isMobile} emptyText={t.presentationChecklistEmpty} />
        </SectionCard>
        {(result.presentationMessages || result.presentationFlow || result.presentationEvidenceLines?.length > 0) && (
          <p style={s.coachHint}>{t.presentationChatHint}</p>
        )}
      </>
    );

    if (activeMode === 'writing') return (
      <>
        <SectionCard title={t.writingTopicSentencesTitle} icon="💡" isMobile={isMobile}>
          {t.writingTopicSentencesLead && <p style={s.sectionLead}>{t.writingTopicSentencesLead}</p>}
          <WritingSectionBlocks
            text={result.writingTopicSentences}
            kind="topic"
            isMobile={isMobile}
            emptyText={t.writingEmpty}
          />
        </SectionCard>
        <SectionCard title={t.writingSupportTitle} icon="🧭" isMobile={isMobile}>
          {t.writingSupportLead && <p style={s.sectionLead}>{t.writingSupportLead}</p>}
          <WritingSectionBlocks
            text={result.writingSupportDirections}
            fallbackText={result.writingTopicSentences}
            kind="support"
            isMobile={isMobile}
            emptyText={t.writingSupportEmpty}
          />
        </SectionCard>
        <SectionCard title={t.writingEvidenceTitle} icon="🗂️" isMobile={isMobile}>
          {t.writingEvidenceLead && <p style={s.sectionLead}>{t.writingEvidenceLead}</p>}
          <BulletList items={result.writingEvidenceLines} isMobile={isMobile} emptyText={t.writingEvidenceEmpty} />
        </SectionCard>
        <SectionCard title={t.writingTemplatesTitle} icon="✍️" isMobile={isMobile}>
          <BulletList items={result.writingTemplateLines} isMobile={isMobile} emptyText={t.writingTemplatesEmpty} />
        </SectionCard>
        <SectionCard
          title={t.writingOutlineTitle} icon="✏️" isMobile={isMobile}
          actions={result.writingOutline ? (
            <button data-testid="copy-outline-button" style={s.smallBtn} onClick={async () => {
              try { await copyText(result.writingOutline); alert(t.outlineCopied); }
              catch { alert(t.copyFailed); }
            }}>{t.copy}</button>
          ) : null}
        >
          <WritingOutlineCard outline={result.writingOutline} isMobile={isMobile} t={t} />
        </SectionCard>
        {/* 3차 구조 개편 — 완성글 대신, 학생이 직접 중심문장/개요를 채우는 입력 카드 */}
        <div data-testid="tutorial-worksheet-writing">
          <SectionCard title={t.writingPrepTitle} icon="✏️" isMobile={isMobile}>
            <div style={s.fieldGroup}>
              {WRITING_FIELDS.map(({ key, labelKey, placeholderKey, numbered }) => (
                <WorksheetField
                  key={key}
                  id={key}
                  label={numbered ? `${t[labelKey]} ${numbered}` : t[labelKey]}
                  value={notes?.[key]}
                  onChange={v => updateNote(key, v)}
                  placeholder={t[placeholderKey]}
                  isMobile={isMobile}
                />
              ))}
            </div>
          </SectionCard>
        </div>
        <SectionCard title={t.writingChecklistTitle} icon="✅" isMobile={isMobile}>
          <WritingChecklist items={result.writingChecklistLines} isMobile={isMobile} emptyText={t.writingChecklistEmpty} />
        </SectionCard>
        {(result.writingTopicSentences || result.writingSupportDirections || result.writingOutline || result.writingEvidenceLines?.length > 0) && (
          <p style={s.writingChatHint}>{t.writingChatHint}</p>
        )}
      </>
    );

    return null;
  };

  const toolHandlers = { quiz: onQuiz, evaluation: onEvaluation, teacher: onTeacherComment };
  const visibleTools = TOOL_CONFIG.filter(({ key }) => !HIDDEN_TOOL_KEYS.includes(key));

  return (
    <div
      ref={canvasRef}
      data-testid="result-canvas"
      style={isMobile
        ? s.canvasMobile
        : { ...s.canvas, ...(isCompact ? s.canvasCompact : {}), ...(isStacked ? s.canvasStacked : {}) }}
    >
      <style>{`
        @keyframes cv-spin { to { transform: rotate(360deg); } }
        .worksheet-cta-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(var(--color-primary-rgb),0.4); }
        .worksheet-cta-btn:active { transform: translateY(0); }
        @media (prefers-reduced-motion: reduce) {
          .worksheet-cta-btn { transition: none !important; }
          .worksheet-cta-btn:hover { transform: none !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={s.header}>
        <span style={s.headerTitle}>{t.resultTitle}</span>

        {onLanguageChange && (
          <>
            <span style={{ fontSize: 12, color: 'var(--color-text-sub)', flexShrink: 0 }}>Language</span>
            <select
              aria-label="language"
              style={s.headerLanguageSelect}
              value={language}
              onChange={e => onLanguageChange(e.target.value)}
            >
              {LANGUAGE_OPTIONS.map(option => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </select>
          </>
        )}

        {visibleTools.length > 0 && (
        <div style={s.toolBar}>
          {visibleTools.map(({ key, labelKey, tipKey }) => (
            <div key={key} style={{ position: 'relative', zIndex: hoveredTool === key ? 10 : 1 }}>
              <button
                data-testid={`tool-${key}`}
                style={{ ...s.toolBtn, position: 'relative', overflow: 'hidden' }}
                onClick={toolHandlers[key]}
                disabled={isBusy}
                onMouseEnter={() => setHoveredTool(key)}
                onMouseLeave={() => setHoveredTool(null)}
              >
                {loadingTool === key && <span className="tool-fill-bar" />}
                {t[labelKey]}
              </button>
              {hoveredTool === key && (
                <div style={s.tip}>
                  <div style={s.tipArrow} />
                  {t[tipKey]}
                </div>
              )}
            </div>
          ))}
        </div>
        )}

        <button onClick={onClose} style={s.closeBtn} title={t.close}>✕</button>
      </div>

      {/* 3차 구조 개편 — 별도 '생각 워크시트' 완성하기 CTA는 핵심 진입점에서 제거한다.
          워크시트 입력 활동은 이제 각 모드(이해/탐구/발표준비/글쓰기준비) 안에 흡수되어 있다.
          기존 ThinkingWorksheetDrawer 컴포넌트와 데이터는 삭제하지 않고 그대로 둔다
          (아래 모바일 시트 렌더링과 onOpenWorksheet/isWorksheetActive 로직도 보존).
          <div style={s.worksheetCtaRow}>
            <button
              data-testid="worksheet-toggle-button"
              onClick={() => (isMobile ? setIsMobileSheetOpen(true) : onOpenWorksheet?.())}
              aria-expanded={isMobile ? isMobileSheetOpen : !!isWorksheetActive}
              aria-label="생각 워크시트 완성하기"
              className="worksheet-cta-btn"
              style={{ ...s.worksheetCtaBtn, ...(isMobile ? s.worksheetCtaBtnMobile : {}) }}
            >
              <span style={{ fontSize: 15 }}>✏️</span>
              <span style={s.worksheetCtaTextWrap}>
                <span style={s.worksheetCtaTitle}>
                  {isMobile ? '생각 워크시트' : '생각 워크시트 완성하기'}
                </span>
                {!isMobile && (
                  <span style={s.worksheetCtaSub}>AI 결과를 보고 내 생각을 정리해요</span>
                )}
              </span>
            </button>
          </div>
      */}

      {/* 4차 구조 개편 — 학생이 각 모드 안에서 직접 쓴 학습 산출물을 공유하는 버튼.
          옛 워크시트 CTA가 차지하던 자리를 그대로 재사용한다. */}
      {handleShare && (
        <div style={s.worksheetCtaRow}>
          <button
            data-testid="share-artifact-button"
            onClick={handleShareClick}
            className="worksheet-cta-btn"
            style={{ ...s.worksheetCtaBtn, ...(isMobile ? s.worksheetCtaBtnMobile : {}) }}
          >
            <span style={{ fontSize: 15 }}>{shareState === 'copied' ? '✓' : '🔗'}</span>
            <span style={s.worksheetCtaTextWrap}>
              <span style={s.worksheetCtaTitle}>
                {shareState === 'copied'
                  ? '링크가 복사되었어요'
                  : (isMobile ? '학습 산출물 공유' : '학습 산출물 공유하기')}
              </span>
              {!isMobile && (
                <span style={s.worksheetCtaSub}>
                  {shareState === 'copied'
                    ? '이제 패들릿이나 게시판에 붙여넣기 할 수 있어요'
                    : '내가 쓴 이해·탐구·발표·글쓰기 기록을 공유해요'}
                </span>
              )}
            </span>
          </button>
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={s.tabBar}>
        <div style={{ ...s.tabList, ...(isCompact ? s.tabListCompact : {}) }}>
          {TAB_OPTIONS.map(({ value, labelKey, icon }) => (
            <button
              key={value}
              data-testid={`mode-tab-${value}`}
              role="tab"
              aria-selected={activeMode === value}
              style={{
                ...s.tab,
                ...(isCompact ? s.tabCompact : {}),
                ...(isMobile ? s.tabMobile : {}),
                ...(activeMode === value ? s.tabActive : {}),
              }}
              onClick={() => onTabClick(value)}
              disabled={loadingMode !== null && loadingMode !== value}
            >
              <span style={{ fontSize: isMobile ? 16 : 18 }}>{icon}</span>
              {t[labelKey]}
              {loadingMode === value && <span style={s.tabSpinner} />}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div
        ref={canvasBodyRef}
        data-testid="result-canvas-body"
        style={{ ...s.body, ...(isCompact ? s.bodyCompact : {}) }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {renderModeContent()}

          {toolResults.quiz && (
            <div ref={quizCardRef}>
              <SectionCard title={t.quizTitle} icon="🎯" isMobile={isMobile}>
                <QuizCard key={quizKey} quizData={parsedQuiz} onReset={onQuiz}
                  isMobile={isMobile} onResult={setQuizResult} t={t} />
              </SectionCard>
            </div>
          )}

          {toolResults.evaluation && (
            <div ref={evalCardRef}>
              <SectionCard title={t.evaluationTitle} icon="🌟" isMobile={isMobile}>
                <div style={s.md}><ReactMarkdown>{toolResults.evaluation}</ReactMarkdown></div>
              </SectionCard>
            </div>
          )}

          {toolResults.teacher && (
            <div ref={teacherCardRef}>
              <SectionCard
                title={t.teacherTitle} icon="🧾" isMobile={isMobile}
                actions={
                  <button style={s.smallBtn} onClick={async () => {
                    try { await copyText(toolResults.teacher); alert(t.teacherCopied); }
                    catch { alert(t.copyFailed); }
                  }}>{t.copy}</button>
                }
              >
                <div style={s.md}><ReactMarkdown>{toolResults.teacher}</ReactMarkdown></div>
              </SectionCard>
            </div>
          )}
        </div>
      </div>
      {/* 데스크탑은 왼쪽 패널에서 워크시트를 열기 때문에(index.js의 leftPanelTab) 여기서는
          모바일 바텀시트만 렌더링한다 — 오른쪽 결과 카드를 가리지 않기 위함 */}
      {isMobile && (
        <ThinkingWorksheetDrawer
          variant="sheet"
          isOpen={isMobileSheetOpen}
          onClose={() => setIsMobileSheetOpen(false)}
          topic={topic}
          activeMode={activeMode}
          notes={notes}
          updateNote={updateNote}
          saveStatus={saveStatus}
          onShare={handleShare}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}

const s = {
  canvas: {
    display: 'flex', flexDirection: 'column',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 20, boxShadow: '0 2px 8px rgba(var(--color-text-rgb),0.08)',
    overflow: 'hidden', width: '100%', minWidth: 0, boxSizing: 'border-box',
    height: 'calc(100vh - 48px)', position: 'sticky', top: 24, alignSelf: 'start',
  },
  canvasCompact: {
    height: 'calc(100vh - 32px)', top: 16, borderRadius: 16,
  },
  canvasStacked: {
    position: 'relative', top: 0, width: '100%',
    height: 'min(900px, calc(100vh - 32px))', minHeight: 640,
  },
  canvasMobile: {
    position: 'fixed', inset: 0, zIndex: 200, borderRadius: 0,
    display: 'flex', flexDirection: 'column',
    background: 'var(--color-surface)', overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '12px 14px', borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface-alt)', flexShrink: 0,
  },
  headerTitle: { fontWeight: 800, fontSize: 14, color: 'var(--color-text)', flex: 1 },
  headerLanguageSelect: {
    border: '1px solid rgba(var(--color-primary-rgb),0.25)', background: 'var(--color-surface)', color: 'var(--color-primary-dark)',
    borderRadius: 9, padding: '5px 6px', fontSize: 12, fontWeight: 800,
    outline: 'none', cursor: 'pointer', width: 100, flexShrink: 0,
  },
  toolBar: { display: 'flex', gap: 5, alignItems: 'center' },
  toolBtn: {
    border: '1px solid rgba(var(--color-primary-rgb),0.25)', background: 'var(--color-surface)', color: 'var(--color-primary-dark)',
    padding: '5px 8px', borderRadius: 9, cursor: 'pointer',
    fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap',
  },
  tip: {
    position: 'absolute', top: 'calc(100% + 6px)', left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--color-primary-dark)', color: 'var(--color-surface)', borderRadius: 10,
    padding: '7px 10px', fontSize: 11, lineHeight: 1.6,
    zIndex: 100, whiteSpace: 'pre-line', textAlign: 'center',
    boxShadow: '0 4px 14px rgba(var(--color-primary-dark-rgb),0.25)', minWidth: 130,
  },
  tipArrow: {
    position: 'absolute', top: -6, left: 'calc(50% - 6px)',
    width: 0, height: 0,
    borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
    borderBottom: '6px solid var(--color-primary-dark)',
  },
  closeBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-sub)',
    borderRadius: 8, width: 28, height: 28, cursor: 'pointer',
    fontWeight: 700, fontSize: 13, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  },
  tabBar: {
    display: 'flex', borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface-alt)', flexShrink: 0,
  },
  tabList: { display: 'flex', flex: 1, gap: 7, padding: '9px 12px', minWidth: 0 },
  tabListCompact: { gap: 4, padding: '7px 8px' },
  tab: {
    flex: 1, minWidth: 0, minHeight: 50,
    border: '1px solid var(--color-border)', borderRadius: 12,
    background: 'var(--color-surface)', color: 'var(--color-text-sub)',
    fontWeight: 900, fontSize: 14.5, lineHeight: 1.25,
    padding: '10px 7px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    boxShadow: '0 2px 7px rgba(var(--color-text-rgb),0.08)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
  },
  tabMobile: { minHeight: 58, padding: '8px 3px', fontSize: 12.5, flexDirection: 'column', gap: 3 },
  tabCompact: { minHeight: 46, padding: '8px 4px', fontSize: 13.5, gap: 4 },
  tabActive: {
    borderColor: 'var(--color-primary)', color: 'var(--color-surface)',
    background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
    boxShadow: '0 6px 16px rgba(var(--color-primary-rgb),0.3)',
  },
  // 생각 워크시트 CTA — 결과 모드 탭과 분리된 독립 행. 탭처럼 보이지 않도록
  // 둥근 필버튼 + 그라디언트 강조로 "산출물 제작" 핵심 액션임을 드러낸다.
  worksheetCtaRow: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
    padding: '10px 14px', borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface)', flexShrink: 0,
  },
  worksheetCtaBtn: {
    display: 'flex', alignItems: 'center', gap: 9,
    border: 'none', borderRadius: 14,
    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
    color: 'var(--color-surface)',
    padding: '9px 18px', cursor: 'pointer',
    boxShadow: '0 6px 16px rgba(var(--color-primary-rgb),0.32)',
    transition: 'transform 0.12s ease, box-shadow 0.12s ease',
  },
  worksheetCtaBtnMobile: { width: '100%', justifyContent: 'center', padding: '11px 14px' },
  worksheetCtaTextWrap: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.3 },
  worksheetCtaTitle: { fontWeight: 900, fontSize: 13, whiteSpace: 'nowrap' },
  worksheetCtaSub: { fontWeight: 600, fontSize: 10.5, opacity: 0.92, whiteSpace: 'nowrap' },
  tabSpinner: {
    display: 'inline-block', width: 9, height: 9,
    border: '2px solid var(--color-border)', borderTop: '2px solid var(--color-primary-dark)',
    borderRadius: '50%', animation: 'cv-spin 0.8s linear infinite',
    marginLeft: 3, verticalAlign: 'middle',
  },
  body: { flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 18, minWidth: 0 },
  bodyCompact: { padding: 14 },
  loadingState: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '60px 20px', gap: 16,
  },
  loadingSpinner: {
    width: 36, height: 36,
    border: '4px solid var(--color-border)', borderTop: '4px solid var(--color-primary)',
    borderRadius: '50%', animation: 'cv-spin 1s linear infinite',
  },
  loadingText: { color: 'var(--color-text-sub)', fontSize: 14, fontWeight: 600, margin: 0 },
  empty: { margin: 0, color: 'var(--color-text-sub)', fontSize: 14, lineHeight: 1.6 },
  md: { color: 'var(--color-text)', lineHeight: 1.8, fontSize: 15 },
  smallBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
    fontWeight: 700, padding: '7px 11px', borderRadius: 9, cursor: 'pointer', fontSize: 12,
  },
  easyRewrite: {
    color: 'var(--color-text)',
    background: 'var(--color-surface-alt)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: '14px 15px',
    lineHeight: 1.85,
    fontSize: 15,
    whiteSpace: 'pre-wrap',
    wordBreak: 'keep-all',
    overflowWrap: 'anywhere',
  },
  sectionLead: {
    margin: '0 0 12px',
    color: 'var(--color-text-sub)',
    fontSize: 14,
    lineHeight: 1.6,
  },
  qBtn: {
    border: '1px solid rgba(var(--color-primary-rgb),0.3)', background: 'rgba(var(--color-primary-rgb),0.06)', color: 'var(--color-primary-dark)',
    padding: '9px 12px', borderRadius: 12, cursor: 'pointer',
    fontWeight: 700, textAlign: 'left', fontSize: 12,
  },
  writingChatHint: {
    margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-sub)',
    background: 'var(--color-surface-alt)', border: '1px dashed var(--color-border)',
    borderRadius: 12, padding: '10px 14px',
  },
  coachHint: {
    margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-sub)',
    background: 'var(--color-surface-alt)', border: '1px dashed var(--color-border)',
    borderRadius: 12, padding: '10px 14px',
  },

  // 3차 구조 개편 — 모드별 워크시트 입력 공통 스타일
  tutorialWorksheetGroup: { display: 'flex', flexDirection: 'column', gap: 18 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 14 },
  checkList: { display: 'flex', flexDirection: 'column', gap: 14 },
  understandQuizBox: { marginTop: 18, paddingTop: 16, borderTop: '1px dashed var(--color-border)' },
  understandQuizLabel: { margin: '0 0 10px', fontSize: 13.5, fontWeight: 800, color: 'var(--color-primary-dark)' },
  checkItem: {
    display: 'flex', flexDirection: 'column', gap: 6,
    border: '1px solid var(--color-border)', borderRadius: 12,
    background: 'var(--color-surface-alt)', padding: '11px 13px',
  },
  checkQuestion: { margin: 0, fontSize: 13.5, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.6 },
  selectedQuestionBox: {
    display: 'flex', flexDirection: 'column', gap: 4,
    border: '1px solid var(--color-border)', borderRadius: 10,
    background: 'var(--color-surface-alt)', padding: '9px 12px',
  },
  selectedQuestionLabel: { fontSize: 11.5, fontWeight: 900, color: 'var(--color-text-sub)' },
  selectedQuestionText: { fontSize: 13.5, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.6 },
  selectedQuestionEmpty: { fontSize: 13, color: 'var(--color-text-sub)', lineHeight: 1.6 },
  typeBadge: {
    display: 'inline-block', marginRight: 7,
    border: '1px solid rgba(var(--color-accent-teal-rgb),0.45)',
    background: 'rgba(var(--color-accent-teal-rgb),0.08)',
    color: 'var(--color-primary-dark)', borderRadius: 999,
    padding: '2px 7px', fontSize: 10.5, fontWeight: 900, whiteSpace: 'nowrap',
  },
  askChatbotBtn: {
    border: 'none', borderRadius: 12, alignSelf: 'flex-start',
    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
    color: 'var(--color-surface)', fontWeight: 800, fontSize: 13,
    padding: '10px 16px', cursor: 'pointer',
  },
  askChatbotBtnDisabled: {
    background: 'var(--color-border)', color: 'var(--color-text-sub)', cursor: 'not-allowed',
  },
};
