// 교사용 설정 화면(/teacher) 문구. 교사용 화면은 share.js처럼 한국어로 고정한다.
// 학생이 보는 학급 코드 입력 창 문구는 lib/i18n.js의 classAccess에 있다.

const ERRORS = {
  billing_required: 'API 사용 가능 잔액이나 한도가 부족해요. OpenAI 계정의 결제와 사용 한도를 확인해 주세요.',
  missing_key: '먼저 선택한 AI의 API 키를 설정해 주세요.',
  invalid_key: '선택한 AI의 API 키를 확인할 수 없어요. 키를 다시 확인해 주세요.',
  quota_exceeded: '오늘 쓸 수 있는 무료 사용량을 모두 썼어요. 내일 다시 시도해 주세요.',
  rate_limited: '지금 요청이 많아요. 잠시 후 다시 시도해 주세요.',
  unavailable: 'AI 서비스가 잠시 응답하지 않아요. 잠시 후 다시 시도해 주세요.',
  network: '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.',
  invalid_request: '학교 이름을 한글·영문·숫자로 1~20자 입력해 주세요.',
  class_code_invalid: '이 학급을 찾을 수 없어요. 이미 만료되었거나 삭제된 코드예요.',
  class_unavailable: '학급 저장소가 준비되지 않았어요. 운영 설정(Upstash, CLASS_KEY_SECRET)을 확인해 주세요.',
  forbidden: '이 학급을 관리할 권한이 없어요. 학급을 만든 기기에서 관리해 주세요.',
  too_many_attempts: '요청을 너무 여러 번 보냈어요. 잠시 후 다시 시도해 주세요.',
};

export const TEACHER_TEXT = {
  pageTitle: '뭐냐면 교사용 설정',
  heading: '교사용 설정',
  lead: '선생님의 Gemini 또는 OpenAI API 키로 오늘 쓸 학급 코드를 만들어요. 학생은 학급 코드만 넣고 AI 기능을 쓰며, 학생 화면에는 키가 보이지 않아요.',
  backToStudent: '← 학생 화면으로',
  offlineNotice: '오프라인 시연에서는 교사용 설정을 쓸 수 없어요. 온라인 프로그램에서 이용해 주세요.',
  openaiNotice: '이 배포는 서버 키를 쓰는 OpenAI 모드라 학급 코드가 필요 없어요.',

  providerLabel: '사용할 AI',
  keySection: '① Gemini API 키',
  openaiKeySection: '① OpenAI API 키',
  keyNone: '아직 이 기기에 키가 없어요.',
  keySaved: '이 기기에 저장된 키',
  keyOpen: '키 설정',
  keyChange: '키 바꾸기',

  classSection: '② 오늘의 학급 코드 만들기',
  schoolLabel: '학교 이름',
  schoolPlaceholder: '예) 해원초',
  schoolHint: '한글·영문·숫자만 쓸 수 있어요. 코드는 "학교이름-숫자4자리"로 만들어져요.',
  create: '학급 코드 만들기',
  creating: '만드는 중…',
  needKeyFirst: '먼저 ① 선택한 AI의 API 키를 설정해 주세요.',
  created: '학급 코드를 만들었어요. 학생들에게 알려 주세요.',

  listSection: '이 기기에서 만든 학급',
  listEmpty: '오늘 만든 학급 코드가 없어요.',
  expiresTonight: '오늘 밤 12시(한국 시간)에 만료',
  copy: '코드 복사',
  copied: '복사했어요',
  rotateKey: '지금 키로 교체',
  rotated: '이 학급의 키를 지금 설정된 키로 바꿨어요.',
  reissue: '코드 재발급',
  reissued: '새 코드를 만들고 이전 코드는 지웠어요.',
  remove: '학급 삭제',
  removeConfirm: '이 학급 코드를 지울까요? 학생들은 더 이상 이 코드로 AI를 쓸 수 없어요.',
  removed: '학급을 삭제했어요.',
  working: '처리 중…',

  noticeTitle: '알아 두세요',
  notices: [
    '키는 이 기기(브라우저)에 저장돼요. 학교 공용 PC에서는 다 쓴 뒤 ① 키 설정에서 [키 삭제]를 눌러 주세요.',
    '학급 코드를 만들면 키를 암호화해 서버 저장소에 오늘 밤 12시까지만 보관해요. 학생 요청을 처리할 때만 서버에서 풀어 써요.',
    '학급 삭제를 누르면 저장소에서 키와 코드가 바로 지워져요.',
    '한 학급의 모든 학생이 선생님 계정의 사용량과 비용을 함께 써요.',
    '학급 관리는 학급을 만든 이 기기에서만 할 수 있어요.',
  ],

  // 교사 화면에서 재사용하는 키 설정 창(components/AiKeySettingsDialog.js) 문구
  keyDialog: {
    title: 'Gemini API 키 설정',
    intro: '학급 코드를 만들려면 Google AI Studio에서 받은 Gemini API 키가 필요해요.',
    notes: [
      '입력한 키는 이 기기(브라우저)에 저장돼요. 학생 화면에는 보이지 않아요.',
      '학급 코드를 만들 때만 키를 암호화해 서버에 오늘 밤 12시까지 보관해요.',
      '학교 공용 PC에서는 다 쓴 뒤 꼭 [키 삭제]를 눌러 주세요.',
      '연결 확인이 끝나기 전에는 키 전체를 화면에 다시 보여주지 않아요.',
    ],
    issueLink: 'Google AI Studio에서 키 발급받기',
    inputLabel: 'Gemini API 키',
    inputPlaceholder: '발급받은 키를 붙여 넣으세요',
    show: '보기',
    hide: '숨기기',
    rememberLabel: '이 기기에 저장',
    rememberHint: '선택하지 않으면 이 창(탭)을 닫을 때 키가 지워져요.',
    verify: '연결 확인',
    verifying: '확인 중…',
    later: '나중에 설정',
    delete: '키 삭제',
    close: '닫기',
    savedLabel: '저장된 키',
    savedOnDevice: '이 기기에 저장됨',
    savedInSession: '이 창에서만 사용 중',
    statusSuccess: '연결되었어요. 이제 학급 코드를 만들 수 있어요.',
    statusDeleted: '키를 삭제했어요.',
    emptyInput: '키를 먼저 입력해 주세요.',
    errors: ERRORS,
  },

  errors: ERRORS,
};

export function getTeacherKeyText(provider) {
  if (provider !== 'openai') return TEACHER_TEXT.keyDialog;
  return {
    ...TEACHER_TEXT.keyDialog,
    title: 'OpenAI API 키 설정',
    intro: 'OpenAI에서 발급한 API 키를 넣어 주세요. ChatGPT 구독과 API 사용료는 별개이며, API 사용료가 발생할 수 있어요.',
    issueLink: 'OpenAI에서 키 발급받기',
    inputLabel: 'OpenAI API 키',
  };
}
