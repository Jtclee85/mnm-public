// 테스트 전용 Upstash Redis 흉내 저장소(메모리). 앱이 쓰는 명령만 지원한다:
// GET, SET(NX/XX/EX), DEL, INCR, EXPIRE. E2E용 가짜 서버(mock-upstash-server.js)와
// 서버 단위 테스트(gemini-provider.spec.js)가 같은 로직을 쓴다.

function createMockUpstashStore() {
  const store = new Map();

  function readValue(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return entry;
  }

  function run(command) {
    const [name, ...args] = command.map(String);
    switch (name.toUpperCase()) {
      case 'GET': {
        const entry = readValue(args[0]);
        return entry ? entry.value : null;
      }
      case 'SET': {
        const [key, value, ...options] = args;
        const upper = options.map(o => o.toUpperCase());
        const exists = !!readValue(key);
        if (upper.includes('NX') && exists) return null;
        if (upper.includes('XX') && !exists) return null;
        const exIndex = upper.indexOf('EX');
        const expiresAt = exIndex >= 0 ? Date.now() + Number(options[exIndex + 1]) * 1000 : 0;
        store.set(key, { value, expiresAt });
        return 'OK';
      }
      case 'DEL':
        return args.reduce((count, key) => count + (store.delete(key) ? 1 : 0), 0);
      case 'INCR': {
        const entry = readValue(args[0]);
        const next = Number(entry?.value || 0) + 1;
        store.set(args[0], { value: String(next), expiresAt: entry?.expiresAt || 0 });
        return next;
      }
      case 'EXPIRE': {
        const entry = readValue(args[0]);
        if (!entry) return 0;
        entry.expiresAt = Date.now() + Number(args[1]) * 1000;
        return 1;
      }
      default:
        throw new Error(`ERR unknown command '${name}'`);
    }
  }

  // Upstash REST 요청 하나를 처리한다: path '' | '/pipeline', body는 JSON 배열.
  function handle(path, body) {
    if (path === '/pipeline') {
      return {
        status: 200,
        body: body.map(cmd => {
          try { return { result: run(cmd) }; } catch (e) { return { error: e.message }; }
        }),
      };
    }
    try {
      return { status: 200, body: { result: run(body) } };
    } catch (e) {
      return { status: 400, body: { error: e.message } };
    }
  }

  return { handle, clear: () => store.clear(), raw: store };
}

module.exports = { createMockUpstashStore };
