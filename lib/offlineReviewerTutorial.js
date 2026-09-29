// 국내 연구대회 심사위원이 보는 오프라인 시연 전용 문구다. 언어 변경은 온라인
// 실행 안내로 연결되므로, 학생용 다국어 사용법 사전과 섞지 않고 한국어로 고정한다.
export const OFFLINE_REVIEWER_YOUTUBE_SCENE = {
  id: 'recommendedVideos',
  chapter: 4,
  selector: '[data-testid="recommended-videos"]',
  contentKey: 'recommendedVideos',
};

export const OFFLINE_REVIEWER_CHAT_SAFETY_SCENE = {
  id: 'chatSafety',
  chapter: 5,
  substep: 3,
  substepTotal: 3,
  selector: '[data-testid="chatbot-popup"]',
  contentKey: 'chatSafety',
};

export const OFFLINE_REVIEWER_TUTORIAL_TEXT = {
  name: '심사위원용 기능 안내',
  reopen: '🎓 심사위원 기능 안내',
  badge: '오프라인 심사 시연 · API 호출 없이 저장된 강화 고인돌 자료로 전체 기능을 체험합니다',
  processLabel: '심사위원 기능 안내',
  modeLabel: '학습 모드',
  substepLabel: '기능',
  skip: '시연 닫기',
  previous: '이전 기능',
  next: '다음 기능',
  finish: '시연 마치기',
  dontShowAgain: '다시 보지 않기',
  waiting: '안내할 기능 화면을 준비하고 있습니다.',
  useHighlighted: '밝게 표시된 실제 기능을 눌러 다음 장면으로 이동해 주세요.',
  preparing: '기능 준비 중…',
  close: '닫기',
  scenes: {
    topic: {
      title: '1. 조사 주제 입력 기능',
      body: '조사 주제를 명확히 입력해 AI 분석의 맥락을 설정하는 단계입니다. 오프라인 시연에서는 강화 고인돌 예시를 자동 타이핑해 실제 입력 흐름을 보여드립니다.',
      requirement: '조사 주제가 입력되면 다음 기능으로 이동합니다.',
    },
    source: {
      title: '2. 조사 원본자료 입력 기능',
      body: '박물관 안내문·교과서·공공기관 자료 등 원문을 그대로 붙여넣는 영역입니다. 원문은 보존하고, 이후 학생 수준에 맞춘 재구성의 기준 자료로 사용합니다.',
      requirement: '조사 원본자료가 입력되면 다음 기능으로 이동합니다.',
    },
    analyze: {
      title: '3. AI 학습자료 분석 기능',
      body: '온라인에서는 입력 자료를 바탕으로 AI가 네 학습 모드의 사고 발판을 생성합니다. 이번 오프라인 시연은 API를 호출하지 않고 저장된 분석 결과를 즉시 불러옵니다.',
    },
    easyExplanation: {
      title: '원문 접근성을 높이는 쉬운 설명',
      body: '원본과 쉬운 설명을 함께 제공해 자료 접근성을 높입니다. 밑줄 낱말 풀이와 교사가 승인한 공공 채널 추천 영상으로 이해를 보조합니다.',
    },
    recommendedVideos: {
      title: '공식·교육 채널 기반 YouTube 추천',
      body: '조사 주제와 관련된 영상을 교사가 승인한 공공·교육 채널 안에서만 추천합니다. 오프라인 시연에서는 저장된 강화 고인돌 영상 목록을 API 호출 없이 보여 주며, 제출물에는 영상·썸네일을 저장하지 않습니다.',
    },
    understand: {
      title: '이해 모드: 자기 말로 확인하기',
      body: '핵심 내용과 오개념을 확인한 뒤 학생이 자기 말로 답하는 워크시트입니다. AI 답을 복사하는 대신 자료를 제대로 이해했는지 직접 점검하게 합니다.',
      requirement: '이해 워크시트의 구성을 확인합니다.',
    },
    inquiry: {
      title: '탐구 모드: 질문에서 탐구 시작하기',
      body: '학생이 탐구 질문을 고르고 챗봇보다 먼저 자신의 생각과 까닭을 기록합니다. 질문 생성은 사고를 대신하지 않고 탐구를 시작하는 발판으로 작동합니다.',
      requirement: '탐구 워크시트의 구성을 확인합니다.',
    },
    presentation: {
      title: '발표 준비: 자기 말로 표현하기',
      body: '완성 대본을 제공하지 않고 핵심 메시지·발표 흐름·예상 질문을 구조화합니다. 학생이 자기 말로 발표하도록 돕는 준비 워크시트입니다.',
      requirement: '발표 준비 워크시트의 구성을 확인합니다.',
    },
    writing: {
      title: '글쓰기 준비: 생각을 구조화하기',
      body: '완성 글 대신 중심문장·근거·처음-가운데-끝 개요를 제공합니다. 학생이 직접 글을 완성하도록 쓰기 전 사고를 구조화합니다.',
      requirement: '글쓰기 준비 워크시트의 구성을 확인합니다.',
    },
    chatbotOpen: {
      title: '5. 학습 맥락을 잇는 AI 챗봇',
      body: '현재 조사 주제와 자료 맥락을 유지하는 플로팅 AI 도우미입니다. 어느 학습 모드에서도 화면을 가리지 않고 후속 질문을 이어 갈 수 있습니다.',
    },
    chatbotAsk: {
      title: '후속 질문과 안전한 대화 흐름',
      body: '온라인에서는 주제 관련성을 확인한 뒤 답변하며, 스트리밍 차단 환경에는 비스트리밍 대체 경로를 사용합니다. 오프라인에서는 저장된 대화 예시로 기능을 확인합니다.',
      requirement: '저장된 대화 예시와 질문 입력 영역을 확인합니다.',
    },
    chatSafety: {
      title: '주제 이탈 질문을 안전하게 되돌리는 장치',
      body: '학생이 “유명한 걸그룹이 고인돌에 가봤다는데…”라고 물어도 아이돌 관련 질문에는 답하지 않고, 강화 고인돌의 모습·종류·세계문화유산이라는 조사 맥락으로 대화를 되돌립니다. 밝게 표시된 대화창의 마지막 문답에서 실제 작동 예시를 확인할 수 있습니다.',
      requirement: '주제 이탈 질문과 조사 주제로 되돌리는 답변을 확인합니다.',
    },
    share: {
      title: '6. 학생 중심 학습산출물 공유',
      body: 'AI 분석 결과가 아니라 학생이 네 워크시트에 직접 작성한 내용을 중심으로 공유 링크를 만듭니다. 표현과 성찰의 주체가 학생에게 남도록 설계했습니다.',
    },
  },
};
