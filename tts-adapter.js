/* ─────────────────────────────────────────────────────────────────────────
 * 음성 합성 어댑터 — 앱에서 «글자를 소리로 바꾸는» 유일한 출입구.
 *
 * 앱의 다른 코드는 이 파일의 NB_TTS 만 부른다. 서버를 붙일 때 고칠 곳도 여기 하나다.
 *
 *   설정 1줄:  config.js 의 NB_CONFIG.ttsApiBase 에 서버 주소를 적는다.
 *              (빌드 도구를 쓰는 앱이라면 .env 의 VITE_TTS_API_BASE — src/services/tts/ttsAdapter.ts 참고)
 *   주소가 비어 있으면 자동으로 mock 으로 동작한다 (서버 없이도 화면이 끝까지 돈다).
 *
 * 인터페이스
 *   NB_TTS.mode()          -> 'server' | 'mock'
 *   NB_TTS.health()        -> Promise<{ configured:boolean, speakers:Array }|null>
 *   NB_TTS.synthesize({ text, speaker, speed, pitch, format })
 *                          -> Promise<ArrayBuffer|null>
 *                             ArrayBuffer = 재생할 소리
 *                             null        = 이 기기에 설치된 목소리로 읽으라는 뜻
 * ───────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  var CFG = global.NB_CONFIG || {};

  function baseUrl() {
    // TODO(handoff): 실서버 연동 — 여기 한 줄(config.js 의 ttsApiBase)만 채우면 serverTts 로 전환된다.
    var base = CFG.ttsApiBase || CFG.proxyBase || '';
    if (CFG.allowQueryOverride !== false) {
      try {
        var q = new URLSearchParams(global.location.search).get('voice');
        if (q) base = q;
      } catch (e) { /* 구형 브라우저 */ }
    }
    return String(base || '').replace(/\/+$/, '');
  }

  function fetchWithTimeout(url, opts, ms) {
    opts = opts || {};
    if (!global.fetch) return Promise.reject(new Error('no-fetch'));
    if (!global.AbortController) return global.fetch(url, opts);
    var ac = new AbortController();
    opts.signal = ac.signal;
    var t = setTimeout(function () { ac.abort(); }, ms || 10000);
    return global.fetch(url, opts).then(
      function (r) { clearTimeout(t); return r; },
      function (e) { clearTimeout(t); throw e; }
    );
  }

  /* ── mock 구현 ────────────────────────────────────────────────────────
   * 서버가 없을 때 쓴다. 미리 만들어 둔 데모 mp3 가 있으면 그것을 돌려주고,
   * 없으면 null 을 돌려 브라우저에 설치된 목소리로 읽게 한다.
   * 화면에는 «데모 음성 — 실서비스에선 서버에서 합성됩니다» 안내가 함께 뜬다. */
  var DEMO_DIR = 'voice-samples/';
  var demoIndex = null;           // { '<대본 앞머리>': '<파일 번호>' }

  function demoKey(text) {
    return String(text || '').replace(/\s+/g, '').slice(0, 24);
  }
  function buildDemoIndex() {
    if (demoIndex) return demoIndex;
    demoIndex = {};
    var D = global.NB_SAMPLES;
    if (D && D.scripts) {
      D.scripts.forEach(function (s) { demoIndex[demoKey(s.text)] = s.no; });
    }
    return demoIndex;
  }

  var mockTts = {
    name: 'mock',
    health: function () {
      return Promise.resolve(null);   // 서버 없음 -> 기기 목소리 모드
    },
    synthesize: function (req) {
      var idx = buildDemoIndex();
      var no = idx[demoKey(req.text)];
      if (!no || !req.speaker) return Promise.resolve(null);
      // 미리 합성해 둔 데모 mp3 (문안 3종 × 화자 4명)
      return fetchWithTimeout(DEMO_DIR + req.speaker + '_' + no + '.mp3', { method: 'GET' }, 8000)
        .then(function (r) { return r.ok ? r.arrayBuffer() : null; })
        .catch(function () { return null; });
    }
  };

  /* ── server 구현 ──────────────────────────────────────────────────────
   * 규격은 docs/HANDOFF_FOR_DEV.md §3 «서버가 제공해야 할 API» 와 같다.
   *   GET  {base}/health  -> { configured:boolean, speakers:[{code,name,gender,desc}] }
   *   POST {base}/tts     -> audio/mpeg 본문 또는 { audioUrl } (성공) / { error, message } (실패)
   * 실패 JSON: { error:'<코드>', message:'<사람이 읽을 안내>' } */
  var serverTts = {
    name: 'server',
    health: function () {
      var base = baseUrl();
      if (!base) return Promise.resolve(null);
      return fetchWithTimeout(base + '/health', { method: 'GET' }, 6000)
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    },
    synthesize: function (req) {
      var base = baseUrl();
      // TODO(handoff): 서버가 인증을 요구하면 여기에 헤더를 추가한다 (예: Authorization).
      //                클로바 Client ID/Secret 은 절대 이 파일에 두지 않는다 — 서버 안에만 둔다.
      return fetchWithTimeout(base + '/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: req.text,
          speaker: req.speaker || '',
          speed: req.speed || 0,
          pitch: req.pitch || 0,
          volume: 0,
          format: req.format || 'mp3'
        })
      }, 25000).then(function (r) {
        if (r.ok) {
          // 서버는 둘 중 아무 모양으로나 답해도 된다: mp3 본문, 또는 { audioUrl } JSON
          var ct = (r.headers.get('content-type') || '').toLowerCase();
          if (ct.indexOf('application/json') < 0) return r.arrayBuffer();
          return r.json().then(function (j) {
            if (!j || !j.audioUrl) throw new Error('no-audio-url');
            return fetchWithTimeout(j.audioUrl, { method: 'GET' }, 25000)
              .then(function (a) { return a.arrayBuffer(); });
          });
        }
        return r.json().catch(function () { return {}; }).then(function (j) {
          var e = new Error(j.message || '음성을 만들지 못했습니다.');
          e.code = j.error || 'upstream_error';
          e.human = j.message || '음성을 만들지 못했습니다.';
          throw e;
        });
      });
    }
  };

  function impl() { return baseUrl() ? serverTts : mockTts; }

  global.NB_TTS = {
    mode: function () { return impl().name; },
    base: baseUrl,
    health: function () { return impl().health(); },
    synthesize: function (req) { return impl().synthesize(req || {}); },
    // 시험·검증용으로 구현을 직접 들여다볼 수 있게 열어 둔다
    _mock: mockTts,
    _server: serverTts
  };
})(window);
