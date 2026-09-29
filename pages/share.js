import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { decodeShareData } from '../lib/shareUtils';
import { buildModeInputs, hasAnyValue } from '../lib/shareArtifact';
import { FALLBACK_CHECK_QUESTIONS } from '../lib/modeWorksheetFields';
import { REFLECTION_FIELDS, MODES } from '../lib/reflectionFields';
import { WS_ACTIVITIES_META, WS_ACTIVITY_FIELDS } from '../components/ThinkingWorksheetDrawer';

const SHARE_NOTICE_MESSAGES = {
  copied: '링크가 복사되었어요. 이제 패들릿이나 게시판에 붙여넣기 할 수 있어요.',
  'copy-failed': '산출물 페이지를 새 창으로 열었어요. 주소 복사가 되지 않으면 주소창의 링크를 직접 복사해 주세요.',
};

export default function SharePage() {
  const router = useRouter();
  const [shareData, setShareData] = useState(null);
  const [error, setError] = useState(false);
  const [systemNotice, setSystemNotice] = useState('');

  useEffect(() => {
    const queryValue = Array.isArray(router.query.d) ? router.query.d[0] : router.query.d;
    const noticeValue = Array.isArray(router.query.notice) ? router.query.notice[0] : router.query.notice;
    const searchParams = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : null;
    const d = queryValue || (typeof window !== 'undefined'
      ? searchParams.get('d')
      : null);
    const notice = noticeValue || searchParams?.get('notice');
    setSystemNotice(SHARE_NOTICE_MESSAGES[notice] || '');
    if (!d) return;
    const decoded = decodeShareData(d);
    if (decoded) {
      setShareData(decoded);
      setError(false);
    } else {
      setError(true);
    }
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (!systemNotice) return undefined;
    const timer = setTimeout(() => setSystemNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [systemNotice]);

  return (
    <>
      <Head>
        <title>뭐냐면 학습 산출물</title>
        <meta name="description" content="AI 설명을 참고해 학생이 직접 정리한 이해·탐구·표현 기록입니다." />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: var(--color-surface) !important; }
          }
        `}</style>
      </Head>

      <div style={s.page}>
        {systemNotice && (
          <div style={s.systemNotice} role="status" data-testid="share-system-notice">
            <span style={s.systemNoticeIcon}>✓</span>
            <span>{systemNotice}</span>
          </div>
        )}

        {/* 헤더 */}
        <div style={s.header}>
          <div style={s.headerInner}>
            <span style={s.logo}>🧒 뭐냐면</span>
            <span style={s.badge}>학습 산출물</span>
          </div>
        </div>

        <div style={s.container}>
          {(!router.isReady && typeof window === 'undefined') || (!shareData && !error) ? (
            <p style={s.loading}>불러오는 중...</p>
          ) : error ? (
            <ErrorView />
          ) : (
            <ShareContent data={shareData} />
          )}
        </div>
      </div>
    </>
  );
}

function ShareContent({ data }) {
  const { topic, sharedAt } = data;

  // 4차 이전(구 형식) 공유 링크 호환 — legacyWorksheet(또는 notes)에 담긴 평평한
  // key-value에서 모드별 학생 작성 내용을 다시 뽑아낸다. 새 형식 링크는 이미
  // modeInputs가 포함돼 있으므로 그대로 쓰고, 없으면 여기서 계산한다.
  const rawNotes = data.legacyWorksheet || data.notes || {};
  const modeInputs = data.modeInputs || buildModeInputs(rawNotes);
  // '자료에서 증거 찾기'(ws_ev_*)는 아래 filledLegacyActivities(WS_ACTIVITY_FIELDS.evidence)가
  // 이미 같은 필드를 렌더링하므로, 여기서 별도 카드로 중복 표시하지 않는다.

  // 새 필드(sourceText/easyExplanationSummary/modeInputs)가 전혀 없으면 3차 이전에
  // 만들어진 옛 형식 공유 링크로 본다 — 안내 문구만 살짝 보여주고 나머지는 그대로 진행.
  const isLegacyLink = !data.modeInputs && !data.sourceText && !data.easyExplanationSummary;

  const understandFilled = hasAnyValue(modeInputs.understanding);
  const inquiryFilled = hasAnyValue(modeInputs.inquiry);
  const presentationFilled = hasAnyValue(modeInputs.presentation);
  const writingFilled = hasAnyValue(modeInputs.writing);

  // 옛 별도 '생각 워크시트'(ws_*) 활동 — 새 모드 필드로 옮겨지지 않은 것만 남아 있다.
  const filledLegacyActivities = WS_ACTIVITIES_META
    .map(({ id, label, icon }) => {
      const fields = WS_ACTIVITY_FIELDS[id] || [];
      const filledFields = fields.filter(f => rawNotes[f.key]?.trim());
      return { id, label, icon, filledFields };
    })
    .filter(a => a.filledFields.length > 0);

  // 훨씬 더 오래된 '내가 생각해보기' 성찰 카드(understand_summary 등) 데이터.
  const filledReflectionModes = MODES.filter(({ key }) =>
    REFLECTION_FIELDS[key].some(f => rawNotes[f.key]?.trim())
  );

  const hasLegacyContent = filledLegacyActivities.length > 0 || filledReflectionModes.length > 0;
  const hasAnything = understandFilled || inquiryFilled || presentationFilled || writingFilled || hasLegacyContent;

  const easySummary = data.easyExplanationSummary;
  const hasEasySummary = !!(easySummary && (easySummary.oneSentence?.trim() || easySummary.easyFullText?.trim()));
  const hasSourceText = !!data.sourceText?.trim();

  return (
    <>
      {isLegacyLink && (
        <p style={s.legacyNotice}>
          이전 형식의 공유 자료입니다. 표시할 수 있는 학습 기록만 보여줍니다.
        </p>
      )}

      {/* 타이틀 */}
      <div style={s.titleBlock}>
        <div style={s.pageTitle}>뭐냐면 학습 산출물</div>
        <p style={s.pageSubtitle}>AI 설명을 참고해 내가 직접 정리한 이해·탐구·표현 기록입니다.</p>
      </div>

      {/* 주제 정보 */}
      <div style={s.topInfo}>
        <div style={s.topLeft}>
          <div style={s.topicLabel}>조사 주제</div>
          <div style={s.topicValue}>{topic || '(제목 없음)'}</div>
        </div>
        {sharedAt && (
          <div style={s.dateText}>작성일 {sharedAt}</div>
        )}
      </div>

      {!hasAnything && (
        <p style={s.emptyState}>
          아직 학생이 작성한 학습 기록이 없습니다.<br />
          모드별 활동을 작성하면 이곳에 학습 산출물이 정리됩니다.
        </p>
      )}

      {understandFilled && (
        <ArtifactCard icon="✅" title="이해 확인">
          <QAField question={FALLBACK_CHECK_QUESTIONS[0]} answer={modeInputs.understanding.check1} />
          <QAField question={FALLBACK_CHECK_QUESTIONS[1]} answer={modeInputs.understanding.check2} />
          <QAField question={FALLBACK_CHECK_QUESTIONS[2]} answer={modeInputs.understanding.check3} />
          <QAField question={FALLBACK_CHECK_QUESTIONS[3]} answer={modeInputs.understanding.check4} />
        </ArtifactCard>
      )}

      {inquiryFilled && (
        <ArtifactCard icon="🔎" title="탐구 정리">
          {modeInputs.inquiry.selectedQuestion && (
            <Field label="선택한 질문">
              {modeInputs.inquiry.selectedQuestionType && (
                <span style={s.typeBadge}>{modeInputs.inquiry.selectedQuestionType}</span>
              )}
              {modeInputs.inquiry.selectedQuestion}
            </Field>
          )}
          <Field label="내 처음 생각" value={modeInputs.inquiry.firstThought} />
          <Field label="왜 그렇게 생각했나요?" value={modeInputs.inquiry.reason} />
          <Field label="챗봇과 대화 후 새롭게 알게 된 점" value={modeInputs.inquiry.learnedAfterChat} />
          <Field label="생각이 바뀐 점 또는 더 궁금해진 점" value={modeInputs.inquiry.changedOrFurtherQuestion} />
        </ArtifactCard>
      )}

      {presentationFilled && (
        <ArtifactCard icon="🎤" title="발표 준비">
          <Field label="내 발표의 핵심 메시지" value={modeInputs.presentation.coreMessage} />
          <NumberedField
            label="친구들에게 꼭 알려주고 싶은 내용"
            items={[
              { n: 1, value: modeInputs.presentation.point1 },
              { n: 2, value: modeInputs.presentation.point2 },
              { n: 3, value: modeInputs.presentation.point3 },
            ]}
          />
          <Field label="친구들이 궁금해할 질문" value={modeInputs.presentation.expectedQuestion} />
          <Field label="내가 준비할 답" value={modeInputs.presentation.preparedAnswer} />
          <Field label="발표 첫 문장" value={modeInputs.presentation.openingSentence} emphasize />
          <Field label="발표 마무리 문장" value={modeInputs.presentation.closingSentence} emphasize />
        </ArtifactCard>
      )}

      {writingFilled && (
        <ArtifactCard icon="✏️" title="글쓰기 개요">
          <Field label="중심문장" value={modeInputs.writing.topicSentence} />
          <NumberedField
            label="뒷받침할 내용"
            items={[
              { n: 1, value: modeInputs.writing.support1 },
              { n: 2, value: modeInputs.writing.support2 },
              { n: 3, value: modeInputs.writing.support3 },
            ]}
          />
          <Field label="자료에서 찾은 근거" value={modeInputs.writing.evidence} />
          <Field label="마무리에 넣을 내 생각" value={modeInputs.writing.closingThought} />
          <Field label="처음 문장" value={modeInputs.writing.openingSentence} emphasize />
          <Field label="마무리 문장" value={modeInputs.writing.closingSentence} emphasize />
        </ArtifactCard>
      )}

      {hasLegacyContent && (
        <>
          <div style={s.sectionDivider}>이전 형식 기록</div>
          <LegacyWorksheetSection activities={filledLegacyActivities} notes={rawNotes} />
          {filledReflectionModes.map(({ key, label, icon }) => (
            <LegacyReflectionSection
              key={key}
              modeKey={key}
              modeLabel={label}
              modeIcon={icon}
              notes={rawNotes}
            />
          ))}
        </>
      )}

      {/* 보조 자료 — 학생 산출물보다 뒤에, 짧게만 */}
      {(hasEasySummary || hasSourceText) && (
        <div style={s.supportSection}>
          {hasEasySummary && (
            <div style={s.supportBlock}>
              <div style={s.supportLabel}>참고한 쉬운설명</div>
              {easySummary.oneSentence && <p style={s.supportOneSentence}>{easySummary.oneSentence}</p>}
              {easySummary.easyFullText && <p style={s.supportText}>{easySummary.easyFullText}</p>}
            </div>
          )}
          {hasSourceText && (
            <details style={s.supportBlock}>
              <summary style={s.supportSummary}>참고한 원본자료 (펼치기)</summary>
              <p style={s.supportText}>{data.sourceText}</p>
            </details>
          )}
        </div>
      )}

      {/* 버튼 영역 */}
      <div style={s.btnRow} className="no-print">
        <button style={s.printBtn} onClick={() => window.print()}>
          🖨 인쇄하기
        </button>
        <button style={s.backBtn} onClick={() => window.close()}>
          ✕ 닫기
        </button>
      </div>

      <p style={s.notice} className="no-print">
        이 페이지는 학생이 직접 정리한 학습 산출물을 공유하기 위한 읽기 전용 페이지입니다.
      </p>
    </>
  );
}

// 라벨 + 값 한 쌍. value가 비어 있으면(children이 없을 때) 아무것도 렌더링하지 않는다.
function Field({ label, value, children, emphasize }) {
  const content = children ?? value;
  const isEmpty = children ? false : !value?.toString().trim();
  if (isEmpty) return null;
  return (
    <div style={s.fieldRow}>
      <div style={s.fieldLabel}>{label}</div>
      <div style={{ ...s.fieldValue, ...(emphasize ? s.fieldValueEmphasize : {}) }}>{content}</div>
    </div>
  );
}

// 질문 텍스트 자체를 라벨로 쓰는 이해 확인 전용 필드
function QAField({ question, answer }) {
  if (!answer?.trim()) return null;
  return (
    <div style={s.fieldRow}>
      <div style={s.fieldLabel}>{question}</div>
      <div style={s.fieldValue}>{answer}</div>
    </div>
  );
}

// 1./2./3. 번호가 매겨진 항목 중 실제로 쓴 것만 보여준다 (원래 번호 유지)
function NumberedField({ label, items }) {
  const filled = items.filter(i => i.value?.toString().trim());
  if (filled.length === 0) return null;
  return (
    <div style={s.fieldRow}>
      <div style={s.fieldLabel}>{label}</div>
      <div style={{ ...s.fieldValue, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filled.map(({ n, value }) => (
          <div key={n}>{n}. {value}</div>
        ))}
      </div>
    </div>
  );
}

function ArtifactCard({ icon, title, children }) {
  return (
    <div style={s.artifactCard}>
      <div style={s.artifactHeader}>
        <span style={s.artifactIcon}>{icon}</span>
        <span style={s.artifactTitle}>{title}</span>
      </div>
      <div style={s.modeBody}>{children}</div>
    </div>
  );
}

function LegacyReflectionSection({ modeKey, modeLabel, modeIcon, notes }) {
  const fields = REFLECTION_FIELDS[modeKey];
  const filledFields = fields.filter(f => notes[f.key]?.trim());
  if (filledFields.length === 0) return null;

  return (
    <div style={s.modeCard}>
      <div style={s.modeHeader}>
        <span style={s.modeIcon}>{modeIcon}</span>
        <span style={s.modeLabel}>{modeLabel} 성찰</span>
      </div>
      <div style={s.modeBody}>
        {filledFields.map(({ key, label }) => (
          <div key={key} style={s.fieldRow}>
            <div style={s.fieldLabel}>{label}</div>
            <div style={s.fieldValue}>{notes[key]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegacyWorksheetSection({ activities, notes }) {
  if (activities.length === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      {activities.map(({ id, label, icon, filledFields }) => (
        <div key={id} style={s.wsCard}>
          <div style={s.wsCardHeader}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            <span style={s.wsCardLabel}>{label}</span>
          </div>
          <div style={s.modeBody}>
            {filledFields.map(({ key, label: fieldLabel }) => (
              <div key={key} style={s.fieldRow}>
                <div style={s.fieldLabel}>{fieldLabel}</div>
                <div style={s.fieldValue}>{notes[key]}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorView() {
  // 오류 상태(빨강)는 의미 전달용이라 그대로 유지
  return (
    <div style={s.errorBox}>
      <p style={{ margin: 0, fontSize: 16, color: '#b91c1c', fontWeight: 700 }}>
        😅 링크를 읽을 수 없어요.
      </p>
      <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--color-text-sub)' }}>
        공유 링크가 올바른지 확인해 주세요.
      </p>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: 'var(--color-bg)',
    paddingBottom: 48
  },
  header: {
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
    padding: '14px 20px',
    marginBottom: 28
  },
  headerInner: {
    maxWidth: 720,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: 12
  },
  logo: {
    fontSize: 20,
    fontWeight: 900,
    color: 'var(--color-primary-dark)'
  },
  badge: {
    background: 'rgba(var(--color-primary-rgb),0.1)',
    color: 'var(--color-primary-dark)',
    border: '1px solid rgba(var(--color-primary-rgb),0.3)',
    borderRadius: 20,
    padding: '3px 12px',
    fontSize: 12,
    fontWeight: 700
  },
  container: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '0 16px'
  },
  loading: {
    textAlign: 'center',
    color: 'var(--color-text-sub)',
    fontSize: 15,
    marginTop: 60
  },
  systemNotice: {
    position: 'fixed',
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 50,
    width: 'min(560px, calc(100vw - 32px))',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    border: '1px solid rgba(var(--color-accent-teal-rgb),0.45)',
    background: 'var(--color-surface)',
    color: 'var(--color-primary-dark)',
    borderRadius: 14,
    padding: '11px 14px',
    boxShadow: '0 10px 28px rgba(var(--color-text-rgb),0.16)',
    fontSize: 13.5,
    fontWeight: 800,
    lineHeight: 1.5,
  },
  systemNoticeIcon: {
    flexShrink: 0,
    width: 19,
    height: 19,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(var(--color-accent-teal-rgb),0.16)',
    color: 'var(--color-primary-dark)',
    fontSize: 12,
    fontWeight: 900,
    marginTop: 1,
  },
  legacyNotice: {
    margin: '0 0 14px', fontSize: 12.5, color: 'var(--color-text-sub)',
    background: 'var(--color-surface-alt)', border: '1px dashed var(--color-border)',
    borderRadius: 10, padding: '9px 13px', lineHeight: 1.6,
  },
  titleBlock: { marginBottom: 18, padding: '0 2px' },
  pageTitle: { fontSize: 20, fontWeight: 900, color: 'var(--color-primary-dark)', marginBottom: 4 },
  pageSubtitle: { margin: 0, fontSize: 13, color: 'var(--color-text-sub)', lineHeight: 1.6 },
  topInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
    padding: '0 2px'
  },
  topLeft: {},
  topicLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--color-text-sub)',
    letterSpacing: '0.05em',
    marginBottom: 4
  },
  topicValue: {
    fontSize: 22,
    fontWeight: 900,
    color: 'var(--color-text)'
  },
  dateText: {
    fontSize: 12,
    color: 'var(--color-text-sub)',
    fontWeight: 600
  },
  emptyState: {
    textAlign: 'center', color: 'var(--color-text-sub)', fontSize: 14, lineHeight: 1.8,
    background: 'var(--color-surface)', border: '1px dashed var(--color-border)',
    borderRadius: 16, padding: '36px 20px', marginBottom: 16,
  },
  artifactCard: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    boxShadow: '0 2px 8px rgba(var(--color-text-rgb),0.06)',
  },
  artifactHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 18px',
    background: 'rgba(var(--color-primary-rgb),0.06)',
    borderBottom: '1px solid var(--color-border)'
  },
  artifactIcon: { fontSize: 18 },
  artifactTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: 'var(--color-primary-dark)'
  },
  typeBadge: {
    display: 'inline-block', marginRight: 7,
    border: '1px solid rgba(var(--color-accent-teal-rgb),0.45)',
    background: 'rgba(var(--color-accent-teal-rgb),0.08)',
    color: 'var(--color-primary-dark)', borderRadius: 999,
    padding: '2px 8px', fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap',
  },
  modeCard: {
    background: 'color-mix(in srgb, var(--color-gold) 6%, var(--color-surface))',
    border: '2px solid rgba(var(--color-gold-rgb),0.6)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16
  },
  modeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 18px',
    background: 'color-mix(in srgb, var(--color-gold) 14%, var(--color-surface))',
    borderBottom: '1px solid rgba(var(--color-gold-rgb),0.6)'
  },
  modeIcon: { fontSize: 18 },
  modeLabel: {
    fontSize: 15,
    fontWeight: 800,
    color: 'var(--color-text)'
  },
  modeBody: {
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14
  },
  fieldRow: {},
  fieldLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--color-text-sub)',
    marginBottom: 5
  },
  fieldValue: {
    fontSize: 15,
    color: 'var(--color-text)',
    lineHeight: 1.75,
    background: 'var(--color-surface-alt)',
    border: '1px solid var(--color-border)',
    borderRadius: 10,
    padding: '10px 14px',
    whiteSpace: 'pre-wrap'
  },
  fieldValueEmphasize: {
    fontWeight: 700,
    background: 'color-mix(in srgb, var(--color-gold) 16%, var(--color-surface))',
    border: '1px solid rgba(var(--color-gold-rgb),0.6)',
  },
  sectionDivider: {
    fontSize: 11, fontWeight: 700, color: 'var(--color-text-sub)',
    letterSpacing: '0.06em', textTransform: 'uppercase',
    padding: '4px 2px', marginBottom: 12, marginTop: 8,
    borderTop: '1px solid var(--color-border)', paddingTop: 16,
  },
  wsCard: {
    background: 'var(--color-surface)',
    border: '2px solid rgba(var(--color-primary-rgb),0.25)',
    borderRadius: 16, overflow: 'hidden', marginBottom: 14,
  },
  wsCardHeader: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '11px 18px',
    background: 'rgba(var(--color-primary-rgb),0.06)',
    borderBottom: '1px solid rgba(var(--color-primary-rgb),0.15)',
  },
  wsCardLabel: {
    fontSize: 15, fontWeight: 800, color: 'var(--color-primary-dark)',
  },
  supportSection: {
    display: 'flex', flexDirection: 'column', gap: 10,
    marginTop: 8, marginBottom: 20,
  },
  supportBlock: {
    background: 'var(--color-surface-alt)',
    border: '1px dashed var(--color-border)',
    borderRadius: 12,
    padding: '12px 14px',
  },
  supportLabel: { fontSize: 11.5, fontWeight: 800, color: 'var(--color-text-sub)', marginBottom: 6 },
  supportSummary: { fontSize: 11.5, fontWeight: 800, color: 'var(--color-text-sub)', cursor: 'pointer' },
  supportOneSentence: { margin: '0 0 6px', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.6 },
  supportText: { margin: '8px 0 0', fontSize: 13, color: 'var(--color-text-sub)', lineHeight: 1.7, whiteSpace: 'pre-wrap' },
  btnRow: {
    display: 'flex',
    gap: 10,
    marginTop: 24,
    marginBottom: 12
  },
  printBtn: {
    border: '1.5px solid var(--color-primary)',
    background: 'rgba(var(--color-primary-rgb),0.08)',
    color: 'var(--color-primary-dark)',
    fontWeight: 800,
    fontSize: 14,
    padding: '10px 20px',
    borderRadius: 12,
    cursor: 'pointer'
  },
  backBtn: {
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontWeight: 700,
    fontSize: 14,
    padding: '10px 20px',
    borderRadius: 12,
    cursor: 'pointer'
  },
  notice: {
    fontSize: 11,
    color: 'var(--color-text-sub)',
    textAlign: 'center',
    marginTop: 8
  },
  // 오류 상태(빨강)는 의미 전달용이라 그대로 유지
  errorBox: {
    marginTop: 60,
    textAlign: 'center',
    padding: '32px',
    background: 'var(--color-surface)',
    border: '1px solid #fca5a5',
    borderRadius: 16
  }
};
