import { useState } from 'react';
import { playCorrect, playWrong } from '../lib/sounds';
import { getUiText } from '../lib/i18n';

export default function QuizCard({ quizData, onReset, isMobile, onResult, t = getUiText('ko') }) {
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  if (!quizData) {
    return (
      <p style={{ ...styles.emptyText, ...(isMobile ? styles.emptyTextMobile : {}) }}>
        {t.noQuiz}
      </p>
    );
  }

  const correctIndex = Math.max(0, Number(quizData.answer) - 1);
  const isCorrect = selected === correctIndex;

  return (
    <div>
      <div style={{ ...styles.quizQuestion, ...(isMobile ? styles.quizQuestionMobile : {}) }}>
        {quizData.question || t.noQuestion}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
        {(quizData.options || []).map((option, idx) => {
          const isSelected = selected === idx;
          const isAnswer = submitted && idx === correctIndex;
          const isWrongSelected = submitted && isSelected && idx !== correctIndex;

          let background = 'var(--color-surface)';
          let border = 'var(--color-border)';
          let color = 'var(--color-text)';

          // 선택(브랜드 색) — 정답/오답 피드백은 의미 전달용이라 그대로 유지
          if (!submitted && isSelected) { background = 'rgba(var(--color-primary-rgb),0.08)'; border = 'var(--color-primary)'; color = 'var(--color-primary-dark)'; }
          if (isAnswer) { background = '#ecfdf5'; border = '#22c55e'; color = '#166534'; }
          if (isWrongSelected) { background = '#fef2f2'; border = '#ef4444'; color = '#991b1b'; }

          return (
            <button
              key={`${option}-${idx}`}
              type="button"
              disabled={submitted}
              onClick={() => setSelected(idx)}
              style={{
                ...styles.quizOptionButton,
                ...(isMobile ? styles.quizOptionButtonMobile : {}),
                background,
                borderColor: border,
                color,
                cursor: submitted ? 'default' : 'pointer'
              }}
            >
              <span style={{ fontWeight: 800, marginRight: 8 }}>{idx + 1}.</span>
              {option}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        {!submitted ? (
          <button
            type="button"
            style={{ ...styles.primaryButton, ...(isMobile ? styles.primaryButtonMobile : {}) }}
            disabled={selected === null}
            onClick={() => {
              const correct = selected === correctIndex;
              setSubmitted(true);
              onResult?.(correct ? 'correct' : 'incorrect');
              if (correct) playCorrect(); else playWrong();
            }}
          >
            {t.checkAnswer}
          </button>
        ) : (
          <button
            type="button"
            style={{ ...styles.secondaryButton, ...(isMobile ? styles.secondaryButtonMobile : {}) }}
            onClick={onReset}
          >
            {t.newQuiz}
          </button>
        )}
      </div>

      {submitted && (
        <div
          style={{
            marginTop: 16,
            padding: isMobile ? 12 : 14,
            borderRadius: 12,
            background: isCorrect ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${isCorrect ? '#22c55e' : '#ef4444'}`,
            color: isCorrect ? '#166534' : '#991b1b',
            fontSize: isMobile ? 14 : 15
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>
            {isCorrect ? t.correctMessage : t.incorrectMessage}
          </div>
          <div style={{ lineHeight: 1.7 }}>
            {t.correctAnswerPrefix} <strong>{correctIndex + 1}{t.correctAnswerSuffix}</strong>
            {quizData.explanation ? ` ${quizData.explanation}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  emptyText: { margin: 0, color: 'var(--color-text-sub)', lineHeight: 1.7 },
  emptyTextMobile: { fontSize: 14 },
  quizQuestion: { fontSize: 17, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.7 },
  quizQuestionMobile: { fontSize: 15 },
  quizOptionButton: {
    width: '100%',
    textAlign: 'left',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 15,
    transition: 'all 0.2s ease'
  },
  quizOptionButtonMobile: { fontSize: 14, padding: '11px 12px' },
  primaryButton: {
    border: 'none',
    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
    color: 'var(--color-surface)',
    fontWeight: 800,
    fontSize: 12,
    padding: '12px 18px',
    borderRadius: 12,
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(var(--color-primary-rgb),0.22)'
  },
  primaryButtonMobile: { width: '100%', fontSize: 12, padding: '13px 14px' },
  secondaryButton: {
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontWeight: 700,
    fontSize: 12,
    padding: '12px 18px',
    borderRadius: 12,
    cursor: 'pointer'
  },
  secondaryButtonMobile: { width: '100%', fontSize: 12, padding: '13px 14px' }
};
