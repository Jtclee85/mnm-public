import { useState, useEffect } from 'react';

const ACTIVITIES = [
  { id: 'basic',        label: '기초 이해',          icon: '🧒' },
  { id: 'evidence',     label: '자료에서 증거 찾기', icon: '🔍', desc: '내 생각을 자료 속 증거로 뒷받침해 보세요.' },
  { id: 'deep',         label: '생각 넓히기',        icon: '💡', desc: '질문을 붙잡고, 내 생각이 어떻게 달라졌는지 정리해 보세요.' },
  { id: 'presentation', label: '발표 준비',          icon: '🎤' },
  { id: 'writing',      label: '글쓰기 개요',        icon: '✏️' },
];

const MODE_RECOMMENDED = {
  understand:   ['basic', 'evidence'],
  inquiry:      ['deep', 'evidence'],
  presentation: ['presentation', 'evidence'],
  writing:      ['writing', 'evidence'],
};

const MODE_HINTS = {
  understand:   '먼저 자료를 잘 이해했는지 정리해 보세요.',
  inquiry:      '궁금한 질문을 고르고, 내 생각과 근거를 정리해 보세요.',
  presentation: '친구들에게 설명할 핵심 메시지를 정리해 보세요.',
  writing:      '중심문장과 뒷받침할 내용을 정리해 보세요.',
};

const MODE_LABELS = {
  understand:   '이해모드',
  inquiry:      '탐구모드',
  presentation: '발표 준비 모드',
  writing:      '글쓰기 준비 모드',
};

const STAGES = [
  { label: '기초', desc: '자료를 이해해요',     color: 'var(--color-accent-teal)' },
  { label: '근거', desc: '자료에서 찾았어요',   color: 'var(--color-primary)' },
  { label: '생각', desc: '내 생각을 만들어요',  color: 'var(--color-gold)' },
  { label: '표현', desc: '발표나 글로 준비해요', color: 'var(--color-coral)' },
];

