import { useState, useEffect, useMemo, useCallback } from 'react';
import Head from 'next/head';
import Image from 'next/image';

import titleLogo from '../public/title-mnm.png';
import SectionCard from '../components/SectionCard';
import ResultCanvas from '../components/ResultCanvas';
import RecommendedSources from '../components/RecommendedSources';
import RecommendedVideos from '../components/RecommendedVideos';
import SignTextReader from '../components/SignTextReader';
import ThinkingWorksheetDrawer from '../components/ThinkingWorksheetDrawer';
import FloatingChatbot from '../components/FloatingChatbot';
import EasyExplanationPanel from '../components/EasyExplanationPanel';
import ResearchCompass from '../components/ResearchCompass';
import ResearchTutorialQuest, { TUTORIAL_QUESTS } from '../components/ResearchTutorialQuest';
import AppUsageTutorial, { APP_TUTORIAL_SCENES } from '../components/AppUsageTutorial';
import SubmissionStartScreen from '../components/SubmissionStartScreen';

import { createSystemMessage, createChatSystemMessage, createEvaluationSystemMessage } from '../lib/systemPrompt';
import { parseSectionedResponse, parseQuizBlock, extractTagBlock, copyText, DEFAULT_STUDENT_LEVEL } from '../lib/parseResponse';
import { useStudentNotes } from '../lib/useStudentNotes';
import { useSessionSave } from '../lib/useSessionSave';
import { migrateLegacyWorksheetFields, getLegacyEvidenceFields } from '../lib/modeWorksheetFields';
import { buildModeInputs, truncateForShare } from '../lib/shareArtifact';
import { encodeShareData } from '../lib/shareUtils';
import {
  buildLearningArtifactPayload,
  initializeAnonymousId,
  submitLearningArtifact,
} from '../lib/artifactCollection';
import packageInfo from '../package.json';
import { LANGUAGE_OPTIONS, getLanguageReminder, getUiText } from '../lib/i18n';
import { withSubjectParticle } from '../lib/koreanParticles';
import { SUBMISSION_APP_URL } from '../lib/submissionMeta';
import { APP_TUTORIAL_PRESET } from '../lib/appTutorialPreset';
import {
  OFFLINE_REVIEWER_CHAT_SAFETY_SCENE,
  OFFLINE_REVIEWER_TUTORIAL_TEXT,
  OFFLINE_REVIEWER_YOUTUBE_SCENE,
} from '../lib/offlineReviewerTutorial';

/** =========================
 *  메인
 *  ========================= */

const TUTORIAL_SEEN_KEY = 'mnmHistoryResearchTutorialSeen';
const APP_TUTORIAL_SEEN_KEY = 'mnmAppUsageTutorialSeen';
const APP_TUTORIAL_MODE_BY_SCENE_ID = {
  understand: 'understand',
  inquiry: 'inquiry',
  presentation: 'presentation',
  writing: 'writing',
};
const OFFLINE_REVIEWER_TUTORIAL_SCENES = APP_TUTORIAL_SCENES.flatMap(scene => {
  const reviewerScene = scene.chapter === 5 ? { ...scene, substepTotal: 3 } : scene;
  const extraScenes = [];
  if (scene.id === 'easyExplanation') extraScenes.push(OFFLINE_REVIEWER_YOUTUBE_SCENE);
  if (scene.id === 'chatbotAsk') extraScenes.push(OFFLINE_REVIEWER_CHAT_SAFETY_SCENE);
  return [reviewerScene, ...extraScenes];
});

// 연구대회 심사용 시작화면 — NEXT_PUBLIC_SUBMISSION_MODE=true일 때만 브라우저 세션당
// 처음 한 번 표시한다. localStorage가 아닌 sessionStorage를 쓰는 이유: 심사자가
// 브라우저를 다시 열었을 때도 시작화면(연구보고서 제목·대상학년)이 보여야 하기 때문.
const SUBMISSION_MODE = process.env.NEXT_PUBLIC_SUBMISSION_MODE === 'true';
const SUBMISSION_START_SEEN_KEY = 'mnmSubmissionStartSeenInSession';
const DEMO_CHAT_NOTICE =
  '오프라인 시연에서는 실제 AI 응답을 생성하지 않습니다. 온라인 프로그램에서는 이 질문을 바탕으로 AI 도우미와 대화할 수 있습니다.';
const DEMO_OCR_NOTICE =
  '오프라인 시연에서는 이미지 인식 기능이 작동하지 않습니다. 온라인 프로그램에서 안내판 사진을 올리면 원본자료를 추출할 수 있습니다.';
const DEMO_API_FEATURE_NOTICE =
  '이 기능은 api를 사용하므로 온라인 프로그램 실행이 필요합니다.';

// 오프라인 데모 로딩 시간(ms). 실제 온라인 분석처럼 로딩 화면(자료조사 꿀팁)을
// 잠깐 보여주기 위한 더미 지연이다. 결과는 snapshot에서 즉시 채운다.
const DEMO_ANALYZE_DELAY_MS = 1700;
const DEMO_MODE_SWITCH_DELAY_MS = 1100;

// AI 분석용 조사자료 길이 상한 — 서버(/api/chat)의 MAX_TOTAL_CHARS(25000)보다 훨씬 낮게
// 잡는다. 시스템 프롬프트·이전 대화가 함께 전송되기 때문. 이 길이를 넘는 자료는
// 차단하지 않고 핵심 문단 중심으로 잘라 보낸다(원문은 화면에 그대로 보존).
const MAX_ANALYSIS_SOURCE_CHARS = 7000;

// 긴 조사자료를 AI가 분석 가능한 길이로 줄인다. 백과사전형 자료의 핵심 항목
// (정의·내용·문화유산 등)이 담긴 문단을 우선 선택하고, 문단 구분이 없는
// 자료는 앞부분을 그대로 자른다. 화면의 원본자료는 건드리지 않는다.
function buildSourceTextForAnalysis(sourceText) {
  const normalized = (sourceText || '').trim();

  if (normalized.length <= MAX_ANALYSIS_SOURCE_CHARS) return normalized;

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);

  const importantHeadings = [
    '정의',
    '개설',
    '연원 및 변천',
    '내용',
    '당우와 국가유산',
    '주요고승',
    '산내 암자',
  ];

  const importantKeywords = [
    '국보', '보물', '문화유산', '창건', '석탑', '석등', '각황전', '대웅전',
  ];

  const selected = [];
  let total = 0;

  for (const paragraph of paragraphs) {
    const shouldPrefer =
      importantHeadings.some(h => paragraph.includes(h)) ||
      importantKeywords.some(k => paragraph.includes(k));

    if (shouldPrefer || selected.length < 5) {
      if (total + paragraph.length > MAX_ANALYSIS_SOURCE_CHARS) break;
      selected.push(paragraph);
      total += paragraph.length;
    }
  }

  return selected.length > 0
    ? selected.join('\n\n')
    : normalized.slice(0, MAX_ANALYSIS_SOURCE_CHARS);
}

