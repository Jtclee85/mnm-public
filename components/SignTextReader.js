import { useEffect, useRef, useState } from 'react';
import { compressImageFile, validateImageFile } from '../lib/imageCompress';
import { getUiText } from '../lib/i18n';

const VALIDATION_ERROR_KEY = {
  NO_FILE: 'signReaderNoFile',
  INVALID_TYPE: 'signReaderInvalidType',
  TOO_LARGE: 'signReaderTooLarge',
};

const DEMO_OCR_NOTICE =
  '오프라인 시연에서는 이미지 인식 기능이 작동하지 않습니다. 온라인 프로그램에서 안내판 사진을 올리면 원본자료를 추출할 수 있습니다.';

export default function SignTextReader({ isMobile, onExtracted, t = getUiText('ko'), demoMode = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  // idle(선택 대기) | ready(추출 대기) | extracting | success | error
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [permissionAccepted, setPermissionAccepted] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // 모달이 닫힐 때 미리보기용 객체 URL을 해제해 메모리를 정리한다.
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const resetState = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl('');
    setStatus('idle');
    setErrorMessage('');
    setWarnings([]);
    setPermissionAccepted(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openModal = () => {
    resetState();
    if (demoMode) {
      setStatus('error');
      setErrorMessage(DEMO_OCR_NOTICE);
    }
    setIsOpen(true);
  };
  const closeModal = () => { setIsOpen(false); resetState(); };

  const handlePermissionAgree = () => {
    setPermissionAccepted(true);
    // 사용자의 동의 클릭과 파일 선택 요청을 같은 동작 안에서 실행해야
    // 브라우저가 파일 선택창을 팝업으로 차단하지 않는다.
    if (!demoMode) fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    if (!permissionAccepted) {
      e.target.value = '';
      return;
    }

    const selected = e.target.files?.[0] || null;
    const errorCode = validateImageFile(selected);

    if (errorCode) {
      setFile(null);
      setPreviewUrl('');
      setStatus('error');
      setErrorMessage(t[VALIDATION_ERROR_KEY[errorCode]] || t.signReaderInvalidType);
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setStatus('ready');
    setErrorMessage('');
    setWarnings([]);
  };

  const handleExtract = async () => {
    if (demoMode) {
      setStatus('error');
      setErrorMessage(DEMO_OCR_NOTICE);
      return;
    }

    if (!file) {
      setStatus('error');
      setErrorMessage(t.signReaderNoFile);
      return;
    }

    setStatus('extracting');
    setErrorMessage('');

    try {
      const { dataUrl } = await compressImageFile(file);

      const res = await fetch('/api/extract-sign-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.text) {
        setStatus('error');
        setErrorMessage(data.error || t.signReaderFailure);
        setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
        return;
      }

      setStatus('success');
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      onExtracted?.(data.text);
    } catch {
      setStatus('error');
      setErrorMessage(t.signReaderFailure);
    }
  };

  const isBusy = status === 'extracting';

  return (
    <>
      <button
        type="button"
        data-testid="sign-reader-button"
        style={{ ...s.openBtn, ...(isMobile ? s.openBtnMobile : {}) }}
        onClick={openModal}
      >
        {t.signReaderButton}
      </button>

      {isOpen && (
        <div style={s.modalOverlay} onClick={closeModal}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()} data-testid="sign-reader-modal">
            <div style={s.headerBar}>
              <span style={s.headerTitle}>{t.signReaderModalTitle}</span>
              <button style={s.closeBtn} onClick={closeModal} aria-label={t.signReaderClose} title={t.signReaderClose}>
                ✕
              </button>
            </div>

            <div style={s.body}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                data-testid="sign-reader-file-input"
              />

              {!permissionAccepted ? (
                <section style={s.permissionNotice} data-testid="sign-reader-permission-notice">
                  <span style={s.permissionBadge}>{t.signReaderPermissionBadge}</span>
                  <h2 style={s.permissionTitle}>{t.signReaderPermissionTitle}</h2>
                  <div style={s.permissionItem}>
                    <span aria-hidden="true" style={s.permissionIcon}>📷</span>
                    <div>
                      <strong style={s.permissionItemTitle}>{t.signReaderPermissionItem}</strong>
                      <p style={s.permissionReason}>{t.signReaderPermissionReason}</p>
                    </div>
                  </div>
                  <p style={s.permissionRefusal}>{t.signReaderPermissionRefusal}</p>
                  <div style={s.permissionActions}>
                    <button
                      type="button"
                      data-testid="sign-reader-permission-decline"
                      style={s.secondaryBtn}
                      onClick={closeModal}
                    >
                      {t.signReaderPermissionDecline}
                    </button>
                    <button
                      type="button"
                      data-testid="sign-reader-permission-agree"
                      style={s.primaryBtn}
                      onClick={handlePermissionAgree}
                    >
                      {t.signReaderPermissionAgree}
                    </button>
                  </div>
                </section>
              ) : (
                <>
                  <p style={s.privacyNotice}>{t.signReaderPrivacyNotice}</p>

                  {previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt="" style={s.preview} />
                  )}

                  <div style={s.actionRow}>
                    <button
                      type="button"
                      style={s.secondaryBtn}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isBusy}
                    >
                      {file ? t.signReaderChangeFile : t.signReaderChooseFile}
                    </button>
                    <button
                      type="button"
                      data-testid="sign-reader-extract-button"
                      style={{ ...s.primaryBtn, opacity: (!file || isBusy) ? 0.6 : 1 }}
                      onClick={handleExtract}
                      disabled={!file || isBusy}
                    >
                      {isBusy ? t.signReaderExtracting : t.signReaderStart}
                    </button>
                  </div>

                  {status === 'success' && (
                    <div style={s.successBox} data-testid="sign-reader-success">
                      <p style={s.successText}>{t.signReaderSuccess}</p>
                      {warnings.map((w, i) => <p key={i} style={s.warningText}>⚠ {w}</p>)}
                      <button type="button" style={s.confirmBtn} onClick={closeModal}>
                        {t.signReaderClose}
                      </button>
                    </div>
                  )}

                  {status === 'error' && (
                    <div style={s.errorBox} data-testid="sign-reader-error">
                      <p style={s.errorText}>{errorMessage}</p>
                      {warnings.map((w, i) => <p key={i} style={s.warningText}>⚠ {w}</p>)}
                    </div>
                  )}

                  <p style={s.accuracyNotice}>{t.signReaderAccuracyNotice}</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const s = {
  openBtn: {
    border: '1.5px solid rgba(var(--color-primary-rgb),0.3)', background: 'rgba(var(--color-primary-rgb),0.08)', color: 'var(--color-primary-dark)',
    fontSize: 12, fontWeight: 800, padding: '5px 10px', borderRadius: 20,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  openBtnMobile: { width: '100%' },

  modalOverlay: {
    position: 'fixed', inset: 0, zIndex: 300,
    background: 'rgba(var(--color-text-rgb),0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modalBox: {
    width: 'min(520px, 100%)', maxHeight: '90vh', overflowY: 'auto',
    background: 'var(--color-surface)', borderRadius: 20,
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 60px rgba(var(--color-text-rgb),0.3)',
  },
  headerBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, padding: '14px 18px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-alt)',
  },
  headerTitle: { fontSize: 16, fontWeight: 800, color: 'var(--color-text)' },
  closeBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-sub)',
    width: 26, height: 26, borderRadius: 8, fontSize: 12, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
  },
  body: { padding: 18, display: 'flex', flexDirection: 'column', gap: 12 },
  permissionNotice: { display: 'flex', flexDirection: 'column', gap: 12 },
  permissionBadge: {
    alignSelf: 'flex-start', padding: '5px 10px', borderRadius: 20,
    background: 'rgba(var(--color-primary-rgb),0.1)', color: 'var(--color-primary-dark)',
    fontSize: 12, fontWeight: 800,
  },
  permissionTitle: { margin: 0, fontSize: 21, lineHeight: 1.35, color: 'var(--color-text)' },
  permissionItem: {
    display: 'flex', gap: 12, alignItems: 'flex-start', padding: 14,
    border: '1.5px solid rgba(var(--color-primary-rgb),0.25)', borderRadius: 14,
    background: 'rgba(var(--color-primary-rgb),0.05)',
  },
  permissionIcon: { fontSize: 24, lineHeight: 1.2 },
  permissionItemTitle: { display: 'block', marginBottom: 5, fontSize: 16, color: 'var(--color-text)' },
  permissionReason: { margin: 0, fontSize: 14, lineHeight: 1.65, color: 'var(--color-text)' },
  permissionRefusal: {
    margin: 0, padding: '10px 12px', borderRadius: 10,
    background: 'var(--color-surface-alt)', color: 'var(--color-text-sub)', fontSize: 13, lineHeight: 1.6,
  },
  permissionActions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  privacyNotice: {
    margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--color-text)',
    background: 'color-mix(in srgb, var(--color-coral) 10%, var(--color-surface))',
    border: '1px solid rgba(var(--color-coral-rgb),0.4)', borderRadius: 12, padding: '10px 14px',
  },
  preview: {
    width: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 12,
    border: '1px solid var(--color-border)', background: 'var(--color-surface-alt)',
  },
  actionRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  secondaryBtn: {
    border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)',
    fontWeight: 700, fontSize: 15, padding: '10px 16px', borderRadius: 12, cursor: 'pointer',
  },
  primaryBtn: {
    border: 'none', flex: 1,
    background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
    color: 'var(--color-surface)', fontWeight: 800, fontSize: 15, padding: '10px 16px', borderRadius: 12, cursor: 'pointer',
  },
  successBox: {
    background: 'color-mix(in srgb, var(--color-accent-teal) 10%, var(--color-surface))',
    border: '1px solid rgba(var(--color-accent-teal-rgb),0.4)', borderRadius: 12, padding: '12px 14px',
  },
  successText: { margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--color-text)' },
  confirmBtn: {
    marginTop: 10, border: 'none', background: 'var(--color-primary)', color: 'var(--color-surface)',
    fontWeight: 800, fontSize: 14, padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
  },
  // 실패 상태(빨강 계열)는 의미 전달용이라 의도적으로 코랄 톤을 사용
  errorBox: {
    background: 'color-mix(in srgb, var(--color-coral) 14%, var(--color-surface))',
    border: '1px solid rgba(var(--color-coral-rgb),0.5)', borderRadius: 12, padding: '12px 14px',
  },
  errorText: { margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--color-text)', fontWeight: 700 },
  warningText: { margin: '6px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-sub)' },
  accuracyNotice: { margin: 0, fontSize: 12, color: 'var(--color-text-sub)' },
};
