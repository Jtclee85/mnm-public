// 난이도 조정: 딱딱한 유형명 대신 쉬운 이름을 배지로 보여 준다.
// 이전 저장 세션의 '사실 확인형' 같은 옛 라벨도 아래 정규화를 거쳐 새 이름으로 표시된다.
const TYPE_LABELS = ['사실 찾기', '비교하기', '까닭 생각하기', '뜻 생각하기', '더 생각하기'];

const stripBullet = (line) => line.replace(/^[-•*]\s*/, '').trim();

function normalizeType(type = '') {
  const clean = type.replace(/질문$/, '').trim();
  if (/사실/.test(clean)) return '사실 찾기';
  if (/비교/.test(clean)) return '비교하기';
  if (/까닭|원인|이유/.test(clean)) return '까닭 생각하기';
  if (/의미|해석|뜻/.test(clean)) return '뜻 생각하기';
  if (/생각|확장|가치/.test(clean)) return '더 생각하기';
  return clean || '추천 질문';
}

function parseTypedQuestions(text, fallbackLines = []) {
  const source = text || (fallbackLines || []).join('\n');
  if (!source) return [];

  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const questions = [];
  let currentType = '';

  for (const rawLine of lines) {
    const line = stripBullet(rawLine);
    const heading = line.match(/^###\s*(?:\d+\.\s*)?(.+)$/);
    if (heading) {
      currentType = normalizeType(heading[1].replace(/[:：].*$/, ''));
      const headingQuestion = heading[1].match(/[:：]\s*(.+)$/);
      if (headingQuestion) questions.push({ type: currentType, question: headingQuestion[1].trim() });
      continue;
    }

    const bracket = line.match(/^\[([^\]]+)\]\s*(.+)$/);
    if (bracket) {
      questions.push({ type: normalizeType(bracket[1]), question: bracket[2].trim() });
      continue;
    }

    const typed = line.match(/^(.+?형)\s*[:：]\s*(.+)$/);
    if (typed) {
      questions.push({ type: normalizeType(typed[1]), question: typed[2].trim() });
      continue;
    }

    const question = line.match(/^질문\s*[:：]\s*(.+)$/);
    if (question) {
      questions.push({ type: normalizeType(currentType), question: question[1].trim() });
      continue;
    }

    if (/[?？]$/.test(line)) questions.push({ type: normalizeType(currentType), question: line });
  }

  return questions
    .filter((item) => item.question)
    .slice(0, 6)
    .map((item, idx) => ({
      ...item,
      type: TYPE_LABELS.includes(item.type) ? item.type : (item.type || TYPE_LABELS[idx % TYPE_LABELS.length]),
    }));
}

export default function InquiryQuestionButtons({ text, fallbackLines = [], onQuestionAsk, isMobile, emptyText, selectedQuestion }) {
  const questions = parseTypedQuestions(text, fallbackLines);

  if (questions.length === 0) {
    return (
      <p style={{ margin: 0, color: 'var(--color-text-sub)', lineHeight: 1.7, fontSize: isMobile ? 14 : 15 }}>
        {emptyText}
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: isMobile ? 8 : 10 }}>
      {questions.map(({ type, question }, idx) => {
        const isSelected = !!selectedQuestion && selectedQuestion === question;
        return (
          <button
            key={`${type}-${question}-${idx}`}
            type="button"
            aria-pressed={isSelected}
            style={{ ...styles.button, ...(isSelected ? styles.buttonSelected : {}) }}
            onClick={() => onQuestionAsk?.(question, type)}
          >
            <span style={styles.badge}>{type}</span>
            <span style={styles.question}>{question}</span>
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  button: {
    width: '100%',
    border: '1px solid rgba(var(--color-primary-rgb),0.25)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    borderRadius: 8,
    padding: '11px 12px',
    cursor: 'pointer',
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: 10,
    alignItems: 'center',
    textAlign: 'left',
  },
  buttonSelected: {
    border: '1.5px solid var(--color-primary)',
    background: 'rgba(var(--color-primary-rgb),0.08)',
  },
  badge: {
    border: '1px solid rgba(var(--color-accent-teal-rgb),0.45)',
    background: 'rgba(var(--color-accent-teal-rgb),0.08)',
    color: 'var(--color-primary-dark)',
    borderRadius: 999,
    padding: '4px 8px',
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  question: {
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.55,
    overflowWrap: 'anywhere',
    wordBreak: 'keep-all',
  },
};