export default function Home({
  demoMode = false,
  demoSnapshot = null,
} = {}) {
  const demoSession = demoMode ? getDemoSession(demoSnapshot) : null;
  const demoSnapshotAnalysis = demoSession ? mergeModeResults(demoSession.analysisByMode) : INIT_BY_MODE();

  const [topic,       setTopic]       = useState(demoSession?.topic || '');
  const [sourceText,  setSourceText]  = useState(demoSession?.sourceText || '');
  // 초등 4~6학년이 부담 없이 읽는 수준이 기본값 — 이전의 'high' 하드코딩을 대체.
  // 추후 수준 선택 UI를 붙일 때 이 값을 state로 바꾸면 된다.
  const gradeLevel = demoSession?.gradeLevel || DEFAULT_STUDENT_LEVEL;
  const [language,    setLanguage]    = useState(demoSession?.language || 'ko');
  const t = getUiText(language);
  const isRtl = language === 'ar';

  // 캔버스 / 탭 상태
  const [canvasOpen,  setCanvasOpen]  = useState(false);
  const [activeMode,  setActiveMode]  = useState(demoSession?.activeMode || 'understand');
  const [loadingMode, setLoadingMode] = useState(null);   // 분석 중인 탭

  // 모드별 분리 저장 (공유 필드 덮어쓰기 버그 해소)
  const [analysisByMode, setAnalysisByMode] = useState(() => INIT_BY_MODE());

  // 도구 결과 (탭과 무관)
  const [toolResults, setToolResults] = useState(EMPTY_TOOLS);
  const [quizKey,    setQuizKey]    = useState(0);
  const [demoApiNoticeOpen, setDemoApiNoticeOpen] = useState(false);
  const [quizResult, setQuizResult] = useState(null);

  // 로딩 플래그 (도구용)
  const [isAnalyzing,  setIsAnalyzing]  = useState(false);
  const [loadingTool,  setLoadingTool]  = useState(null);

  // 분석 실패 원인 — 자료 입력 카드에 에러 박스로 표시한다.
  // (예: 서버의 "입력 자료가 너무 깁니다" 400 응답이 빈 결과 안내에 덮이지 않게)
  const [analysisError, setAnalysisError] = useState('');

  // 긴 자료 안내 — 자료를 차단하는 대신 핵심 중심으로 잘라 분석한다는 알림
  const [analysisNotice, setAnalysisNotice] = useState('');
  const [usingAppTutorialPreset, setUsingAppTutorialPreset] = useState(false);

  // 회원가입 없이 같은 브라우저의 반복 활동만 묶을 수 있는 익명 UUID를 최초 접속에
  // 한 번 만든다. 오프라인 시연은 외부 수집을 하지 않으므로 별도 ID도 만들지 않는다.
  useEffect(() => {
    if (!demoMode) initializeAnonymousId();
  }, [demoMode]);

  const [isMobile, setIsMobile] = useState(false);
  // Windows 1920×1080에서 디스플레이 배율 120%/125%를 사용하면 브라우저의
  // 실제 CSS 폭은 약 1600/1536px가 된다. 모바일(900px)과 넓은 데스크톱 사이에
  // 별도 노트북 구간을 두어 3열 랜딩과 분석 결과 2열이 어색하게 줄바꿈되지 않게 한다.
  const [isCompact, setIsCompact] = useState(false);
  const [isStacked, setIsStacked] = useState(false);
  const [leftPanelTab, setLeftPanelTab] = useState('source');

  // 좌측 패널 제목용 — "가장 최근 분석을 실행한" 조사주제 (입력 중인 topic과는 별개)
  const [lastAnalyzedTopic, setLastAnalyzedTopic] = useState('');

  const realStudentNotes = useStudentNotes(topic);
  const [demoNotes, setDemoNotes] = useState(demoSession?.notes || {});
  const updateDemoNote = useCallback((field, value) => {
    setDemoNotes(prev => ({ ...prev, [field]: value }));
  }, []);
  const notes = demoMode ? demoNotes : realStudentNotes.notes;
  const updateNote = demoMode ? updateDemoNote : realStudentNotes.updateNote;
  const saveStatus = demoMode ? 'saved' : realStudentNotes.saveStatus;
  const { savedTopics, triggerSave, saveNow, loadSession, deleteSession } = useSessionSave();

  // 3차 구조 개편 — 옛 별도 '생각 워크시트' 데이터를 각 모드 안 입력 필드로 1회성 복사.
  // 옛 데이터는 지우지 않고 그대로 둔 채, 새 필드가 비어 있을 때만 채운다.
  useEffect(() => {
    if (demoMode) return;
    migrateLegacyWorksheetFields(notes, updateNote);
  }, [demoMode, notes, updateNote]);

  const [conversation, setConversation] = useState(
    cleanConversation(demoSession?.conversation, getUiText(demoSession?.language || 'ko'))
  );
  const [chatInput,    setChatInput]    = useState('');
  // 우하단 플로팅 챗봇 팝업 열림 상태 — 기존 왼쪽 패널 '대화' 탭을 대체
  const [isChatPopupOpen, setIsChatPopupOpen] = useState(false);

  // 5차 — '자료를 조사할 때 주의점 알아보기' 첫 접속 튜토리얼 상태.
  // SSR에서는 항상 닫힌 상태로 시작해 hydration mismatch를 막고, 클라이언트
  // 마운트 이후에만 localStorage를 읽어 첫 접속 여부를 판단한다.
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  // 뭐냐면 사용법 — 실제 화면을 직접 조작하는 6과정 스포트라이트 튜토리얼.
  // 자료조사 방법 교육자료와 완료 기록을 분리해 둘 중 하나를 다시 봐도 다른 쪽의
  // 첫 방문 여부가 바뀌지 않게 한다.
  const [appTutorialOpen, setAppTutorialOpen] = useState(false);
  const [appTutorialStep, setAppTutorialStep] = useState(0);
  const [appTutorialBusy, setAppTutorialBusy] = useState(false);
  const [appTutorialAnalysisRequested, setAppTutorialAnalysisRequested] = useState(false);
  const activeAppTutorialScenes = demoMode
    ? OFFLINE_REVIEWER_TUTORIAL_SCENES
    : APP_TUTORIAL_SCENES;
  const activeAppTutorialScene = activeAppTutorialScenes[appTutorialStep];

  const openAppTutorialIfNeeded = useCallback(() => {
    // 오프라인 시연은 자료조사 교육자료를, 심사 모드는 전용 시작화면을 우선한다.
    if (demoMode || SUBMISSION_MODE) return;
    try {
      if (localStorage.getItem(APP_TUTORIAL_SEEN_KEY) !== 'true') setAppTutorialOpen(true);
    } catch {
      setAppTutorialOpen(true);
    }
  }, [demoMode]);

  useEffect(() => {
    if (demoMode) {
      // 오프라인 시연은 학생용 자료조사 교육 대신 같은 스포트라이트 구조의
      // 심사위원용 기능 안내로 시작한다. 자료조사 교육은 나침반에서 다시 볼 수 있다.
      setTutorialOpen(false);
      setAppTutorialStep(0);
      setAppTutorialOpen(true);
      return;
    }
    if (SUBMISSION_MODE) return;

    // 첫 방문에는 앱 사용법을 먼저 익히게 한다. 자료조사 주의점은 사용법 마지막
    // 과정의 버튼이나 나침반의 다시 보기로 첫 화면에서 이어 보므로, 두 교육자료가
    // 동시에 열리지 않는다.
    setTutorialOpen(false);
    openAppTutorialIfNeeded();
  }, [demoMode, openAppTutorialIfNeeded]);

  // 심사용 시작화면 — SSR/hydration 불일치를 막기 위해 마운트 후에만 판단한다.
  // /?submissionStart=1 쿼리로 sessionStorage와 무관하게 강제 표시할 수 있다.
  const [submissionStartOpen, setSubmissionStartOpen] = useState(false);

  useEffect(() => {
    if (!SUBMISSION_MODE) return;
    try {
      const forced = new URLSearchParams(window.location.search).get('submissionStart') === '1';
      if (forced || sessionStorage.getItem(SUBMISSION_START_SEEN_KEY) !== 'true') {
        setSubmissionStartOpen(true);
      }
    } catch {
      setSubmissionStartOpen(true);
    }
  }, []);

  const markSubmissionStartSeen = () => {
    try { sessionStorage.setItem(SUBMISSION_START_SEEN_KEY, 'true'); } catch {}
  };

  // 시작하기: 시작화면을 닫고 기존 앱 랜딩 화면을 그대로 보여준다.
  const handleSubmissionStart = () => {
    markSubmissionStartSeen();
    setSubmissionStartOpen(false);
  };

  // 자료조사 주의점 보기: 시작화면을 닫으면서 기존 튜토리얼(ResearchTutorialQuest)을 연다.
  const handleSubmissionViewTutorial = () => {
    markSubmissionStartSeen();
    setSubmissionStartOpen(false);
    setTutorialStep(0);
    setTutorialOpen(true);
  };

  const markTutorialSeen = () => {
    try { localStorage.setItem(TUTORIAL_SEEN_KEY, 'true'); } catch {}
  };

  const handleTutorialNext = () => setTutorialStep(s => Math.min(s + 1, TUTORIAL_QUESTS.length - 1));
  const handleTutorialPrev = () => setTutorialStep(s => Math.max(s - 1, 0));

  // 건너뛰기: 이번 방문에서만 닫는다 — seen을 저장하지 않으므로 나중에 다시 볼 수 있다.
  const handleTutorialSkip = () => {
    setTutorialOpen(false);
    setTutorialStep(0);
  };

  // 다시 보지 않기 / 완료: seen을 저장해 나침반 안내 없이도 본 것으로 기록한다.
  const finishTutorial = () => {
    if (!demoMode) markTutorialSeen();
    setTutorialOpen(false);
    setTutorialStep(0);
  };

  const isBusy = loadingMode !== null || isAnalyzing;

  // ── 반응형 ──
  useEffect(() => {
    const fn = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 900);
      setIsCompact(width > 900 && width <= 1640);
      setIsStacked(width > 900 && width <= 1180);
    };
    fn();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  // ── 자동 세션 저장 ──
  useEffect(() => {
    if (demoMode) return;
    if (!topic.trim()) return;
    triggerSave({ topic, sourceText, gradeLevel, language, activeMode, conversation, notes, analysisByMode, toolResults });
  }, [demoMode, topic, sourceText, gradeLevel, language, activeMode, conversation, notes, analysisByMode, toolResults, triggerSave]);

  // ── 이전 조사 불러오기 ──
  const handleLoadSession = (savedTopic) => {
    if (demoMode) return;
    if (topic.trim()) saveNow({ topic, sourceText, gradeLevel, language, activeMode, conversation, notes, analysisByMode, toolResults });

    const session = loadSession(savedTopic);
    if (!session) return;

    setTopic(session.topic ?? '');
    setSourceText(session.sourceText ?? '');
    setLanguage(session.language ?? 'ko');
    setActiveMode(session.activeMode ?? 'understand');
    setConversation(cleanConversation(session.conversation));
    setAnalysisByMode(session.analysisByMode ?? INIT_BY_MODE());
    setToolResults(session.toolResults ?? EMPTY_TOOLS);
    setQuizResult(null);
    setQuizKey(k => k + 1);

    const anyResult = session.analysisByMode &&
      Object.values(session.analysisByMode).some(r =>
        r?.easy || r?.understandingSentence || r?.summaryLines?.length || r?.keywordLines?.length ||
        r?.inquiryQuestions ||
        r?.presentationTitle || r?.presentationMessages || r?.writingOutline
      );
    setCanvasOpen(!!anyResult);
    // 이미 분석된 세션을 불러온 경우에도 '쉬운설명'을 우선으로 보여준다.
    setLeftPanelTab(anyResult ? 'easy' : 'source');
    setLastAnalyzedTopic(anyResult ? (session.topic ?? '') : '');
    setUsingAppTutorialPreset(false);
  };

  const resetWorkspace = () => {
    setTopic('');
    setSourceText('');
    setActiveMode('understand');
    setAnalysisByMode(INIT_BY_MODE());
    setToolResults(EMPTY_TOOLS);
    setQuizResult(null);
    setQuizKey(k => k + 1);
    setConversation([makeInitialMessage(getUiText(language))]);
    setCanvasOpen(false);
    setLeftPanelTab('source');
    setLastAnalyzedTopic('');
    setUsingAppTutorialPreset(false);
  };

  const handleDeleteSession = (savedTopic) => {
    if (demoMode) return;
    if (!window.confirm(`"${savedTopic}" 조사 기록을 삭제할까요?`)) return;

    deleteSession(savedTopic);

    if (savedTopic === topic) {
      resetWorkspace();
    }
  };

  // ── 안내판 사진에서 추출한 텍스트를 조사자료 입력창에 삽입 ──
  // 기존 입력 내용이 있으면 보존하고 줄바꿈으로 이어 붙인다.
  const handleSignTextExtracted = (extractedText) => {
    if (demoMode) {
      alert(DEMO_OCR_NOTICE);
      return;
    }
    setSourceText(prev => {
      const trimmedPrev = prev.trim();
      return trimmedPrev ? `${prev}\n\n${extractedText}` : extractedText;
    });
  };

  // ── 처음으로 돌아가기 ──
  const handleGoHome = () => {
    if (demoMode) {
      setTopic(demoSession?.topic || '');
      setSourceText(demoSession?.sourceText || '');
      setActiveMode(demoSession?.activeMode || 'understand');
      setAnalysisByMode(INIT_BY_MODE());
      setToolResults(EMPTY_TOOLS);
      setQuizResult(null);
      setQuizKey(k => k + 1);
      setConversation(cleanConversation(demoSession?.conversation, getUiText(demoSession?.language || 'ko')));
      setCanvasOpen(false);
      setLeftPanelTab('source');
      setLastAnalyzedTopic('');
      return;
    }
    if (topic.trim()) saveNow({ topic, sourceText, gradeLevel, language, activeMode, conversation, notes, analysisByMode, toolResults });

    resetWorkspace();
  };

  const buildLanguageReminder = () => getLanguageReminder(language);

  const handleLanguageChange = (nextLanguage) => {
    if (demoMode) {
      setDemoApiNoticeOpen(true);
      return;
    }
    setLanguage(nextLanguage);
    const nextText = getUiText(nextLanguage);
    setAnalysisByMode(INIT_BY_MODE());
    setToolResults(EMPTY_TOOLS);
    setQuizResult(null);
    setQuizKey(k => k + 1);
    setConversation([makeInitialMessage(nextText)]);
    setCanvasOpen(false);
    setLeftPanelTab('source');
    setLastAnalyzedTopic('');
  };

  // ── 비스트리밍 요청 (/api/chat-once) — 스트리밍 실패 시 fallback ──
  const requestOnce = async (messageHistory) => {
    const fallbackFailedMsg = t.chatFallbackFailed || t.processFailed;

    let res;
    try {
      res = await fetch('/api/chat-once', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messageHistory })
      });
    } catch {
      // 네트워크 자체가 막힌 경우 — 브라우저 기본 오류 문구 대신 친절한 안내를 던진다
      throw new Error(fallbackFailedMsg);
    }

    let data = {};
    try { data = await res.json(); } catch {}

    if (!res.ok) throw new Error(data.error || fallbackFailedMsg);
    if (!data.content?.trim()) throw new Error(fallbackFailedMsg);

    return data.content.trim();
  };

  // ── SSE 스트리밍 (+ 실패 시 비스트리밍 fallback) ──
  // 학교망·보안 프로그램이 text/event-stream을 차단하는 환경에서도 답변이 나오도록,
  // /api/chat 스트리밍이 실패하면 /api/chat-once로 같은 요청을 한 번에 다시 받는다.
  const requestStream = async (messageHistory, { onChunk, onDone, onError }) => {
    if (demoMode) {
      onDone?.(DEMO_CHAT_NOTICE);
      return;
    }

    let streamedText = '';

    const runFallback = async (reason) => {
      console.warn('[chat fallback] 스트리밍 실패, 비스트리밍 재시도:', reason);
      try {
        const fullText = await requestOnce(messageHistory);
        console.warn('[chat fallback] 스트리밍 실패 후 비스트리밍으로 성공');
        // 스트리밍 UI와 호환되도록 전체 답변을 한 번에 전달
        onChunk?.(fullText, fullText);
        onDone?.(fullText);
      } catch (fallbackError) {
        console.error('[chat fallback] 비스트리밍도 실패:', fallbackError);
        onError?.(
          fallbackError instanceof Error
            ? fallbackError.message
            : (t.chatFallbackFailed || t.processFailed)
        );
      }
    };

    // 개발 중 fallback 동작 확인용: 주소에 ?forceFallback=1을 붙이면 스트리밍을 건너뛴다.
    // production 빌드에서는 항상 비활성.
    const forceFallback =
      process.env.NODE_ENV !== 'production' &&
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('forceFallback') === '1';

    if (forceFallback) {
      await runFallback('forceFallback=1 쿼리로 강제 실행');
      return;
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messageHistory })
      });

      if (!res.ok) {
        let errMsg = t.processFailed;
        try { const body = await res.json(); if (body.error) errMsg = body.error; } catch {}
        // 400(입력 문제)·405·429(사용량 초과)는 비스트리밍으로 다시 보내도 같은 결과이므로 바로 오류 처리
        if (res.status === 400 || res.status === 405 || res.status === 429) {
          onError?.(errMsg);
        } else {
          await runFallback(`stream status ${res.status}: ${errMsg}`);
        }
        return;
      }

      if (!res.body) {
        await runFallback('stream response body 없음');
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer   = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          if (part.startsWith('data: ')) {
            try {
              const data = JSON.parse(part.substring(6));
              streamedText += data;
              onChunk?.(data, streamedText);
            } catch {}
          }
        }
      }

      if (buffer.startsWith('data: ')) {
        try { const data = JSON.parse(buffer.substring(6)); streamedText += data; onChunk?.(data, streamedText); } catch {}
      }

      if (!streamedText.trim()) {
        await runFallback('stream 빈 응답');
        return;
      }

      onDone?.(streamedText);
    } catch (error) {
      console.error('[chat stream] 오류:', error);

      // 답변 대부분이 이미 화면에 표시된 뒤 끝부분에서 끊긴 경우 —
      // fallback으로 다시 생성하면 내용이 중복·변형되므로 받은 것까지로 완료 처리
      if (streamedText.trim().length >= 20) {
        onDone?.(streamedText);
        return;
      }

      // 학교망·보안 프로그램의 SSE 차단, 네트워크 끊김 등은 여기로 들어온다
      await runFallback(error);
    }
  };

  const streamOnce = (messages) =>
    new Promise((resolve, reject) => {
      requestStream(messages, { onDone: resolve, onError: reject });
    });

  // ── 시스템 프롬프트 빌더 ──
  // AI에는 항상 분석용 축약본을 보낸다. 화면의 원본자료는 전체가 그대로 남는다.
  const buildBaseSystem = (mode = activeMode) =>
    createSystemMessage({ topic, sourceText: buildSourceTextForAnalysis(sourceText), gradeLevel, learningMode: mode, language });

  const buildChatSystem = () =>
    createChatSystemMessage({ topic, sourceText: buildSourceTextForAnalysis(sourceText), gradeLevel, language });

  const buildEvaluationSystem = () => {
    const excludePatterns = [
      /^조사주제는\s+'.+'\s*이?야[\.\s]*자료를\s*분석해줘/,
      /^(나 어땠어\?|교과평어 만들기|퀴즈풀기|전체 요약)$/
    ];
    const followUpQuestions = conversation
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content.trim())
      .filter(content => !excludePatterns.some(re => re.test(content)));
    return createEvaluationSystemMessage({ topic, gradeLevel, quizResult, followUpQuestions, studentNotes: notes, language });
  };

  // ── 모드별 분석 (공통) ──
  // 실패 시 서버가 알려준 원인(예: "입력 자료가 너무 깁니다")을 그대로 돌려준다.
  const analyzeForMode = async (mode) => {
    if (demoMode) {
      // 모드 전환 시에도 실제 생성처럼 로딩 화면(자료조사 꿀팁)을 잠시 보여준다.
      setLoadingMode(mode);
      await new Promise(resolve => setTimeout(resolve, DEMO_MODE_SWITCH_DELAY_MS));
      setAnalysisByMode(prev => ({ ...prev, [mode]: { ...EMPTY_MODE_RESULT, ...(demoSession?.analysisByMode?.[mode] || {}) } }));
      setLoadingMode(null);
      return { success: true, error: '' };
    }

    setLoadingMode(mode);

    const sysMsg = createSystemMessage({ topic: topic.trim(), sourceText: buildSourceTextForAnalysis(sourceText), gradeLevel, learningMode: mode, language });

    let success = false;
    let errorMessage = '';
    await new Promise(resolve => {
      requestStream(
        [sysMsg, { role: 'user', content: '원본 자료를 분석해서 모드에 맞는 학습 결과를 만들어 줘.' }],
        {
          onDone: (fullText) => {
            setAnalysisByMode(prev => ({ ...prev, [mode]: parseSectionedResponse(fullText) }));
            success = true;
            resolve();
          },
          onError: (msg) => {
            console.error(`[analyzeForMode:${mode}]`, msg);
            errorMessage = typeof msg === 'string' && msg ? msg : t.analysisFailed;
            resolve();
          }
        }
      );
    });

    setLoadingMode(null);
    return { success, error: errorMessage };
  };

  // ── 분석 시작 ──
  const handleAnalyze = async () => {
    const trimmedTopic  = topic.trim();
    const trimmedSource = sourceText.trim();

    if (!trimmedTopic)              { alert(t.missingTopic); return; }
    if (trimmedSource.length < 50)  { alert(t.shortSource); return; }

    setAnalysisError('');

    // 긴 자료는 차단하지 않는다 — 핵심 중심으로 잘라 보낸다는 안내만 하고 계속 진행
    setAnalysisNotice(
      !demoMode && trimmedSource.length > MAX_ANALYSIS_SOURCE_CHARS
        ? (t.sourceTrimmedNotice || '')
        : ''
    );

    if (appTutorialOpen && activeAppTutorialScene?.id === 'analyze') {
      // 사용법 연습은 API 생성 품질을 확인하는 과정이 아니다. 강화 고인돌 오프라인
      // 결과를 즉시 넣어 사용량·네트워크 상태와 무관하게 네 모드를 끝까지 체험하게 한다.
      const tutorialAnalysis = demoMode ? demoSnapshotAnalysis : APP_TUTORIAL_PRESET.analysisByMode;
      const tutorialResults = Object.fromEntries(
        Object.entries(INIT_BY_MODE()).map(([mode, emptyResult]) => [
          mode,
          { ...emptyResult, ...(tutorialAnalysis[mode] || {}) },
        ])
      );
      setAppTutorialAnalysisRequested(true);
      setLastAnalyzedTopic(demoSession?.topic || APP_TUTORIAL_PRESET.topic);
      setUsingAppTutorialPreset(true);
      setActiveMode('understand');
      setLeftPanelTab('easy');
      setConversation(demoMode
        ? cleanConversation(demoSession?.conversation, t)
        : [{ role: 'assistant', content: t.initialMessage }]);
      setAnalysisByMode(tutorialResults);
      setToolResults(EMPTY_TOOLS);
      const tutorialNotes = demoMode ? (demoSession?.notes || {}) : APP_TUTORIAL_PRESET.worksheetNotes;
      Object.entries(tutorialNotes).forEach(([field, value]) => updateNote(field, value));
      setLoadingMode(null);
      setCanvasOpen(true);
      return;
    }

    setUsingAppTutorialPreset(false);

    if (demoMode) {
      // 실제 온라인 분석과 동일한 흐름으로 로딩 화면을 먼저 보여준다.
      // 캔버스를 열고 '이해' 모드 로딩(자료조사 꿀팁)을 잠시 표시한 뒤,
      // snapshot 결과를 채우고 저장된 활성 모드로 전환한다.
      const demoActiveMode = demoSession?.activeMode || 'understand';
      setLastAnalyzedTopic(demoSession?.topic || trimmedTopic);
      setActiveMode('understand');
      setLeftPanelTab('easy');
      setConversation([{ role: 'assistant', content: trimmedSource.length > 3000 ? t.longThinking : t.thinking }]);
      setCanvasOpen(true);
      setLoadingMode('understand');

      await new Promise(resolve => setTimeout(resolve, DEMO_ANALYZE_DELAY_MS));

      setAnalysisByMode(demoSnapshotAnalysis);
      setToolResults({ ...EMPTY_TOOLS, ...(demoSession?.toolResults || {}) });
      setActiveMode(demoActiveMode);
      setConversation(cleanConversation(demoSession?.conversation, t));
      setLoadingMode(null);
      return;
    }

    setLastAnalyzedTopic(trimmedTopic);
    // 자료 분석 이후에는 왼쪽 패널에 '쉬운설명'을 우선으로 보여준다.
    setLeftPanelTab('easy');

    const thinkingMsg = trimmedSource.length > 3000
      ? t.longThinking
      : t.thinking;

    setConversation([{ role: 'assistant', content: thinkingMsg }]);

    // 이전 결과 초기화 후 캔버스 열기
    setAnalysisByMode(INIT_BY_MODE());
    setToolResults(EMPTY_TOOLS);
    setActiveMode('understand');
    setCanvasOpen(true);

    const result = await analyzeForMode('understand');

    // 일반 흐름은 캔버스를 닫아 빈 결과 안내가 실제 오류를 덮지 않게 한다.
    // 다만 앱 사용법의 분석 장면에서는 캔버스를 닫으면 로딩 직후 첫 화면으로
    // 튕겨 보이므로, 좌우 레이아웃과 강조 버튼을 유지해 그 자리에서 재시도하게 한다.
    if (!result.success) {
      const message = result.error || t.analysisFailed;
      setAnalysisError(message);
      setCanvasOpen(appTutorialOpen && activeAppTutorialScene?.id === 'analyze');
      setLeftPanelTab('source');
      setConversation([{ role: 'assistant', content: message }]);
      return;
    }

    setConversation(prev => {
      const updated = [...prev];
      const last = updated.length - 1;
      if (updated[last]?.role === 'assistant') {
        updated[last] = { ...updated[last], content: t.initialMessage };
      }
      return updated;
    });
  };

  // ── 탭 클릭 ──
  const hasModeResult = (mode) => {
    const r = analysisByMode[mode];
    return !!(r?.easy || r?.understandingSentence || r?.summaryLines?.length || r?.keywordLines?.length ||
      r?.inquiryQuestions ||
      r?.presentationTitle || r?.presentationMessages || r?.writingOutline);
  };

  const handleTabClick = async (mode) => {
    setActiveMode(mode);
    if (demoMode) {
      if (!hasModeResult(mode)) await analyzeForMode(mode);
      return;
    }
    if (!hasModeResult(mode) && loadingMode === null && !isAnalyzing) {
      await analyzeForMode(mode);
    }
  };

  const markAppTutorialSeen = () => {
    try { localStorage.setItem(APP_TUTORIAL_SEEN_KEY, 'true'); } catch {}
  };

  const startAppUsageTutorial = () => {
    setTutorialOpen(false);
    setIsChatPopupOpen(false);
    setLeftPanelTab('source');
    setAppTutorialStep(0);
    setAppTutorialBusy(false);
    setAppTutorialAnalysisRequested(false);
    setAppTutorialOpen(true);
  };

  const skipAppUsageTutorial = () => {
    // 자동 타이핑 도중 시연을 닫아도 심사용 예시가 반쯤 입력된 채 남지 않게 한다.
    if (demoMode) {
      setTopic(demoSession?.topic || APP_TUTORIAL_PRESET.topic);
      setSourceText(demoSession?.sourceText || APP_TUTORIAL_PRESET.sourceText);
    }
    setAppTutorialOpen(false);
    setAppTutorialStep(0);
    setAppTutorialBusy(false);
    setAppTutorialAnalysisRequested(false);
  };

  const finishAppUsageTutorial = () => {
    if (!demoMode) markAppTutorialSeen();
    setAppTutorialOpen(false);
    setAppTutorialStep(0);
    setAppTutorialBusy(false);
    setAppTutorialAnalysisRequested(false);
  };

  // 사용법 마지막 과정의 '자료를 조사할 때 주의할 점 알아보기'.
  // 시연용 예시가 남은 채로 주의점을 읽지 않도록 첫 화면으로 되돌린 뒤 팝업을 연다.
  // 예시는 학생이 직접 쓴 내용이 아니므로 이전 조사로 저장하지 않는다.
  const handleAppTutorialResearchTips = () => {
    finishAppUsageTutorial();
    setIsChatPopupOpen(false);
    resetWorkspace();
    setTutorialStep(0);
    setTutorialOpen(true);
  };

  const appTutorialTopicExample = demoSession?.topic || APP_TUTORIAL_PRESET.topic;
  const appTutorialSourceExample = demoSession?.sourceText || APP_TUTORIAL_PRESET.sourceText;

  // 자동 시연 컴포넌트가 전달한 부분 문자열을 그대로 반영한다. 값 없이 호출하면
  // 장면을 빠르게 넘겼을 때도 완성된 시연 자료가 남도록 전체 예시를 사용한다.
  const fillAppTutorialTopic = (animatedValue) => {
    setTopic(typeof animatedValue === 'string' ? animatedValue : appTutorialTopicExample);
  };

  const fillAppTutorialSource = (animatedValue) => {
    setSourceText(typeof animatedValue === 'string' ? animatedValue : appTutorialSourceExample);
  };

  const moveAppTutorialTo = async (nextStep) => {
    if (nextStep < 0 || nextStep >= activeAppTutorialScenes.length) return;

    const nextScene = activeAppTutorialScenes[nextStep];
    setIsChatPopupOpen(['chatbotAsk', 'chatSafety'].includes(nextScene.id));
    const nextMode = APP_TUTORIAL_MODE_BY_SCENE_ID[nextScene.id];
    if (nextMode && activeMode !== nextMode) {
      setAppTutorialBusy(true);
      await handleTabClick(nextMode);
      setAppTutorialBusy(false);
    }
    if (['topic', 'source', 'analyze'].includes(nextScene.id)) setLeftPanelTab('source');
    if (nextScene.id === 'analyze') setAppTutorialAnalysisRequested(false);
    setAppTutorialStep(nextStep);
  };

  const handleAppTutorialNext = () => {
    if (appTutorialStep === activeAppTutorialScenes.length - 1) {
      finishAppUsageTutorial();
      return;
    }
    // 학생이 튜토리얼을 보기 위해 내용을 억지로 입력할 필요는 없다.
    // 빈칸이면 다음 과정에 필요한 공개 시연 자료만 자동으로 채운다.
    if (activeAppTutorialScene?.id === 'topic') fillAppTutorialTopic();
    if (activeAppTutorialScene?.id === 'source') fillAppTutorialSource();
    moveAppTutorialTo(appTutorialStep + 1);
  };
  const handleAppTutorialPrev = () => moveAppTutorialTo(appTutorialStep - 1);

  // 분석 버튼과 챗봇 열기는 튜토리얼 카드의 '다음'이 아니라 실제 강조 버튼을
  // 눌러 진행한다. 결과/팝업이 준비된 뒤에만 다음 장면으로 옮긴다.
  useEffect(() => {
    if (!appTutorialOpen || activeAppTutorialScene?.id !== 'analyze') return;
    if (appTutorialAnalysisRequested && canvasOpen && loadingMode === null && hasModeResult('understand')) {
      setAppTutorialStep(step => step + 1);
    }
  }, [appTutorialOpen, activeAppTutorialScene?.id, appTutorialAnalysisRequested, canvasOpen, loadingMode, analysisByMode]);

  useEffect(() => {
    if (appTutorialOpen && activeAppTutorialScene?.id === 'chatbotOpen' && isChatPopupOpen) {
      setAppTutorialStep(step => step + 1);
    }
  }, [appTutorialOpen, activeAppTutorialScene?.id, isChatPopupOpen]);

  const appTutorialCanAdvance = true;
  const activeTutorialText = demoMode
    ? OFFLINE_REVIEWER_TUTORIAL_TEXT
    : { ...t.appTutorial, close: t.close };

  // ── 도구 공통 핸들러 ──
  const handleSpecialRequest = async ({ promptText, withHistory = false, onDone, toolKey, buildSystem, retryTag }) => {
    if (!sourceText.trim()) { alert(t.missingAnalysis); return; }

    if (demoMode) {
      setIsAnalyzing(true);
      setLoadingTool(toolKey ?? null);
      await new Promise(resolve => setTimeout(resolve, 300));
      onDone(parseSectionedResponse(DEMO_CHAT_NOTICE));
      setIsAnalyzing(false);
      setLoadingTool(null);
      return;
    }

    setIsAnalyzing(true);
    setLoadingTool(toolKey ?? null);

    const systemMsg = buildSystem ? buildSystem() : buildBaseSystem();
    const userMsg   = { role: 'user', content: `${promptText}${buildLanguageReminder()}` };
    const messages  = withHistory ? [systemMsg, ...conversation, userMsg] : [systemMsg, userMsg];

    try {
      let fullText = await streamOnce(messages);
      if (retryTag && !extractTagBlock(fullText, retryTag)) {
        fullText = await streamOnce(messages);
      }
      onDone(parseSectionedResponse(fullText));
    } catch (errorMsg) {
      alert(typeof errorMsg === 'string' ? errorMsg : t.processFailed);
    }

    setIsAnalyzing(false);
    setLoadingTool(null);
  };

  const handleQuiz = () =>
    handleSpecialRequest({
      promptText: '퀴즈풀기', toolKey: 'quiz', retryTag: 'quiz',
      onDone: (parsed) => {
        setToolResults(prev => ({ ...prev, quiz: parsed.quiz || t.quizFailed }));
        setQuizKey(prev => prev + 1);
        setQuizResult(null);
      }
    });

  const handleEvaluation = async () => {
    if (!sourceText.trim()) { alert(t.missingAnalysis); return; }
    if (demoMode) {
      setToolResults(prev => ({ ...prev, evaluation: DEMO_CHAT_NOTICE }));
      return;
    }
    setIsAnalyzing(true);
    setLoadingTool('evaluation');

    const systemMsg  = buildEvaluationSystem();
    const chatHistory = conversation[0]?.role === 'assistant' ? conversation.slice(1) : conversation;
    const messages   = [systemMsg, ...chatHistory, { role: 'user', content: `나 어땠어?${buildLanguageReminder()}` }];

    try {
      let fullText = await streamOnce(messages);
      if (!fullText.trim()) fullText = await streamOnce(messages);
      setToolResults(prev => ({ ...prev, evaluation: fullText.trim() || t.evaluationFailed }));
    } catch (errorMsg) {
      alert(typeof errorMsg === 'string' ? errorMsg : t.processFailed);
    }

    setIsAnalyzing(false);
    setLoadingTool(null);
  };

  const handleTeacherComment = () =>
    handleSpecialRequest({
      promptText: '교과평어 만들기', toolKey: 'teacher', withHistory: true,
      onDone: (parsed) => {
        setToolResults(prev => ({ ...prev, teacher: parsed.teacher || t.teacherFailed }));
      }
    });

  const checkChatRelevance = async (userText) => {
    if (demoMode) {
      return { relevant: true, redirect: '' };
    }
    try {
      const res = await fetch('/api/relevance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          sourceText: buildSourceTextForAnalysis(sourceText).slice(0, 6000),
          userText,
          language,
          conversation: conversation.slice(-6),
        }),
      });

      const data = await res.json().catch(() => ({}));
      return {
        relevant: res.ok && data.relevant === true,
        redirect: data.redirect || t.irrelevantRedirect,
      };
    } catch (error) {
      console.error('Relevance check failed:', error);
      return {
        relevant: false,
        redirect: t.relevanceFailed,
      };
    }
  };

  // ── 후속 질문 채팅 ──
  const handleFollowUpChat = async (customPrompt) => {
    const userText = (customPrompt ?? chatInput).trim();
    if (!userText || isBusy) return;

    const userMessage          = { role: 'user',      content: userText };
    const assistantPlaceholder = { role: 'assistant', content: '' };

    setChatInput('');
    setIsChatLoading(true);

    // 관련성 검사 응답을 기다리는 동안에도 학생이 보낸 질문이 바로 보이도록 먼저 추가한다
    setConversation(prev => [...prev, userMessage]);

    if (demoMode) {
      await new Promise(resolve => setTimeout(resolve, 250));
      setConversation(prev => [...prev, { role: 'assistant', content: DEMO_CHAT_NOTICE }]);
      setIsChatLoading(false);
      return;
    }

    const relevance = await checkChatRelevance(userText);
    if (!relevance.relevant) {
      setConversation(prev => [
        ...prev,
        { role: 'assistant', content: relevance.redirect },
      ]);
      setIsChatLoading(false);
      return;
    }

    setConversation(prev => [...prev, assistantPlaceholder]);

    await requestStream([buildChatSystem(), ...conversation, userMessage], {
      // 두 번째 인자(누적 전체 텍스트)로 내용을 교체한다. 스트리밍이 잠깐 진행되다
      // 비스트리밍 fallback으로 넘어가도 부분 답변과 전체 답변이 겹쳐 보이지 않는다.
      onChunk: (_, full) => {
        setConversation(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === 'assistant') {
            updated[lastIdx] = { ...updated[lastIdx], content: full };
          }
          return updated;
        });
      },
      onDone: () => {},
      onError: (msg) => {
        // 서버가 400으로 알려준 원인(예: "입력 자료가 너무 깁니다")을 그대로 보여준다
        setConversation(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (updated[lastIdx]?.role === 'assistant') {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: (typeof msg === 'string' && msg) ? msg : t.chatFailed,
            };
          }
          return updated;
        });
      }
    });

    setIsChatLoading(false);
  };

  const [isChatLoading, setIsChatLoading] = useState(false);

  // ── 3차 구조 개편: 탐구모드 '이 질문으로 챗봇에게 물어보기' 버튼 ──
  // 질문을 고르자마자 자동으로 챗봇에 보내지 않는다. 학생이 먼저 자기 생각을 쓴 뒤
  // 이 버튼을 눌러야 챗봇 팝업이 열리고, 질문은 입력창에 채워지기만 한다(자동 전송 아님).
  const handleAskChatbotWithQuestion = (q) => {
    if (!q) return;
    setChatInput(q);
    setIsChatPopupOpen(true);
  };

  // ── 공유 URL 생성 ──
  // 4차 구조 개편: 공유 페이지는 이제 AI 결과가 아니라 학생이 각 모드 안에서
  // 직접 쓴 산출물(modeInputs) 중심으로 보여준다. 원본자료/쉬운설명은 보조 자료로만
  // 짧게 포함한다. notes 전체(legacyWorksheet)도 함께 보내 옛 형식 링크와의
  // 호환(3차 이전 생각 워크시트 데이터 포함)을 유지한다.
  const handleShare = () => {
    const u = analysisByMode.understand || {};
    const modeInputs = buildModeInputs(notes);
    const legacyEvidence = getLegacyEvidenceFields(notes);
    const shareData = {
      topic: lastAnalyzedTopic || topic || t.untitled,
      sourceText: truncateForShare(sourceText, demoMode ? 2500 : 500),
      easyExplanationSummary: {
        oneSentence: u.understandingSentence || '',
        easyFullText: truncateForShare(u.easy, demoMode ? 1200 : 400),
      },
      modeInputs,
      legacyEvidence,
      legacyWorksheet: notes,
      sharedAt: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    };
    const encoded = encodeShareData(shareData);
    const shareUrl = demoMode
      ? `../share/index.html?d=${encoded}`
      : `${window.location.origin}/share?d=${encoded}`;

    // 공유 URL 생성에 성공한 뒤에만 연구용 익명 전송을 시작한다. 반환값을 기다리지
    // 않으므로 Apps Script 장애·timeout은 기존 링크 복사/새 창 열기를 막지 않는다.
    if (!demoMode) {
      void submitLearningArtifact(buildLearningArtifactPayload({
        activityMode: activeMode,
        topic: shareData.topic,
        modeInputs,
        appVersion: packageInfo.version,
      }));
    }

    return shareUrl;
  };

  // ── 퀴즈 파싱 (quiz 텍스트 변경 시만) ──
  const parsedQuiz = useMemo(() => parseQuizBlock(toolResults.quiz), [toolResults.quiz]);

  // ── 내보내기 텍스트 ──
  const buildExportText = () => {
    const u = analysisByMode.understand    || {};
    const i = analysisByMode.inquiry       || {};
    const p = analysisByMode.presentation  || {};
    const w = analysisByMode.writing       || {};
    return [
      `${t.topicLabel}: ${topic}`, '',
      `[${t.understandSentenceTitle}]`, u.understandingSentence || u.easy || '', '',
      `[${t.understandEasyFullTitle}]`, u.easy || '', '',
      `[${t.understandVocabularyRoleTitle}]`, u.understandingVocabulary || (u.vocabularyLines || []).join('\n'), '',
      `[${t.understandReadingTitle}]`, u.understandingReading || (u.summaryLines || []).join('\n'), '',
      `[${t.understandMisconceptionsTitle}]`, ...(u.understandingMisconceptionLines || []), '',
      `[${t.understandCheckTitle}]`, ...(u.understandingCheckLines?.length > 0 ? u.understandingCheckLines : (u.reteachLines || [])), '',
      `[${t.inquiryQuestionsTitle}]`, i.inquiryQuestions || (i.questionLines || []).join('\n'), '',
      `[${t.presentationMessagesTitle}]`, p.presentationMessages || p.presentationTitle || '',  '',
      `[${t.presentationAudienceTitle}]`, ...(p.presentationAudienceLines || []), '',
      `[${t.presentationFlowTitle}]`, p.presentationFlow || '', '',
      `[${t.presentationEvidenceTitle}]`, ...(p.presentationEvidenceLines || []), '',
      `[${t.presentationQuestionsTitle}]`, p.presentationQuestions || (p.expectedQuestionLines || []).join('\n'), '',
      `[${t.presentationVisualPlanTitle}]`, p.presentationVisualPlan || '', '',
      `[${t.presentationTemplatesTitle}]`, ...(p.presentationTemplateLines?.length > 0 ? p.presentationTemplateLines : (p.presentationScriptLines || [])), '',
      `[${t.presentationChecklistTitle}]`, ...(p.presentationChecklistLines || []), '',
      `[${t.writingTopicSentencesTitle}]`, w.writingTopicSentences || '', '',
      `[${t.writingSupportTitle}]`, w.writingSupportDirections || '', '',
      `[${t.writingEvidenceTitle}]`, ...(w.writingEvidenceLines || []), '',
      `[${t.writingTemplatesTitle}]`, ...(w.writingTemplateLines || []), '',
      `[${t.writingOutlineTitle}]`,       w.writingOutline     || '', '',
      `[${t.writingChecklistTitle}]`, ...(w.writingChecklistLines || [])
    ].join('\n');
  };

  // 재오픈 버튼 표시 여부
  const hasAnyResult = hasAnyAnalysisResult(analysisByMode);

  // 아직 분석을 시작하지 않은 진짜 첫 랜딩 상태 — 분석 오류가 있으면 캔버스는
  // 닫더라도 입력 작업 화면을 유지해 자료를 잃은 듯한 첫 화면 복귀를 막는다.
  const showLanding = !canvasOpen && !hasAnyResult && !analysisError;

  // 좌측 패널 제목 — 가장 최근 분석한 조사주제 기준 (입력 중인 topic이 바뀌어도 즉시 따라가지 않음)
  const leftPanelTitle = (language === 'ko' && lastAnalyzedTopic)
    ? `${withSubjectParticle(lastAnalyzedTopic)} 뭐냐면...`
    : t.mainCardTitle;

  // 1차 구조 개편: 왼쪽 '대화' 탭은 제거하고 우하단 플로팅 챗봇으로 이동했다.
  // 2차 구조 개편: '조사 원본자료' / '쉬운설명' 2탭으로 재구성 — 대화 탭은 다시 만들지 않는다.
  const renderLeftPanelTabs = () => (
    <div style={styles.leftPanelTabs}>
      <button
        data-testid="left-panel-tab-source"
        style={{ ...styles.leftPanelTab, ...(leftPanelTab === 'source' ? styles.leftPanelTabActive : {}) }}
        onClick={() => setLeftPanelTab('source')}
      >
        {t.sourceTab}
      </button>
      <button
        data-testid="left-panel-tab-easy"
        style={{ ...styles.leftPanelTab, ...(leftPanelTab === 'easy' ? styles.leftPanelTabActive : {}) }}
        onClick={() => setLeftPanelTab('easy')}
      >
        {t.easyTab}
      </button>
    </div>
  );

  const renderSavedTopicChips = () => (
    savedTopics.length > 0 ? (
      <div style={styles.chipsWrap}>
        <span style={{ fontSize: 13, flexShrink: 0 }}>📂</span>
        {savedTopics.map(({ topic: t }) => (
          <span key={t} style={{ ...styles.savedTopicItem, ...(t === topic ? styles.savedTopicItemActive : {}) }}>
            <button
              style={{ ...styles.chip, ...(t === topic ? styles.chipActive : {}) }}
              onClick={() => handleLoadSession(t)}
              title={`"${t}" ${getUiText(language).loadTitle}`}
            >
              {t}
            </button>
            <button
              type="button"
              aria-label={`${t} 조사 기록 삭제`}
              title={`${t} 조사 기록 삭제`}
              style={{ ...styles.deleteChipBtn, ...(t === topic ? styles.deleteChipBtnActive : {}) }}
              onClick={() => handleDeleteSession(t)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    ) : null
  );

  const renderHeaderActions = () => (
    <div style={styles.headerActions}>
      <button
        type="button"
        data-testid="reopen-app-tutorial-button"
        style={styles.tutorialHelpBtn}
        onClick={startAppUsageTutorial}
      >
        {activeTutorialText.reopen}
      </button>
      <button style={styles.goHomeBtn} onClick={handleGoHome}>
        {t.goHome}
      </button>
    </div>
  );

  // ── 레이아웃 ──
  const layoutStyle = (canvasOpen && !isMobile)
    ? (isStacked
      ? styles.stackedResultsLayout
      : (isCompact ? styles.splitLayoutCompact : styles.splitLayout))
    : styles.centeredLayout;

  const openResearchTutorial = () => {
    setAppTutorialOpen(false);
    setTutorialStep(0);
    setTutorialOpen(true);
  };

  // 좌우 순서만 바뀌므로 같은 엘리먼트를 재사용한다.
  const researchCompassEl = (
    <ResearchCompass isMobile={isMobile} onReopenTutorial={openResearchTutorial} />
  );
  const recommendedSourcesEl = <RecommendedSources isMobile={isMobile} />;

  // 첫 화면(랜딩)에서만 메인 입력 카드 맨 위에 얹는 로고+설명 — 독립 상단 히어로 영역 대체
  const cardLogoSlot = showLanding ? (
    <div>
      <h1 style={{ margin: 0, lineHeight: 0 }}>
        <Image
          src={titleLogo}
          alt="뭐냐면"
          priority
          style={{ width: '100%', maxWidth: isMobile ? 200 : 240, height: 'auto', margin: '0 auto', display: 'block' }}
        />
      </h1>
      <p style={{ margin: '10px 0 0', fontSize: isMobile ? 14 : 15, fontWeight: 700, color: 'var(--color-text)' }}>
        {t.bannerSubtitle}
      </p>
      <p style={{ margin: '2px 0 0', fontSize: isMobile ? 12 : 13, color: 'var(--color-text-sub)' }}>
        {t.bannerDescription}
      </p>
    </div>
  ) : null;

  const leftColEl = (
    <div style={styles.leftCol} data-testid="left-panel">

              {/* 기본 설정 카드 */}
              {leftPanelTab === 'source' && (
              <SectionCard
                title={leftPanelTitle} icon="" isMobile={isMobile}
                actions={renderHeaderActions()}
                topSlot={cardLogoSlot}
              >
                {renderSavedTopicChips()}
                {!showLanding && renderLeftPanelTabs()}

                {/* 조사 주제 + 언어 선택 */}
                <div style={isMobile ? styles.topicRowMobile : styles.topicRow}>
                  <div style={styles.topicCol}>
                    <label style={styles.label}>{t.topicLabel}</label>
                    <input
                      data-testid="topic-input"
                      aria-label={t.topicLabel}
                      style={{ ...styles.input, ...(isMobile ? styles.inputMobile : {}) }}
                      value={topic}
                      onChange={e => setTopic(e.target.value)}
                      placeholder={t.topicPlaceholder}
                    />
                  </div>
                  <div style={styles.languageInlineCol}>
                    <label style={styles.label}>language</label>
                    <select
                      style={{ ...styles.languageBarSelect, width: '100%', ...(isMobile ? styles.inputMobile : {}) }}
                      value={language}
                      onChange={e => handleLanguageChange(e.target.value)}
                    >
                      {LANGUAGE_OPTIONS.map(option => (
                        <option key={option.code} value={option.code}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 조사자료 */}
                <div style={styles.formGroup}>
                  <div style={styles.sourceLabelRow}>
                    <label style={styles.label}>{t.sourceLabel}</label>
                    <SignTextReader isMobile={isMobile} onExtracted={handleSignTextExtracted} t={t} demoMode={demoMode} />
                  </div>
                  <textarea
                    data-testid="source-textarea"
                    aria-label={t.sourceLabel}
                    style={{ ...styles.textarea, ...(isMobile ? styles.textareaMobile : {}) }}
                    value={sourceText}
                    onChange={e => setSourceText(e.target.value)}
                    placeholder={t.sourcePlaceholder}
                  />
                </div>

                {/* 분석 실패 원인 — 빈 결과 안내에 덮이지 않도록 입력 카드에서 바로 보여준다 */}
                {analysisError && (
                  <div role="alert" data-testid="analysis-error" style={styles.analysisErrorBox}>
                    ⚠️ {analysisError}
                  </div>
                )}

                {/* 긴 자료 안내 — 오류가 아니라 계속 진행 중이라는 알림 */}
                {!analysisError && analysisNotice && (
                  <div role="status" data-testid="analysis-notice" style={styles.analysisNoticeBox}>
                    ℹ️ {analysisNotice}
                  </div>
                )}

                {/* 버튼 행 */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    data-testid="analyze-button"
                    style={{ ...styles.primaryBtn, ...(isMobile ? styles.primaryBtnMobile : {}), position: 'relative', overflow: 'hidden' }}
                    onClick={handleAnalyze}
                    disabled={isBusy}
                  >
                    {loadingMode === 'understand' && <span className="tool-fill-bar-light" />}
                    {loadingMode !== null ? t.analyzing : t.analyze}
                  </button>

                  {/* 캔버스 재오픈 버튼 */}
                  {!canvasOpen && hasAnyResult && (
                    <button
                      style={{ ...styles.reopenBtn, ...(isMobile ? styles.primaryBtnMobile : {}) }}
                      onClick={() => setCanvasOpen(true)}
                    >
                      {t.reopenResults}
                    </button>
                  )}
                </div>
              </SectionCard>
              )}

              {/* 쉬운설명 — 오른쪽에서 탐구/발표/글쓰기 활동을 하는 동안 참고하는 패널 */}
              {leftPanelTab === 'easy' && (
              <div data-testid="tutorial-easy-explanation">
                <SectionCard
                  title={leftPanelTitle} icon="" isMobile={isMobile}
                  actions={renderHeaderActions()}
                >
                  {renderSavedTopicChips()}
                  {renderLeftPanelTabs()}
                  <EasyExplanationPanel
                    result={analysisByMode.understand}
                    isMobile={isMobile}
                    t={t}
                    isLoading={loadingMode === 'understand'}
                  />
                </SectionCard>
              </div>
              )}

              {/* 생각 워크시트 — 오른쪽 분석 결과를 가리지 않도록 왼쪽 패널(조사자료) 자리에 임베드 */}
              {leftPanelTab === 'worksheet' && (
                <div data-testid="worksheet-panel-section">
                  {renderSavedTopicChips()}
                  {renderLeftPanelTabs()}
                  <ThinkingWorksheetDrawer
                    variant="panel"
                    isOpen={true}
                    onClose={() => setLeftPanelTab('source')}
                    topic={lastAnalyzedTopic}
                    activeMode={activeMode}
                    notes={notes}
                    updateNote={updateNote}
                    saveStatus={saveStatus}
                    onShare={handleShare}
                    isMobile={isMobile}
                  />
                </div>
              )}

              {/* 함께 보면 좋은 영상 — 분석이 성공적으로 끝난 뒤에만 좌측 하단에 표시.
                  로딩 중·분석 실패 시에는 호출하지 않는다 (보조 기능). */}
              {canvasOpen && hasAnyResult && !analysisError && loadingMode === null && (!appTutorialOpen || usingAppTutorialPreset) && (
                <RecommendedVideos
                  topic={lastAnalyzedTopic || topic}
                  sourceText={sourceText}
                  gradeLevel={gradeLevel}
                  enabled={true}
                  demoMode={demoMode || usingAppTutorialPreset}
                  submissionMode={SUBMISSION_MODE}
                  demoVideos={demoMode
                    ? (demoSession?.recommendedVideos || [])
                    : (usingAppTutorialPreset ? APP_TUTORIAL_PRESET.recommendedVideos : [])}
                  allowEmbed={true}
                  t={t}
                  isMobile={isMobile}
                />
              )}
            </div>
  );

  const resultCanvasEl = canvasOpen && (
    <ResultCanvas
      activeMode={activeMode}
      onTabClick={handleTabClick}
      onClose={() => setCanvasOpen(false)}
      analysisByMode={analysisByMode}
      loadingMode={loadingMode}
      toolResults={toolResults}
      quizKey={quizKey}
      parsedQuiz={parsedQuiz}
      quizResult={quizResult}
      setQuizResult={setQuizResult}
      onQuiz={handleQuiz}
      onEvaluation={handleEvaluation}
      onTeacherComment={handleTeacherComment}
      isBusy={isBusy}
      loadingTool={loadingTool}
      notes={notes}
      updateNote={updateNote}
      saveStatus={saveStatus}
      handleShare={handleShare}
      onShareTutorialComplete={appTutorialOpen && activeAppTutorialScene?.id === 'share' ? finishAppUsageTutorial : undefined}
      isMobile={isMobile}
      isCompact={isCompact}
      isStacked={isStacked}
      onAskChatbotWithQuestion={handleAskChatbotWithQuestion}
      t={t}
      language={language}
      onLanguageChange={handleLanguageChange}
      topic={lastAnalyzedTopic}
      onOpenWorksheet={() => setLeftPanelTab('worksheet')}
      isWorksheetActive={leftPanelTab === 'worksheet'}
    />
  );

  return (
    <>
      <Head>
        <title>{t.appTitle}</title>
        <meta name="description" content={t.appDescription} />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        lang={language}
        style={{
          ...styles.page,
          ...(isRtl ? styles.pageRtl : {}),
          ...(isCompact ? styles.pageCompact : {}),
          ...(isMobile ? styles.pageMobile : {}),
        }}
      >
        <div style={styles.container}>
          {demoMode && (
            <div style={styles.demoBadge} data-testid="offline-demo-badge">
              {OFFLINE_REVIEWER_TUTORIAL_TEXT.badge}
            </div>
          )}
          {showLanding ? (
            isCompact && !isStacked ? (
              <div style={styles.landingCompact} data-testid="landing-compact">
                {/* 120%/125% 배율에서도 정보 구조(나침반 | 입력 | 추천 자료)를
                    유지한다. 양쪽 패널만 270px로 줄이고 가운데 입력 영역을 유동 폭으로 둔다. */}
                <ResearchCompass
                  isMobile={false}
                  isCompact
                  onReopenTutorial={openResearchTutorial}
                />
                <div style={styles.landingFormColMobile} data-testid="landing-form-column">
                  {leftColEl}
                </div>
                <RecommendedSources isMobile={false} isCompact />
              </div>
            ) : isStacked ? (
              <div style={styles.landingNarrow}>
                <div style={styles.landingFormColMobile}>{leftColEl}</div>
                <div style={styles.landingNarrowAux}>
                  <RecommendedSources isMobile={false} />
                  <ResearchCompass isMobile={false} onReopenTutorial={openResearchTutorial} />
                </div>
              </div>
            ) : (
              <div style={isMobile ? styles.landingStackMobile : styles.landingRow}>
                {/* 데스크톱은 나침반(왼쪽) | 입력 | 추천 자료(오른쪽) 3단이고,
                    두 패널은 340px로 같아 입력 폼이 정가운데에 온다.
                    모바일 세로 스택은 좌우가 없으므로 기존 순서를 그대로 둔다. */}
                {isMobile ? recommendedSourcesEl : researchCompassEl}
                {/* 모바일 세로 스택에서는 flex-basis(860px)가 높이로 적용되어
                    폼 아래 빈 공간을 만들므로 데스크톱에서만 쓴다. */}
                <div style={isMobile ? styles.landingFormColMobile : styles.landingFormCol}>
                  {leftColEl}
                </div>
                {isMobile ? researchCompassEl : recommendedSourcesEl}
              </div>
            )
          ) : (
            <div style={layoutStyle} data-testid="layout-grid">
              {leftColEl}
              {resultCanvasEl}
            </div>
          )}
        </div>

        {/* 우하단 플로팅 챗봇 — 일반 모드는 조사를 시작한 뒤부터, 데모는 첫 화면부터 snapshot 대화를 보여준다. */}
        {(demoMode || !showLanding) && (
          <FloatingChatbot
            isOpen={isChatPopupOpen}
            onOpen={() => setIsChatPopupOpen(true)}
            onClose={() => setIsChatPopupOpen(false)}
            conversation={conversation}
            chatInput={chatInput}
            setChatInput={setChatInput}
            onSend={handleFollowUpChat}
            isChatLoading={isChatLoading}
            isMobile={isMobile}
            topic={lastAnalyzedTopic || topic}
            t={t}
          />
        )}

        {/* 자료조사 방법 교육자료 — 사용법 마지막 과정의 버튼이나 나침반의 다시 보기로 연다. */}
        <ResearchTutorialQuest
          isOpen={tutorialOpen}
          step={tutorialStep}
          onNext={handleTutorialNext}
          onPrev={handleTutorialPrev}
          onSkip={handleTutorialSkip}
          onDontShowAgain={finishTutorial}
          onComplete={finishTutorial}
          onClose={handleTutorialSkip}
          isMobile={isMobile}
        />

        <AppUsageTutorial
          isOpen={appTutorialOpen}
          step={appTutorialStep}
          canAdvance={appTutorialCanAdvance}
          isBusy={appTutorialBusy}
          onNext={handleAppTutorialNext}
          onPrev={handleAppTutorialPrev}
          onSkip={skipAppUsageTutorial}
          onDontShowAgain={finishAppUsageTutorial}
          onClose={skipAppUsageTutorial}
          onResearchTips={demoMode ? undefined : handleAppTutorialResearchTips}
          onFillTopic={fillAppTutorialTopic}
          onFillSource={fillAppTutorialSource}
          topicExample={appTutorialTopicExample}
          sourceExample={appTutorialSourceExample}
          isMobile={isMobile}
          text={activeTutorialText}
          scenes={activeAppTutorialScenes}
          showDontShowAgain={!demoMode}
        />

        {/* 연구대회 심사용 시작화면 — 심사 모드에서만 기존 앱 위에 오버레이로 표시 */}
        {submissionStartOpen && (
          <SubmissionStartScreen
            isMobile={isMobile}
            onStart={handleSubmissionStart}
            onViewTutorial={handleSubmissionViewTutorial}
          />
        )}

        {demoApiNoticeOpen && (
          <div
            style={styles.demoApiModalOverlay}
            role="presentation"
            onClick={() => setDemoApiNoticeOpen(false)}
            data-testid="demo-api-modal"
          >
            <div
              style={{ ...styles.demoApiModalBox, ...(isMobile ? styles.demoApiModalBoxMobile : {}) }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="demo-api-modal-title"
              onClick={e => e.stopPropagation()}
            >
              <button
                type="button"
                style={styles.demoApiModalClose}
                aria-label="닫기"
                onClick={() => setDemoApiNoticeOpen(false)}
              >
                ×
              </button>
              <div style={styles.demoApiModalIcon}>!</div>
              <h2 id="demo-api-modal-title" style={styles.demoApiModalTitle}>
                온라인 프로그램 실행 필요
              </h2>
              <p style={styles.demoApiModalMessage}>{DEMO_API_FEATURE_NOTICE}</p>
              <div style={styles.demoApiModalActions}>
                <a
                  href={SUBMISSION_APP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.demoApiModalPrimary}
                  data-testid="demo-online-run-button"
                >
                  온라인 프로그램 실행
                </a>
                <button
                  type="button"
                  style={styles.demoApiModalSecondary}
                  onClick={() => setDemoApiNoticeOpen(false)}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── 유틸 ──
function getDemoSession(snapshot) {
  const session = snapshot?.session || {};
  const topic = snapshot?.topic || session.topic || '';
  return {
    topic,
    sourceText: session.sourceText || '',
    gradeLevel: session.gradeLevel || DEFAULT_STUDENT_LEVEL,
    language: session.language || 'ko',
    activeMode: ['understand', 'inquiry', 'presentation', 'writing'].includes(session.activeMode)
      ? session.activeMode
      : 'understand',
    conversation: session.conversation || [],
    notes: session.notes || snapshot?.notes || {},
    analysisByMode: session.analysisByMode || {},
    toolResults: session.toolResults || {},
    recommendedVideos: session.recommendedVideos || [],
  };
}

function mergeModeResults(analysisByMode = {}) {
  const base = INIT_BY_MODE();
  return {
    understand: { ...base.understand, ...(analysisByMode.understand || {}) },
    inquiry: { ...base.inquiry, ...(analysisByMode.inquiry || {}) },
    presentation: { ...base.presentation, ...(analysisByMode.presentation || {}) },
    writing: { ...base.writing, ...(analysisByMode.writing || {}) },
  };
}

function hasAnyAnalysisResult(analysisByMode = {}) {
  return Object.values(analysisByMode).some(r =>
    r?.easy || r?.understandingSentence || r?.summaryLines?.length || r?.keywordLines?.length ||
    r?.inquiryQuestions ||
    r?.presentationTitle || r?.presentationMessages || r?.writingOutline
  );
}

function cleanConversation(messages, fallbackText = getUiText('ko')) {
  if (!Array.isArray(messages) || messages.length === 0) return [makeInitialMessage(fallbackText)];

  const cleaned = messages.filter(msg => {
    const content = msg?.content || '';
    if (content.includes('나는 조사자료를 쉽게 바꿔 주는 사회과 학습 도우미')) return false;
    if (content.includes('지금 선택한 모드에 맞게 결과를 정리했어')) return false;
    if (content.includes('이해 탭에 결과를 정리했어')) return false;
    if (/^조사주제는\s+'.+'\s*이?야[\.\s]*자료를\s*분석해줘/.test(content)) return false;
    return true;
  });

  return cleaned.length > 0 ? cleaned : [makeInitialMessage(fallbackText)];
}

// ── 상수 ──
const makeInitialMessage = (t) => ({
  role: 'assistant',
  content: t.initialMessage
});

const EMPTY_MODE_RESULT = {
  easy: '', summaryLines: [], keywordLines: [], vocabularyLines: [],
  questionLines: [], searchLines: [], reteachLines: [], furtherLines: [],
  understandingSentence: '', understandingVocabulary: '', understandingReading: '',
  understandingChecklistLines: [], understandingMisconceptionLines: [],
  understandingCheckLines: [], understandingQuiz: null, inquiryQuestions: '', inquiryRefine: '',
  inquiryClues: '', inquiryCompare: '', inquiryEvidenceInference: '',
  inquirySearches: '', inquiryCard: '',
  presentationTitle: '', presentationScriptLines: [], presentationOrderLines: [],
  presentationMessages: '', presentationAudienceLines: [], presentationFlow: '',
  presentationEvidenceLines: [], presentationQuestions: '', presentationVisualPlan: '',
  presentationTemplateLines: [], presentationChecklistLines: [],
  expectedQuestionLines: [], writingOutline: '', writingTopicSentences: '',
  writingSupportDirections: '', writingEvidenceLines: [], writingTemplateLines: [],
  writingChecklistLines: []
};

const EMPTY_TOOLS = { quiz: '', evaluation: '', teacher: '' };

const INIT_BY_MODE = () => ({
  understand:   { ...EMPTY_MODE_RESULT },
  inquiry:      { ...EMPTY_MODE_RESULT },
  presentation: { ...EMPTY_MODE_RESULT },
  writing:      { ...EMPTY_MODE_RESULT }
});

/** =========================
 *  스타일
 *  ========================= */
const styles = {
  page:      { minHeight: '100vh', background: 'linear-gradient(180deg, var(--color-bg) 0%, var(--color-surface-alt) 45%, var(--color-bg) 100%)', padding: '24px 16px 48px' },
  pageRtl:   { textAlign: 'right' },
  pageCompact: { padding: '16px 12px 36px' },
  pageMobile: { padding: '16px 10px 32px' },
  container: { width: '100%', maxWidth: 1680, margin: '0 auto', boxSizing: 'border-box' },
  demoBadge: {
    width: 'fit-content', maxWidth: '100%', margin: '0 auto 12px',
    border: '1px solid rgba(var(--color-primary-rgb),0.25)',
    background: 'rgba(var(--color-primary-rgb),0.08)', color: 'var(--color-primary-dark)',
    borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 800,
  },
  demoApiModalOverlay: {
    position: 'fixed', inset: 0, zIndex: 500,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 18, background: 'rgba(31, 42, 68, 0.36)',
  },
  demoApiModalBox: {
    width: 'min(420px, 100%)', position: 'relative',
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 18, padding: '30px 26px 24px',
    boxShadow: '0 18px 48px rgba(31, 42, 68, 0.22)',
    textAlign: 'center',
  },
  demoApiModalBoxMobile: { padding: '28px 20px 22px' },
  demoApiModalClose: {
    position: 'absolute', top: 10, right: 10,
    width: 30, height: 30, border: '1px solid var(--color-border)',
    borderRadius: 8, background: 'var(--color-surface)',
    color: 'var(--color-text-sub)', cursor: 'pointer',
    fontSize: 18, fontWeight: 800, lineHeight: 1,
  },
  demoApiModalIcon: {
    width: 38, height: 38, margin: '0 auto 12px',
    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(var(--color-primary-rgb),0.10)',
    color: 'var(--color-primary-dark)', fontSize: 22, fontWeight: 900,
  },
  demoApiModalTitle: {
    margin: 0, color: 'var(--color-primary-dark)',
    fontSize: 19, fontWeight: 900, lineHeight: 1.35,
  },
  demoApiModalMessage: {
    margin: '10px 0 0', color: 'var(--color-text)',
    fontSize: 14, fontWeight: 700, lineHeight: 1.7,
  },
  demoApiModalActions: {
    display: 'flex', gap: 8, justifyContent: 'center',
    flexWrap: 'wrap', marginTop: 20,
  },
  demoApiModalPrimary: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    textDecoration: 'none', border: 'none', borderRadius: 12,
    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
    color: 'var(--color-surface)', fontSize: 13, fontWeight: 900,
    padding: '11px 18px', cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(var(--color-primary-rgb),0.24)',
  },
  demoApiModalSecondary: {
    border: '1.5px solid var(--color-border)', borderRadius: 12,
    background: 'var(--color-surface)', color: 'var(--color-text-sub)',
    fontSize: 13, fontWeight: 900, padding: '10px 16px', cursor: 'pointer',
  },
  languageBarSelect: {
    minWidth: 180, border: '1px solid var(--color-border)', borderRadius: 12,
    padding: '10px 12px', fontSize: 12, outline: 'none', background: 'var(--color-surface)', boxSizing: 'border-box',
  },

  centeredLayout: { maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 },
  splitLayout:    { display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 20, alignItems: 'start' },
  splitLayoutCompact: {
    display: 'grid', gridTemplateColumns: 'minmax(430px, 0.85fr) minmax(0, 1.15fr)',
    gap: 14, alignItems: 'start', minWidth: 0,
  },
  stackedResultsLayout: {
    width: '100%', maxWidth: 960, margin: '0 auto',
    display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0,
  },

  // 랜딩 화면 전용 — 추천 원본자료 사이드바 + 자료입력 폼
  landingRow:         { display: 'flex', gap: 28, alignItems: 'stretch', justifyContent: 'center', flexWrap: 'wrap' },
  landingStackMobile: { display: 'flex', flexDirection: 'column', gap: 18 },
  landingCompact: {
    width: '100%', margin: '0 auto',
    display: 'grid', gridTemplateColumns: '270px minmax(0, 1fr) 270px',
    alignItems: 'start', gap: 14, minWidth: 0,
  },
  landingNarrow: {
    width: '100%', maxWidth: 960, margin: '0 auto',
    display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0,
  },
  landingNarrowAux: {
    display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 340px))',
    justifyContent: 'center', alignItems: 'start', gap: 18, minWidth: 0,
  },
  landingFormCol:       { flex: '0 1 860px', minWidth: 0 },
  landingFormColMobile: { width: '100%' },

  leftCol: { display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 },
  leftPanelTabs: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
    background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
    borderRadius: 16, padding: 7, marginBottom: 18,
  },
  leftPanelTab: {
    minHeight: 48, border: '1px solid var(--color-border)',
    background: 'var(--color-surface)', color: 'var(--color-text-sub)',
    borderRadius: 12, padding: '11px 14px', cursor: 'pointer',
    fontWeight: 900, fontSize: 15, lineHeight: 1.3,
    boxShadow: '0 2px 7px rgba(var(--color-text-rgb),0.08)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
  },
  leftPanelTabActive: {
    borderColor: 'var(--color-primary)',
    background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
    color: 'var(--color-surface)',
    boxShadow: '0 6px 16px rgba(var(--color-primary-rgb),0.3)',
  },

  formGroup: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 },
  label:     { fontWeight: 700, color: 'var(--color-text)', fontSize: 14 },
  sourceLabelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },

  // 조사 주제 입력칸 + 언어 선택 — 같은 줄에 나란히 배치
  topicRow:          { display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'flex-end', marginBottom: 16 },
  topicRowMobile:    { display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 },
  topicCol:          { display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 },
  languageInlineCol: { display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, minWidth: 160 },

  input: {
    width: '100%', border: '1px solid var(--color-border)', borderRadius: 12,
    padding: '12px 14px', fontSize: 15, outline: 'none', boxSizing: 'border-box'
  },
  inputMobile: { fontSize: 16, padding: '12px' },
  select: {
    width: '100%', border: '1px solid var(--color-border)', borderRadius: 12,
    padding: '12px 14px', fontSize: 15, outline: 'none', background: 'var(--color-surface)', boxSizing: 'border-box'
  },
  textarea: {
    width: '100%', minHeight: 200, border: '1px solid var(--color-border)', borderRadius: 14,
    padding: '14px 16px', fontSize: 15, lineHeight: 1.7, resize: 'vertical',
    outline: 'none', boxSizing: 'border-box'
  },
  textareaMobile: { minHeight: 160, fontSize: 16, padding: '12px' },

  analysisErrorBox: {
    background: '#fff5f5', border: '1px solid #fecaca', color: '#b91c1c',
    borderRadius: 12, padding: '12px 14px', fontSize: 14, lineHeight: 1.6,
    marginBottom: 12, wordBreak: 'keep-all',
  },
  analysisNoticeBox: {
    background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8',
    borderRadius: 12, padding: '12px 14px', fontSize: 14, lineHeight: 1.6,
    marginBottom: 12, wordBreak: 'keep-all',
  },

  primaryBtn: {
    border: 'none', background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
    color: 'var(--color-surface)', fontWeight: 800, padding: '12px 20px', borderRadius: 12,
    cursor: 'pointer', boxShadow: '0 10px 24px rgba(var(--color-primary-rgb),0.22)', fontSize: 12,
  },
  primaryBtnMobile: { width: '100%', fontSize: 12, padding: '13px 14px' },

  reopenBtn: {
    border: '2px solid var(--color-primary)', background: 'rgba(var(--color-primary-rgb),0.08)', color: 'var(--color-primary-dark)',
    fontWeight: 800, padding: '12px 20px', borderRadius: 12,
    cursor: 'pointer', fontSize: 12,
  },

  chipsWrap: {
    display: 'flex', alignItems: 'center', gap: 5,
    flexWrap: 'wrap',
    width: '100%', marginBottom: 12,
  },
  savedTopicItem: {
    display: 'inline-flex', alignItems: 'center',
    border: '1.5px solid rgba(var(--color-primary-rgb),0.3)',
    background: 'rgba(var(--color-primary-rgb),0.08)',
    borderRadius: 20, overflow: 'hidden', flexShrink: 0,
  },
  savedTopicItemActive: {
    border: '1.5px solid var(--color-primary)',
    background: 'var(--color-primary)',
  },
  chip: {
    border: 'none', background: 'transparent', color: 'var(--color-primary-dark)',
    fontSize: 12, fontWeight: 800, padding: '5px 9px 5px 12px', borderRadius: 0,
    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s'
  },
  chipActive: { color: 'var(--color-surface)' },
  deleteChipBtn: {
    width: 24, alignSelf: 'stretch', border: 'none',
    borderLeft: '1px solid rgba(var(--color-primary-rgb),0.22)',
    background: 'rgba(var(--color-surface-rgb),0.45)', color: 'var(--color-text-sub)',
    fontSize: 15, fontWeight: 900, lineHeight: 1, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  deleteChipBtnActive: {
    borderLeft: '1px solid rgba(255,255,255,0.35)',
    background: 'rgba(255,255,255,0.16)', color: 'var(--color-surface)',
  },

  headerActions: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  tutorialHelpBtn: {
    border: '1px solid rgba(var(--color-accent-teal-rgb),0.45)',
    background: 'rgba(var(--color-accent-teal-rgb),0.1)', color: 'var(--color-primary-dark)',
    borderRadius: 9, padding: '7px 10px', fontSize: 12.5, fontWeight: 800,
    whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
  },
  goHomeBtn: {
    border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-sub)',
    fontSize: 12, fontWeight: 800, padding: '5px 12px', borderRadius: 20,
    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s',
  },
};
