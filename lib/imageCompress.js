export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// 압축 전 원본 업로드 용량 상한 — 이보다 크면 브라우저 단계에서 바로 거절한다.
export const MAX_RAW_FILE_BYTES = 15 * 1024 * 1024;

/** 파일 타입/용량을 검사하고, 문제가 있으면 에러 메시지를, 없으면 빈 문자열을 돌려준다. */
export function validateImageFile(file) {
  if (!file) return 'NO_FILE';
  if (!file.type || !ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) return 'INVALID_TYPE';
  if (file.size > MAX_RAW_FILE_BYTES) return 'TOO_LARGE';
  return '';
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('파일을 읽을 수 없습니다.'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 불러올 수 없습니다.'));
    img.src = src;
  });
}

/**
 * 긴 변 기준 maxDimension 이하로 리사이즈하고 JPEG로 재인코딩해 데이터 URL을 만든다.
 * canvas로 다시 그리는 과정에서 EXIF(촬영 위치 등) 메타데이터는 결과물에 포함되지 않는다.
 */
export async function compressImageFile(file, { maxDimension = 1280, quality = 0.82 } = {}) {
  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImageElement(rawDataUrl);

  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const targetWidth = Math.max(1, Math.round(img.width * scale));
  const targetHeight = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  let outputQuality = quality;
  let dataUrl = canvas.toDataURL('image/jpeg', outputQuality);

  // base64 결과가 여전히 크면 품질을 단계적으로 낮춰 재인코딩한다.
  while (dataUrl.length > 2_200_000 && outputQuality > 0.4) {
    outputQuality -= 0.15;
    dataUrl = canvas.toDataURL('image/jpeg', outputQuality);
  }

  return { dataUrl, width: targetWidth, height: targetHeight };
}