const ACTIVITY_FIELDS = {
  basic: [
    { key: 'ws_basic_subject',  label: '이 자료는 무엇에 대한 설명인가요?',  placeholder: '예) 청동기 시대 사람들이 만든 무덤에 대한 설명이에요.' },
    { key: 'ws_basic_keyword',  label: '가장 중요한 낱말은 무엇인가요?',      placeholder: '예) 지석묘, 청동기 시대' },
    { key: 'ws_basic_learned',  label: '새롭게 알게 된 점은 무엇인가요?',     placeholder: '"아, 이건 몰랐는데!" 싶었던 점을 써 보세요.' },
    { key: 'ws_basic_confused', label: '아직 헷갈리는 점은 무엇인가요?',      placeholder: '이해가 잘 안 되거나 더 알고 싶은 점을 써 보세요.' },
  ],
  // 주장(내 생각) → 증거(자료) → 연결(까닭) → 다시쓰기(내 문장) 구조.
  // 자료를 베끼는 활동이 아니라, 내 생각을 자료로 뒷받침하는 활동임을 필드 순서로 보여준다.
  evidence: [
    { key: 'ws_ev_claim',      label: '1. 내가 말하고 싶은 생각',
      frame: '나는 __________라고 생각한다.',
      placeholder: '예: 나는 이 유적이 옛사람들의 생활을 알려 준다고 생각한다.' },
    { key: 'ws_ev_evidence1',  label: '2. 자료에서 찾은 증거 1',
      frame: '자료에는 “__________”라고 나와 있다.',
      placeholder: '자료에 나온 말이나 내용을 찾아 써 보세요.' },
    { key: 'ws_ev_evidence2',  label: '2. 자료에서 찾은 증거 2',
      frame: '자료에는 “__________”라고 나와 있다.',
      placeholder: '또 다른 증거가 있다면 찾아 써 보세요.' },
    { key: 'ws_ev_connection', label: '3. 이 증거가 내 생각과 이어지는 까닭',
      frame: '이 말은 __________을 보여 주기 때문이다.',
      placeholder: '이 증거가 왜 내 생각을 뒷받침하는지 써 보세요.' },
    { key: 'ws_ev_final',      label: '4. 내 문장으로 다시 쓰기',
      frame: '그래서 나는 __________라고 설명할 수 있다.',
      placeholder: '내 생각과 증거를 이어서 한 문장으로 정리해 보세요.' },
  ],
  // 탐구모드 결과를 그대로 옮겨 적는 칸이 아니라, 질문을 붙잡고 내 생각이
  // 처음 → 자료 확인 → 깊어짐 → 불확실함 → 다음 질문으로 나아가는 과정을 쓰게 한다.
  deep: [
    { key: 'ws_deep_question',  label: '1. 내가 고른 질문',
      frame: '내가 더 생각해 보고 싶은 질문은 __________이다.',
      placeholder: '탐구하고 싶은 질문을 써 보세요.' },
    { key: 'ws_deep_first',     label: '2. 처음 떠오른 내 생각',
      frame: '처음에는 __________라고 생각했다.',
      placeholder: '자료를 자세히 보기 전에 떠오른 생각을 써 보세요.' },
    { key: 'ws_deep_learned',   label: '3. 자료를 보고 알게 된 점',
      frame: '자료에서 __________을 알 수 있었다.',
      placeholder: '자료에서 새롭게 확인한 내용을 써 보세요.' },
    { key: 'ws_deep_changed',   label: '4. 생각이 더 깊어진 점',
      frame: '그래서 이제는 __________라고 생각한다.',
      placeholder: '자료를 보고 생각이 어떻게 달라졌거나 더 자세해졌는지 써 보세요.' },
    { key: 'ws_deep_uncertain', label: '5. 아직 확실하지 않은 점',
      frame: '하지만 __________은 아직 더 알아봐야 한다.',
      placeholder: '더 찾아봐야 할 점이나 아직 헷갈리는 점을 써 보세요.' },
    { key: 'ws_deep_next',      label: '6. 더 찾아보고 싶은 질문',
      frame: '다음에는 __________을 더 알아보고 싶다.',
      placeholder: '다음에 더 조사하고 싶은 질문을 써 보세요.' },
  ],
  presentation: [
    { key: 'ws_pres_core', label: '내 발표의 핵심 메시지',          placeholder: '친구들에게 꼭 전달하고 싶은 한 가지 메시지는?' },
    { key: 'ws_pres_p1',   label: '친구들에게 꼭 알려주고 싶은 내용 1', placeholder: '가장 중요하다고 생각하는 내용을 써 보세요.' },
    { key: 'ws_pres_p2',   label: '친구들에게 꼭 알려주고 싶은 내용 2', placeholder: '두 번째로 알려주고 싶은 내용을 써 보세요.' },
    { key: 'ws_pres_p3',   label: '친구들에게 꼭 알려주고 싶은 내용 3', placeholder: '세 번째로 알려주고 싶은 내용을 써 보세요.' },
    { key: 'ws_pres_q',    label: '친구들이 궁금해할 질문',           placeholder: '친구들이 발표를 듣고 이런 질문을 할 것 같아요...' },
    { key: 'ws_pres_a',    label: '내가 준비할 답',                   placeholder: '그 질문에 대해 내가 준비할 답은...' },
  ],
  writing: [
    { key: 'ws_write_topic',   label: '중심문장',             placeholder: '내 글의 핵심을 담은 한 문장을 써 보세요. (예: ~는 ...이다.)' },
    { key: 'ws_write_s1',      label: '뒷받침할 내용 1',     placeholder: '중심문장을 뒷받침하는 첫 번째 내용을 써 보세요.' },
    { key: 'ws_write_s2',      label: '뒷받침할 내용 2',     placeholder: '두 번째 내용을 써 보세요.' },
    { key: 'ws_write_s3',      label: '뒷받침할 내용 3',     placeholder: '세 번째 내용을 써 보세요.' },
    { key: 'ws_write_evidence',label: '자료에서 찾은 근거',  placeholder: '내 글에 넣을 자료 속 근거를 써 보세요.' },
    { key: 'ws_write_closing', label: '마무리에 넣을 내 생각', placeholder: '마무리 문단에 쓰고 싶은 생각이나 느낀 점을 써 보세요.' },
  ],
};

