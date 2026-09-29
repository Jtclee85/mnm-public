import { AI_ERROR_CODES } from '../../aiProviderConfig';
import { AiError } from '../ai/errors';

// 교사 Gemini 키를 저장소에 넣기 전에 AES-GCM으로 암호화한다. 저장소 내용이 새어도 키가
// 그대로 드러나지 않게 하기 위해서다. 암호화 키는 서버 비밀값 CLASS_KEY_SECRET에서 만든다.
// Edge runtime의 Web Crypto만 쓰고 Node 전용 API(Buffer 등)는 쓰지 않는다.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// 너무 짧은 비밀값은 추측할 수 있으므로 쓰지 않는다.
const MIN_SECRET_LENGTH = 32;

export function isClassSecretConfigured() {
  return (process.env.CLASS_KEY_SECRET || '').length >= MIN_SECRET_LENGTH;
}

async function getCryptoKey() {
  const secret = process.env.CLASS_KEY_SECRET || '';
  if (secret.length < MIN_SECRET_LENGTH) throw new AiError(AI_ERROR_CODES.CLASS_UNAVAILABLE);
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}

export function randomToken(byteLength = 32) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function sha256Base64Url(text) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return toBase64Url(new Uint8Array(digest));
}

// associatedData(학급 코드)를 함께 묶어, 다른 학급 레코드로 옮겨 붙인 암호문은 풀리지 않게 한다.
export async function encryptSecret(plainText, associatedData) {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(associatedData) },
    key,
    encoder.encode(plainText)
  );
  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(cipher))}`;
}

export async function decryptSecret(sealed, associatedData) {
  const key = await getCryptoKey();
  const [ivText, cipherText] = String(sealed || '').split('.');
  if (!ivText || !cipherText) throw new AiError(AI_ERROR_CODES.CLASS_CODE_INVALID);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64Url(ivText), additionalData: encoder.encode(associatedData) },
      key,
      fromBase64Url(cipherText)
    );
    return decoder.decode(plain);
  } catch {
    // 비밀값이 바뀌었거나 레코드가 손상된 경우 — 학생에게는 코드 문제로만 알린다.
    throw new AiError(AI_ERROR_CODES.CLASS_CODE_INVALID);
  }
}
