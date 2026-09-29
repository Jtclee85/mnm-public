#!/usr/bin/env node
/**
 * 연구대회 USB 제출 패키지 생성 스크립트
 *
 * submission-template/ 을 dist-submission/ 으로 복사하면서
 * {{PLACEHOLDER}}를 lib/submissionMeta.js 값으로 치환하고,
 * 결과물에 시도명/학교명/출품자명 등 금지어가 없는지 점검한다.
 *
 * 사용법: npm run build:submission
 * Node.js 기본 모듈(fs, path)만 사용한다.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TEMPLATE_DIR = path.join(ROOT, 'submission-template');
const OUTPUT_DIR = path.join(ROOT, 'dist-submission');
const META_PATH = path.join(ROOT, 'lib', 'submissionMeta.js');
const OFFLINE_BUILD_DIR = path.join(ROOT, '.next-offline');
const PROGRAM_OUTPUT_DIR = path.join(OUTPUT_DIR, 'program');
const OFFLINE_OUTPUT_DIR = path.join(PROGRAM_OUTPUT_DIR, 'offline-demo');
const SHARE_OUTPUT_DIR = path.join(PROGRAM_OUTPUT_DIR, 'share');
const NEXT_OUTPUT_DIR = path.join(PROGRAM_OUTPUT_DIR, '_next');
const SOURCE_OUTPUT_DIR = path.join(OUTPUT_DIR, 'source');
const MEDIA_OUTPUT_DIR = path.join(OUTPUT_DIR, 'media');
const MEDIA_IMAGE_OUTPUT_DIR = path.join(MEDIA_OUTPUT_DIR, 'image');
const DEMO_LOCAL_PATH = path.join(ROOT, 'submission-demo', 'demo-snapshot.local.json');
const DEMO_EXAMPLE_PATH = path.join(ROOT, 'submission-demo', 'demo-snapshot.example.json');

// 개발한 폴더 구조를 유지하되, 계정 연결 정보·개인 설정·빌드 산출물은 애초에 복사하지 않는다.
const SOURCE_ROOT_ENTRIES = [
  '.gitattributes',
  '.gitignore',
  'README.md',
  'components',
  'lib',
  'next.config.js',
  'package-lock.json',
  'package.json',
  'pages',
  'playwright.config.js',
  'public',
  'scripts',
  'styles',
  'submission-demo',
  'submission-template',
  'tests',
];
const SOURCE_EXCLUDED_NAMES = new Set([
  '.git', '.github', '.vercel', '.claude', '.agents', '.codex',
  'node_modules', '.next', '.next-offline', 'dist-submission',
  'test-results', 'playwright-report', '.DS_Store',
  'AGENTS.md', 'CLAUDE.md',
]);
const SOURCE_FORBIDDEN_FILE_EXTENSIONS = new Set(['.pem', '.key', '.p12', '.pfx']);
const SOURCE_TEXT_EXTENSIONS = new Set([
  '.css', '.html', '.js', '.json', '.md', '.mjs', '.cjs', '.txt', '.yml', '.yaml',
]);

// 실행용 이미지 자산은 program/ 아래에 두어 index.html과 오프라인 화면이 file://로 읽게 한다.
const TITLE_LOGO_SRC = path.join(ROOT, 'public', 'title-mnm.png');
const TITLE_LOGO_OUT = path.join(PROGRAM_OUTPUT_DIR, 'assets', 'title-mnm.png');
const MASCOT_CANDIDATES = [
  path.join(ROOT, 'public', 'chatbot-mascot.png'),
  path.join(ROOT, 'public', 'images', 'chatbot-mascot.png'),
];
const MASCOT_OUT = path.join(PROGRAM_OUTPUT_DIR, 'assets', 'chatbot-mascot.png');
const YOUTUBE_FALLBACK_SRC = path.join(ROOT, 'public', 'images', 'youtube_not_found_nbg.webp');
const YOUTUBE_FALLBACK_OUT = path.join(PROGRAM_OUTPUT_DIR, 'images', 'youtube_not_found_nbg.webp');
const MEDIA_IMAGE_SOURCES = [
  path.join(ROOT, 'public', 'title-mnm.png'),
  path.join(ROOT, 'public', 'chatbot-mascot.png'),
  YOUTUBE_FALLBACK_SRC,
];

// ── 1. lib/submissionMeta.js 읽기 ──
// ESM(export const) 파일이므로 CJS require 대신 export 키워드를 제거한 뒤 평가한다.
function loadSubmissionMeta() {
  const source = fs.readFileSync(META_PATH, 'utf8').replace(/^export\s+const/gm, 'const');
  return new Function(`
    ${source}
    return {
      SUBMISSION_APP_NAME,
      SUBMISSION_REPORT_TITLE,
      SUBMISSION_TARGET_GRADE,
      SUBMISSION_DESCRIPTION,
      SUBMISSION_APP_URL,
    };
  `)();
}

// ── 2. dist-submission/ 안전하게 초기화 ──
// 실수로 다른 경로를 지우지 않도록 레포 루트 바로 아래의 dist-submission만 허용한다.
function resetOutputDir() {
  const resolved = path.resolve(OUTPUT_DIR);
  if (path.dirname(resolved) !== path.resolve(ROOT) || path.basename(resolved) !== 'dist-submission') {
    throw new Error(`예상하지 못한 출력 경로입니다: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
  fs.mkdirSync(resolved, { recursive: true });
}

// ── 3. 제출 시작 파일 복사 + placeholder 치환 ──
function copySubmissionShell(meta) {
  const replacements = {
    '{{APP_NAME}}': meta.SUBMISSION_APP_NAME,
    '{{REPORT_TITLE}}': meta.SUBMISSION_REPORT_TITLE,
    '{{TARGET_GRADE}}': meta.SUBMISSION_TARGET_GRADE,
    '{{DESCRIPTION}}': meta.SUBMISSION_DESCRIPTION,
    '{{APP_URL}}': meta.SUBMISSION_APP_URL,
  };

  fs.mkdirSync(PROGRAM_OUTPUT_DIR, { recursive: true });
  for (const filename of ['index.html', '실행안내.txt']) {
    const srcPath = path.join(TEMPLATE_DIR, filename);
    const destPath = path.join(PROGRAM_OUTPUT_DIR, filename);
    let content = fs.readFileSync(srcPath, 'utf8');
    for (const [placeholder, value] of Object.entries(replacements)) {
      content = content.split(placeholder).join(value);
    }
    fs.writeFileSync(destPath, content);
    if (filename === 'index.html') rewriteHtmlAssetPaths(destPath, 0);
  }
}

function copyTitleLogo() {
  if (!fs.existsSync(TITLE_LOGO_SRC)) return false;
  fs.mkdirSync(path.dirname(TITLE_LOGO_OUT), { recursive: true });
  fs.copyFileSync(TITLE_LOGO_SRC, TITLE_LOGO_OUT);
  return true;
}

// ── 3-1. 실제 앱 컴포넌트 기반 오프라인 데모 정적 export ──
function buildOfflineDemo() {
  if (!fs.existsSync(DEMO_LOCAL_PATH)) {
    console.warn('경고: submission-demo/demo-snapshot.local.json이 없습니다.');
    console.warn('       submission-demo/demo-snapshot.example.json으로 오프라인 데모를 생성합니다.');
    console.warn('       실제 심사용 패키지에는 앱에서 내보낸 세션 스냅샷을 넣어 주세요.\n');
  }
  if (!fs.existsSync(DEMO_LOCAL_PATH) && !fs.existsSync(DEMO_EXAMPLE_PATH)) {
    throw new Error('오프라인 데모 snapshot 파일이 없습니다. submission-demo/demo-snapshot.example.json을 확인하세요.');
  }

  fs.rmSync(OFFLINE_BUILD_DIR, { recursive: true, force: true });

  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'build'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_OFFLINE_DEMO_MODE: 'true',
      NEXT_PUBLIC_SUBMISSION_MODE: 'false',
    },
  });

  if (result.status !== 0) {
    throw new Error('오프라인 데모 정적 빌드에 실패했습니다.');
  }

  const offlinePageCandidates = [
    path.join(OFFLINE_BUILD_DIR, 'offline-demo', 'index.html'),
    path.join(OFFLINE_BUILD_DIR, 'offline-demo.html'),
  ];
  const offlinePage = offlinePageCandidates.find((p) => fs.existsSync(p));
  if (!offlinePage) {
    throw new Error(`오프라인 데모 export 결과를 찾을 수 없습니다: ${offlinePageCandidates.join(', ')}`);
  }

  fs.mkdirSync(OFFLINE_OUTPUT_DIR, { recursive: true });
  const offlineIndexOut = path.join(OFFLINE_OUTPUT_DIR, 'index.html');
  fs.copyFileSync(offlinePage, offlineIndexOut);
  rewriteHtmlAssetPaths(offlineIndexOut, 1);
  copyDirIfExists(path.join(OFFLINE_BUILD_DIR, '_next'), NEXT_OUTPUT_DIR);
  copyExportedPageToSubmission('share', SHARE_OUTPUT_DIR);
  rewriteSharedNextAssets();

  return fs.existsSync(DEMO_LOCAL_PATH);
}

function copyExportedPageToSubmission(routeName, destDir) {
  const pageCandidates = [
    path.join(OFFLINE_BUILD_DIR, routeName, 'index.html'),
    path.join(OFFLINE_BUILD_DIR, `${routeName}.html`),
  ];
  const pagePath = pageCandidates.find((p) => fs.existsSync(p));
  if (!pagePath) {
    throw new Error(`${routeName} export 결과를 찾을 수 없습니다: ${pageCandidates.join(', ')}`);
  }

  fs.mkdirSync(destDir, { recursive: true });
  const indexOut = path.join(destDir, 'index.html');
  fs.copyFileSync(pagePath, indexOut);
  rewriteHtmlAssetPaths(indexOut, 1);
}

function rewriteHtmlAssetPaths(htmlPath, depth) {
  const prefix = depth === 0 ? './' : '../';
  let html = fs.readFileSync(htmlPath, 'utf8')
    // Chrome blocks file:// script/link loads when crossorigin is present. The files are local.
    .replace(/\s+crossorigin(?:="")?/g, '');

  html = html.replace(
    /\b(src|href)=("|')\/(_next|assets|images|offline-demo|share)\//g,
    (_match, attr, quote, dir) => `${attr}=${quote}${prefix}${dir}/`
  );

  fs.writeFileSync(htmlPath, html);
}

function rewriteSharedNextAssets() {
  if (!fs.existsSync(NEXT_OUTPUT_DIR)) return;
  const textExts = new Set(['.js', '.css']);

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!textExts.has(path.extname(entry.name))) continue;

      let content = fs.readFileSync(fullPath, 'utf8');
      if (path.extname(entry.name) === '.js') {
        content = content
          .replaceAll('"/_next/', '"../_next/')
          .replaceAll("'/_next/", "'../_next/")
          .replaceAll('`/_next/', '`../_next/')
          .replaceAll('"/assets/', '"../assets/')
          .replaceAll("'\/assets/", "'../assets/")
          .replaceAll('`/assets/', '`../assets/')
          .replaceAll('"/images/', '"../images/')
          .replaceAll("'/images/", "'../images/")
          .replaceAll('`/images/', '`../images/');
      }
      if (path.extname(entry.name) === '.css') {
        content = content.replace(/url\((["']?)\/_next\/static\/media\//g, 'url($1../media/');
      }
      fs.writeFileSync(fullPath, content);
    }
  };

  walk(NEXT_OUTPUT_DIR);
}

function copyDirIfExists(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) copyDirIfExists(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

function normalizeRelativePath(relPath) {
  return relPath.split(path.sep).join('/');
}

function shouldExcludeSourcePath(relPath) {
  const normalized = normalizeRelativePath(relPath);
  const parts = normalized.split('/');
  const basename = parts.at(-1) || '';

  if (normalized === 'submission-demo/demo-snapshot.local.json') return true;
  if (parts.some(part => SOURCE_EXCLUDED_NAMES.has(part))) return true;
  if (basename.startsWith('.env')) return true;
  if (basename.endsWith('.log')) return true;
  return SOURCE_FORBIDDEN_FILE_EXTENSIONS.has(path.extname(basename).toLowerCase());
}

function copySourcePath(relPath) {
  if (shouldExcludeSourcePath(relPath)) return 0;

  const srcPath = path.join(ROOT, relPath);
  const destPath = path.join(SOURCE_OUTPUT_DIR, relPath);
  const stat = fs.lstatSync(srcPath);

  // 제출 소스가 작업 폴더 밖의 파일을 가리키지 않도록 심볼릭 링크는 포함하지 않는다.
  if (stat.isSymbolicLink()) return 0;
  if (stat.isDirectory()) {
    fs.mkdirSync(destPath, { recursive: true });
    return fs.readdirSync(srcPath)
      .reduce((count, entry) => count + copySourcePath(path.join(relPath, entry)), 0);
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
  return 1;
}

function copySourceTree() {
  fs.mkdirSync(SOURCE_OUTPUT_DIR, { recursive: true });
  return SOURCE_ROOT_ENTRIES.reduce((count, entry) => {
    const srcPath = path.join(ROOT, entry);
    if (!fs.existsSync(srcPath)) {
      throw new Error(`제출 소스 필수 항목이 없습니다: ${entry}`);
    }
    return count + copySourcePath(entry);
  }, 0);
}

// ── 3-2. 챗봇 마스코트 이미지 복사 ──
function copyMascot() {
  const found = MASCOT_CANDIDATES.find((p) => fs.existsSync(p));
  if (!found) return false;
  fs.mkdirSync(path.dirname(MASCOT_OUT), { recursive: true });
  fs.copyFileSync(found, MASCOT_OUT);
  return true;
}

// 추천 영상을 찾지 못했을 때 보여 주는 자체 제작 이미지는 public 경로를 쓰므로,
// file://에서도 열리도록 제출물 루트에 별도로 복사한다.
function copyYoutubeFallbackImage() {
  if (!fs.existsSync(YOUTUBE_FALLBACK_SRC)) return false;
  fs.mkdirSync(path.dirname(YOUTUBE_FALLBACK_OUT), { recursive: true });
  fs.copyFileSync(YOUTUBE_FALLBACK_SRC, YOUTUBE_FALLBACK_OUT);
  return true;
}

// 대회 제출 규격의 media/image 폴더에는 앱에서 실제 사용하는 원본 이미지를
// 가공하거나 이름을 바꾸지 않고 그대로 복사한다. 영상·음원 폴더는 만들지 않는다.
function copyMediaImages() {
  fs.mkdirSync(MEDIA_IMAGE_OUTPUT_DIR, { recursive: true });
  return MEDIA_IMAGE_SOURCES.map(srcPath => {
    if (!fs.existsSync(srcPath)) {
      throw new Error(`멀티미디어 원본 이미지가 없습니다: ${path.relative(ROOT, srcPath)}`);
    }
    const filename = path.basename(srcPath);
    fs.copyFileSync(srcPath, path.join(MEDIA_IMAGE_OUTPUT_DIR, filename));
    return filename;
  });
}

// ── 4. 결과물 점검 ──
// 금지어(시도명/학교명/출품자명/계정명)와 치환되지 않은 placeholder를 검사한다.
// 레포 코드 전체가 아니라 dist-submission/ 결과물만 점검한다.
// 실제 이름·학교·계정명을 이 파일에 하드코딩하면 제출 소스 자체가 개인정보 단서가 된다.
// 로컬에서 추가로 검사할 값은 쉼표로 구분한 SUBMISSION_FORBIDDEN_TERMS로만 전달한다.
const LOCAL_FORBIDDEN_WORDS = String(process.env.SUBMISSION_FORBIDDEN_TERMS || '')
  .split(',')
  .map(word => word.trim())
  .filter(Boolean);
const FORBIDDEN_WORDS = [
  '시도명', '학교명', '출품자명',
  ...LOCAL_FORBIDDEN_WORDS,
  '아이브', '장원영',
  'api_key', 'apikey',
];
const FORBIDDEN_PATTERNS = [
  { label: 'OpenAI API key pattern', re: /sk-(?:proj-[A-Za-z0-9_-]{20,}|[A-Za-z0-9]{32,})/i },
  { label: 'email address pattern', re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { label: 'Google/YouTube API key pattern', re: /AIza[0-9A-Za-z_-]{20,}/ },
  { label: 'YOUTUBE_API_KEY 노출', re: /YOUTUBE_API_KEY/ },
  { label: 'YouTube 썸네일 URL(ytimg)', re: /ytimg\.com/i },
];

// 저작권 정책: YouTube 영상·음원·자막·썸네일 파일을 제출물에 포함하지 않는다.
// (앱 로고·마스코트 등 자체 png/svg는 허용)
const FORBIDDEN_FILE_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.mkv', '.mp3', '.m4a', '.srt', '.vtt'];
const FORBIDDEN_FILENAME_PATTERNS = [
  /ytimg/i, /hqdefault/i, /mqdefault/i, /sddefault/i, /maxresdefault/i, /youtube[-_]?thumb/i,
];

function verifyOutput(meta) {
  const problems = [];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(ROOT, fullPath);

      // 소스는 별도의 개인정보·비밀정보 검사 규칙으로 전수 검사한다.
      if (entry.isDirectory() && path.resolve(fullPath) === path.resolve(SOURCE_OUTPUT_DIR)) {
        continue;
      }

      for (const word of FORBIDDEN_WORDS) {
        if (entry.name.toLowerCase().includes(word.toLowerCase())) {
          problems.push(`금지어 발견 (파일명): ${relPath} ← "${word}"`);
        }
      }

      if (!entry.isDirectory()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (FORBIDDEN_FILE_EXTENSIONS.includes(ext)) {
          problems.push(`금지 파일 형식(영상·음원·자막): ${relPath} ← "${ext}"`);
        }
        for (const re of FORBIDDEN_FILENAME_PATTERNS) {
          if (re.test(entry.name)) {
            problems.push(`YouTube 썸네일/영상 파일 의심: ${relPath} ← ${re}`);
          }
        }
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (['.html', '.txt', '.js', '.css', '.json'].includes(path.extname(entry.name))) {
        // 텍스트 파일만 내용 검사 — 이미지 등 바이너리는 파일명 검사만 한다.
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const word of FORBIDDEN_WORDS) {
          if (content.toLowerCase().includes(word.toLowerCase())) {
            problems.push(`금지어 발견 (내용): ${relPath} ← "${word}"`);
          }
        }
        for (const { label, re } of FORBIDDEN_PATTERNS) {
          if (re.test(content)) {
            problems.push(`금지 패턴 발견 (내용): ${relPath} ← ${label}`);
          }
        }
        const leftover = content.match(/\{\{[A-Z_]+\}\}/g);
        if (leftover) {
          problems.push(`치환되지 않은 placeholder: ${relPath} ← ${[...new Set(leftover)].join(', ')}`);
        }
      }
    }
  };

  walk(OUTPUT_DIR);
  problems.push(...verifyFileProtocolPaths(meta));
  problems.push(...verifyMediaOutput());
  problems.push(...verifySourceOutput());
  return problems;
}

function verifyMediaOutput() {
  const problems = [];
  const expectedNames = MEDIA_IMAGE_SOURCES.map(srcPath => path.basename(srcPath)).sort();

  if (!fs.existsSync(MEDIA_IMAGE_OUTPUT_DIR)) {
    return ['멀티미디어 이미지 폴더가 없습니다: dist-submission/media/image'];
  }

  const actualNames = fs.readdirSync(MEDIA_IMAGE_OUTPUT_DIR).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    problems.push(
      `media/image 파일 구성이 다릅니다. 예상: ${expectedNames.join(', ')} / 실제: ${actualNames.join(', ')}`
    );
  }

  for (const srcPath of MEDIA_IMAGE_SOURCES) {
    const destPath = path.join(MEDIA_IMAGE_OUTPUT_DIR, path.basename(srcPath));
    if (!fs.existsSync(destPath)) continue;
    if (!fs.readFileSync(srcPath).equals(fs.readFileSync(destPath))) {
      problems.push(`media/image 원본과 내용이 다릅니다: ${path.basename(srcPath)}`);
    }
  }

  for (const unusedType of ['movie', 'sound']) {
    if (fs.existsSync(path.join(MEDIA_OUTPUT_DIR, unusedType))) {
      problems.push(`사용하지 않는 멀티미디어 폴더가 생성되었습니다: dist-submission/media/${unusedType}`);
    }
  }

  return problems;
}

function verifySourceOutput() {
  const problems = [];
  const forbiddenPatterns = [
    { label: '이메일 주소', re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
    { label: '로컬 사용자 절대경로', re: /\/Users\/[^/\s"'<>]+/i },
    { label: 'GitHub 개인 원격 주소', re: /(?:git@github\.com:[^\s"'<>]+|https?:\/\/github\.com\/[^/\s"'<>]+\/[^/\s"'<>]+\.git)/i },
    { label: 'Vercel 계정 연결 메타데이터', re: /"(?:orgId|projectId)"\s*:/i },
    { label: 'OpenAI API 키', re: /sk-(?:proj-[A-Za-z0-9_-]{20,}|[A-Za-z0-9]{32,})/i },
    { label: 'Google/YouTube API 키', re: /AIza[0-9A-Za-z_-]{20,}/ },
    { label: 'GitHub 접근 토큰', re: /(?:ghp|github_pat)_[A-Za-z0-9_]{20,}/i },
    { label: 'Vercel 접근 토큰', re: /(?:vercel|vcp)_[A-Za-z0-9_-]{20,}/i },
  ];

  for (const entry of SOURCE_ROOT_ENTRIES) {
    if (!fs.existsSync(path.join(SOURCE_OUTPUT_DIR, entry))) {
      problems.push(`제출 소스 필수 항목 누락: source/${entry}`);
    }
  }

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      const relFromSource = path.relative(SOURCE_OUTPUT_DIR, fullPath);
      const displayPath = path.join('dist-submission', 'source', relFromSource);

      if (shouldExcludeSourcePath(relFromSource)) {
        problems.push(`제출 소스 제외 대상 포함: ${displayPath}`);
      }
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (!SOURCE_TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const { label, re } of forbiddenPatterns) {
        if (re.test(content)) {
          problems.push(`제출 소스 개인정보·비밀정보 의심: ${displayPath} ← ${label}`);
        }
      }
    }
  };

  if (fs.existsSync(SOURCE_OUTPUT_DIR)) walk(SOURCE_OUTPUT_DIR);
  return problems;
}

function verifyFileProtocolPaths(meta) {
  const problems = [];
  const htmlTargets = [
    { rel: 'index.html', depth: 0 },
    { rel: path.join('offline-demo', 'index.html'), depth: 1 },
    { rel: path.join('share', 'index.html'), depth: 1 },
  ];
  const absoluteAssetAttr = /\b(?:src|href)=["']\/(?:_next|assets|images|offline-demo|share)\//;

  for (const { rel } of htmlTargets) {
    const fullPath = path.join(PROGRAM_OUTPUT_DIR, rel);
    if (!fs.existsSync(fullPath)) {
      problems.push(`필수 HTML 누락: ${path.join('dist-submission', 'program', rel)}`);
      continue;
    }
    const html = fs.readFileSync(fullPath, 'utf8');
    if (absoluteAssetAttr.test(html)) {
      problems.push(`file:// 절대 리소스 경로 잔존: ${path.join('dist-submission', 'program', rel)}`);
    }
  }

  const rootHtml = readOutputHtml('index.html');
  const offlineHtml = readOutputHtml(path.join('offline-demo', 'index.html'));
  const shareHtml = readOutputHtml(path.join('share', 'index.html'));

  if (rootHtml && !rootHtml.includes('href="./offline-demo/index.html"')) {
    problems.push('program/index.html의 오프라인 시연 링크가 ./offline-demo/index.html이 아닙니다.');
  }
  if (rootHtml && !rootHtml.includes(meta.SUBMISSION_REPORT_TITLE)) {
    problems.push('program/index.html에 최신 연구보고서 제목이 없습니다.');
  }
  if (rootHtml && !rootHtml.includes(meta.SUBMISSION_TARGET_GRADE)) {
    problems.push('program/index.html에 대상 학년이 없습니다.');
  }
  if (rootHtml && !rootHtml.includes('src="./assets/title-mnm.png"')) {
    problems.push('program/index.html에 뭐냐면 로고 이미지가 없습니다.');
  }
  const startPageLinks = rootHtml.match(/<a\b[^>]*>/g) || [];
  if (rootHtml && startPageLinks.length !== 2) {
    problems.push(`index.html의 실행 선택지는 2개여야 합니다. 현재: ${startPageLinks.length}개`);
  }
  for (const { label, matches } of [
    { label: '온라인 프로그램 실행', matches: anchor => /href="https:\/\//.test(anchor) },
    { label: '오프라인 시연 모드', matches: anchor => anchor.includes('href="./offline-demo/index.html"') },
  ]) {
    const link = startPageLinks.find(matches);
    if (!rootHtml.includes(`>${label}</a>`)) {
      problems.push(`index.html에 '${label}' 선택지가 없습니다.`);
    }
    if (!link || !link.includes('target="_blank"') || !link.includes('rel="noopener noreferrer"')) {
      problems.push(`index.html의 '${label}' 링크는 새 탭에서 안전하게 열려야 합니다.`);
    }
  }
  if (rootHtml && !/href="https:\/\//.test(startPageLinks[0] || '')) {
    problems.push('index.html의 첫 번째 선택지는 온라인 프로그램 실행이어야 합니다.');
  }
  if (rootHtml && !(startPageLinks[1] || '').includes('href="./offline-demo/index.html"')) {
    problems.push('index.html의 두 번째 선택지는 오프라인 시연 모드여야 합니다.');
  }
  if (offlineHtml && !offlineHtml.includes('../_next/')) {
    problems.push('offline-demo/index.html에서 ../_next/ 리소스 경로를 찾을 수 없습니다.');
  }
  if (shareHtml && !shareHtml.includes('../_next/')) {
    problems.push('share/index.html에서 ../_next/ 리소스 경로를 찾을 수 없습니다.');
  }
  if (!fs.existsSync(NEXT_OUTPUT_DIR)) {
    problems.push('dist-submission/program/_next 폴더가 없습니다.');
  }
  if (!fs.existsSync(TITLE_LOGO_OUT)) {
    problems.push('시작화면 로고가 없습니다: dist-submission/program/assets/title-mnm.png');
  }
  if (!fs.existsSync(YOUTUBE_FALLBACK_OUT)) {
    problems.push('추천 영상 대체 이미지가 없습니다: dist-submission/program/images/youtube_not_found_nbg.webp');
  }
  for (const nested of [
    path.join(OFFLINE_OUTPUT_DIR, '_next'),
    path.join(SHARE_OUTPUT_DIR, '_next'),
  ]) {
    if (fs.existsSync(nested)) {
      problems.push(`중복 _next 폴더가 남아 있습니다: ${path.relative(ROOT, nested)}`);
    }
  }

  return problems;
}

function readOutputHtml(relPath) {
  const fullPath = path.join(PROGRAM_OUTPUT_DIR, relPath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
}

// ── 실행 ──
function main() {
  if (!fs.existsSync(TEMPLATE_DIR)) {
    console.error(`오류: 템플릿 폴더가 없습니다 — ${TEMPLATE_DIR}`);
    process.exit(1);
  }

  const meta = loadSubmissionMeta();
  resetOutputDir();
  copySubmissionShell(meta);
  const usedRealSnapshot = buildOfflineDemo();
  const titleLogoCopied = copyTitleLogo();
  const mascotCopied = copyMascot();
  const youtubeFallbackCopied = copyYoutubeFallbackImage();
  const mediaImageNames = copyMediaImages();
  const sourceFileCount = copySourceTree();

  const problems = verifyOutput(meta);
  if (problems.length > 0) {
    console.error('제출 패키지 점검 실패 — 아래 문제를 해결한 뒤 다시 실행하세요.\n');
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
  }

  if (meta.SUBMISSION_APP_URL.includes('YOUR-DEPLOYED-APP-URL')) {
    console.warn('경고: lib/submissionMeta.js의 SUBMISSION_APP_URL이 아직 placeholder입니다. 실제 배포 주소로 수정하세요.\n');
  }

  console.log('제출 패키지 생성 완료: dist-submission/');
  console.log('  - program/index.html');
  console.log('  - program/실행안내.txt');
  console.log('  - program/offline-demo/index.html');
  console.log('  - program/share/index.html');
  console.log(`  - program/_next/static/* ${usedRealSnapshot ? '(실제 세션 스냅샷 기반)' : '(예시 스냅샷 기반)'}`);
  if (titleLogoCopied) console.log('  - program/assets/title-mnm.png');
  if (mascotCopied) console.log('  - program/assets/chatbot-mascot.png');
  if (youtubeFallbackCopied) console.log('  - program/images/youtube_not_found_nbg.webp');
  console.log(`  - media/image/* (${mediaImageNames.join(', ')})`);
  console.log(`  - source/* (개발 소스 ${sourceFileCount}개 파일, 개인 설정·계정 정보 제외)`);
  console.log('\n다음 단계: dist-submission/ 폴더를 USB에 복사하세요.');
  console.log('USB에서 program/index.html을 시작 파일로 실행하세요.');
}

main();