function getDefaultActivity(activeMode) {
  return (MODE_RECOMMENDED[activeMode] || ['basic'])[0];
}

// 근거 찾기/깊이 생각 → 자료에서 증거 찾기/생각 넓히기 개편으로 필드 key가
// 바뀐 항목들의 기존 저장값을 새 key로 옮긴다. 정확히 같은 의미가 아니라도
// 가장 가까운 새 필드로 보존해 데이터가 사라지지 않게 한다.
const LEGACY_FIELD_MIGRATIONS = [
  ['ws_ev_thought', 'ws_ev_claim'],
  ['ws_ev_e1', 'ws_ev_evidence1'],
  ['ws_ev_e2', 'ws_ev_evidence2'],
  ['ws_ev_reason', 'ws_ev_connection'],
  ['ws_deep_thought', 'ws_deep_first'],
  ['ws_deep_reason', 'ws_deep_changed'],
  ['ws_deep_further', 'ws_deep_next'],
];

const REDUCED_MOTION_CSS = `
  @media (prefers-reduced-motion: reduce) {
    .ws-anim { transition: none !important; }
  }
`;

/**
 * variant="panel" — 데스크탑: 왼쪽 패널(조사자료/대화) 자리에 끼워 넣는 임베드형.
 *                   배경 오버레이 없음, 왼쪽에서 슬라이드 인.
 * variant="sheet"  — 모바일: 화면 하단에서 올라오는 바텀시트. 배경 오버레이 있음.
 */
