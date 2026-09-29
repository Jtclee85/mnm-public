const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.join(__dirname, '..');
const CHANNELS_FILE = path.join(ROOT_DIR, 'lib', 'approvedYoutubeChannels.js');

function loadEnvLocal() {
  const envPath = path.join(ROOT_DIR, '.env.local');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && !process.env[key]) process.env[key] = value;
  }
}

function loadApprovedChannels() {
  const source = fs.readFileSync(CHANNELS_FILE, 'utf8');
  const transformed = source
    .replace('export const APPROVED_YOUTUBE_CHANNELS =', 'const APPROVED_YOUTUBE_CHANNELS =')
    .replace('export function getActiveApprovedYoutubeChannels()', 'function getActiveApprovedYoutubeChannels()');

  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${transformed}\nthis.APPROVED_YOUTUBE_CHANNELS = APPROVED_YOUTUBE_CHANNELS;`, sandbox, {
    filename: CHANNELS_FILE,
  });

  return Array.isArray(sandbox.APPROVED_YOUTUBE_CHANNELS) ? sandbox.APPROVED_YOUTUBE_CHANNELS : [];
}

function shortText(text = '', max = 90) {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

async function fetchJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`YouTube API 오류 ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }

  return data;
}

async function resolveByHandle(handle, apiKey) {
  const cleanHandle = String(handle || '').replace(/^@/, '').trim();
  if (!cleanHandle) return [];

  const params = new URLSearchParams({
    part: 'snippet',
    forHandle: `@${cleanHandle}`,
    key: apiKey,
  });

  const data = await fetchJson(`https://www.googleapis.com/youtube/v3/channels?${params}`);
  return (data.items || []).map(item => ({
    source: 'channels.list forHandle',
    channelId: item.id,
    title: item.snippet?.title || '',
    description: item.snippet?.description || '',
    customUrl: item.snippet?.customUrl || '',
  }));
}

async function searchChannelCandidates(searchName, apiKey) {
  const q = String(searchName || '').trim();
  if (!q) return [];

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'channel',
    q,
    maxResults: '5',
    relevanceLanguage: 'ko',
    regionCode: 'KR',
    key: apiKey,
  });

  const data = await fetchJson(`https://www.googleapis.com/youtube/v3/search?${params}`);
  return (data.items || []).map(item => ({
    source: 'search.list',
    channelId: item.snippet?.channelId || item.id?.channelId || '',
    title: item.snippet?.title || '',
    description: item.snippet?.description || '',
    customUrl: '',
  }));
}

async function main() {
  loadEnvLocal();

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('YOUTUBE_API_KEY가 없습니다. .env.local 또는 환경변수에 설정해 주세요.');
    process.exit(1);
  }

  const approvedChannels = loadApprovedChannels();

  console.log('\n승인 채널 channelId 후보 조회 결과');
  console.log('주의: 아래 결과는 자동 확정이 아닙니다. 교사가 채널명과 설명을 확인한 뒤 channelId를 직접 복사하세요.\n');

  for (const channel of approvedChannels) {
    console.log('='.repeat(80));
    console.log(`승인 후보: ${channel.name}`);
    console.log(`검색명: ${channel.searchName || '-'}`);
    console.log(`handle: ${channel.handle || '-'}`);
    console.log(`현재 channelId: ${channel.channelId || '(비어 있음)'}`);
    console.log('-'.repeat(80));

    let candidates = [];

    try {
      if (channel.handle) {
        candidates = await resolveByHandle(channel.handle, apiKey);
      }

      if (candidates.length === 0) {
        candidates = await searchChannelCandidates(channel.searchName || channel.name, apiKey);
      }

      if (candidates.length === 0) {
        console.log('후보 없음');
        continue;
      }

      candidates.forEach((candidate, index) => {
        console.log(`[${index + 1}] ${candidate.title}`);
        console.log(`    channelId: ${candidate.channelId}`);
        console.log(`    source: ${candidate.source}`);
        if (candidate.customUrl) console.log(`    customUrl: ${candidate.customUrl}`);
        console.log(`    description: ${shortText(candidate.description)}`);
      });
    } catch (error) {
      console.error(`조회 실패: ${error.message}`);
    }
  }

  console.log('\n완료.');
  console.log('맞는 채널의 channelId만 lib/approvedYoutubeChannels.js에 직접 복사해 넣으세요.\n');
}

main();