export default function ThinkingWorksheetDrawer({
  isOpen, onClose,
  topic, activeMode,
  notes, updateNote, saveStatus,
  onShare,
  isMobile,
  variant = 'sheet',
}) {
  const [selectedActivity, setSelectedActivity] = useState(
    () => notes?.ws_selected_activity || getDefaultActivity(activeMode)
  );
  const [shareState, setShareState] = useState('idle');
  const [show, setShow] = useState(false);

  // Sync activity when notes load from localStorage
  useEffect(() => {
    if (notes?.ws_selected_activity) {
      setSelectedActivity(notes.ws_selected_activity);
    }
  }, [notes?.ws_selected_activity]);

  // Default to mode-recommended when mode changes and no saved preference
  useEffect(() => {
    if (!notes?.ws_selected_activity) {
      setSelectedActivity(getDefaultActivity(activeMode));
    }
  }, [activeMode, notes?.ws_selected_activity]);

  // ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // 슬라이드 인: 마운트 다음 프레임에 열린 상태로 전환
  useEffect(() => {
    if (!isOpen) { setShow(false); return; }
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, [isOpen]);

  // 기존 근거 찾기/깊이 생각 저장값을 새 필드 key로 1회 이전 (데이터 보존)
  useEffect(() => {
    if (!notes) return;
    LEGACY_FIELD_MIGRATIONS.forEach(([oldKey, newKey]) => {
      if (notes[oldKey] && !notes[newKey]) {
        updateNote(newKey, notes[oldKey]);
      }
    });
  }, [notes, updateNote]);

  const handleActivitySelect = (id) => {
    setSelectedActivity(id);
    updateNote('ws_selected_activity', id);
  };

  const handleShareClick = async () => {
    if (!onShare) return;
    const url = onShare();
    try {
      await navigator.clipboard.writeText(url);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2500);
    } catch {
      window.open(url, '_blank');
    }
  };

  if (!isOpen) return null;

  const fields = ACTIVITY_FIELDS[selectedActivity] || [];
  const recommended = MODE_RECOMMENDED[activeMode] || [];
  const hint = MODE_HINTS[activeMode];
  const modeLabel = MODE_LABELS[activeMode] || '';
  const isPanel = variant === 'panel';
  const activityMeta = ACTIVITIES.find(a => a.id === selectedActivity);

  const body = (
    <>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: isMobile ? '14px 14px 10px' : '16px 16px 12px',
        borderBottom: '1px solid var(--color-border)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 20 }}>✏️</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--color-text)' }}>
            생각 워크시트
          </div>
          {topic && (
            <div style={{
              fontSize: 11, color: 'var(--color-text-sub)', marginTop: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {topic}{modeLabel ? ` · ${modeLabel}` : ''}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label={isPanel ? '생각 워크시트 닫고 조사 원본자료로 돌아가기' : '생각 워크시트 닫기'}
          style={{
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            color: 'var(--color-text-sub)', borderRadius: 8,
            width: 28, height: 28, cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, padding: 0,
          }}
        >✕</button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '14px 14px 40px' : '16px 16px 32px' }}>

        {/* Learning stages */}
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: 0, marginBottom: 14, padding: '9px 12px',
          background: 'var(--color-surface-alt)',
          border: '1px solid var(--color-border)',
          borderRadius: 10, overflowX: 'auto',
        }}>
          {STAGES.map((stage, idx) => (
            <div key={stage.label} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ textAlign: 'center', padding: '0 7px' }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: stage.color, lineHeight: 1.3 }}>
                  {stage.label}
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-text-sub)', marginTop: 2, whiteSpace: 'nowrap' }}>
                  {stage.desc}
                </div>
              </div>
              {idx < STAGES.length - 1 && (
                <span style={{ color: 'var(--color-text-sub)', fontSize: 11, flexShrink: 0 }}>→</span>
              )}
            </div>
          ))}
        </div>

        {/* Mode hint */}
        {hint && (
          <p style={{
            margin: '0 0 14px', fontSize: 13, color: 'var(--color-text-sub)',
            background: 'var(--color-surface-alt)',
            border: '1px solid var(--color-border)',
            borderRadius: 8, padding: '8px 12px', lineHeight: 1.6,
          }}>
            {hint}
          </p>
        )}

        {/* Activity selector */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-text-sub)', marginBottom: 9 }}>
            어떤 방식으로 생각을 정리할까요?
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {ACTIVITIES.map(({ id, label, icon }) => {
              const isSelected = selectedActivity === id;
              const isRec = recommended.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => handleActivitySelect(id)}
                  style={{
                    position: 'relative',
                    display: 'flex', alignItems: 'center', gap: 5,
                    border: isSelected
                      ? '2px solid var(--color-primary)'
                      : '1.5px solid var(--color-border)',
                    background: isSelected
                      ? 'rgba(var(--color-primary-rgb),0.09)'
                      : 'var(--color-surface)',
                    color: isSelected ? 'var(--color-primary-dark)' : 'var(--color-text)',
                    borderRadius: 10, padding: '6px 11px',
                    fontSize: 12, fontWeight: isSelected ? 900 : 700,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 13 }}>{icon}</span>
                  {label}
                  {isRec && !isSelected && (
                    <span style={{
                      position: 'absolute', top: -7, right: -7,
                      background: 'var(--color-accent-teal)', color: 'var(--color-surface)',
                      borderRadius: 999, fontSize: 9, fontWeight: 900,
                      padding: '1px 5px', lineHeight: 1.7, whiteSpace: 'nowrap',
                    }}>추천</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Activity-specific guidance — 이 활동에서 무엇을 해야 하는지 한 줄로 안내 */}
        {activityMeta?.desc && (
          <p style={{
            margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: 'var(--color-primary-dark)',
            background: 'rgba(var(--color-primary-rgb),0.08)',
            border: '1px solid rgba(var(--color-primary-rgb),0.25)',
            borderRadius: 8, padding: '8px 12px', lineHeight: 1.6,
          }}>
            {activityMeta.desc}
          </p>
        )}

        {/* Input fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15, marginBottom: 24 }}>
          {fields.map(({ key, label, frame, placeholder }) => (
            <div key={key}>
              <label style={{
                display: 'block', fontSize: 13, fontWeight: 800,
                color: 'var(--color-text)', marginBottom: 5, lineHeight: 1.5,
              }}>
                {label}
              </label>
              {frame && (
                <div style={{
                  fontSize: 12, color: 'var(--color-text-sub)', marginBottom: 6,
                  lineHeight: 1.5, fontStyle: 'italic',
                }}>
                  {frame}
                </div>
              )}
              <textarea
                value={notes?.[key] || ''}
                onChange={e => updateNote(key, e.target.value)}
                placeholder={placeholder}
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: 10, padding: '10px 12px',
                  fontSize: 14, lineHeight: 1.75,
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  fontFamily: 'inherit', resize: 'vertical',
                  outline: 'none', transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--color-border)'; }}
              />
            </div>
          ))}
        </div>

        {/* Footer: save status + share */}
        <div style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap',
          justifyContent: 'space-between', gap: 10,
          paddingTop: 12,
          borderTop: '1px solid var(--color-border)',
        }}>
          <SaveBadge status={saveStatus} />
          {onShare && (
            <button
              onClick={handleShareClick}
              style={{
                border: shareState === 'copied'
                  ? '1.5px solid var(--color-accent-teal)'
                  : '1.5px solid var(--color-primary)',
                background: shareState === 'copied'
                  ? 'rgba(var(--color-accent-teal-rgb),0.1)'
                  : 'var(--color-primary)',
                color: shareState === 'copied' ? 'var(--color-primary-dark)' : 'var(--color-surface)',
                fontWeight: 800, fontSize: shareState === 'copied' ? 12 : 13,
                padding: '9px 16px', borderRadius: 12,
                cursor: 'pointer', transition: 'all 0.2s',
                whiteSpace: shareState === 'copied' ? 'normal' : 'nowrap',
                textAlign: 'left', lineHeight: 1.4,
                maxWidth: shareState === 'copied' ? 260 : 'none',
              }}
            >
              {shareState === 'copied'
                ? '✓ 링크가 복사되었어요. 이제 패들릿이나 게시판에 붙여넣기 할 수 있습니다.'
                : '🔗 공유용 카드 만들기'}
            </button>
          )}
        </div>
      </div>
    </>
  );

  if (isPanel) {
    // 데스크탑: 왼쪽 패널 영역에 끼워 넣는 임베드형 — 오버레이 없음, 왼쪽에서 슬라이드 인
    return (
      <>
        <style>{REDUCED_MOTION_CSS}</style>
        <div
          role="region"
          aria-label="생각 워크시트"
          className="ws-anim"
          style={{
            display: 'flex', flexDirection: 'column',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 20,
            overflow: 'hidden',
            maxHeight: 'calc(100vh - 140px)',
            transform: show ? 'translateX(0)' : 'translateX(-16px)',
            opacity: show ? 1 : 0,
            transition: 'transform 220ms ease, opacity 220ms ease',
          }}
        >
          {body}
        </div>
      </>
    );
  }

  // 모바일: 화면 하단에서 올라오는 바텀시트 — 배경 오버레이 포함
  return (
    <>
      <style>{REDUCED_MOTION_CSS}</style>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.3)' }}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="생각 워크시트"
        className="ws-anim"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: '88vh', zIndex: 1101,
          background: 'var(--color-surface)',
          borderRadius: '20px 20px 0 0',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
          transform: show ? 'translateY(0)' : 'translateY(24px)',
          opacity: show ? 1 : 0,
          transition: 'transform 220ms ease, opacity 220ms ease',
        }}
      >
        {body}
      </div>
    </>
  );
}

function SaveBadge({ status }) {
  const cfg = {
    idle:   { text: '자동 저장됩니다', color: 'var(--color-text-sub)' },
    saving: { text: '저장 중...',      color: 'var(--color-primary)' },
    saved:  { text: '✓ 저장됨',        color: 'var(--color-accent-teal)' },
  }[status] || { text: '자동 저장됩니다', color: 'var(--color-text-sub)' };

  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>
      {cfg.text}
    </span>
  );
}

// 공유 페이지에서 사용하는 워크시트 메타 (share.js에서 import)
export const WS_ACTIVITIES_META = ACTIVITIES;
export const WS_ACTIVITY_FIELDS = ACTIVITY_FIELDS;
