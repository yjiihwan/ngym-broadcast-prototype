/* 엔짐 이용안내 자동방송 — 공용 엔진 (저장 / 목소리 / 재생 / 예약) */
(function (global) {
  'use strict';

  var LS = 'ngym_bcast_v1';
  var LS_FIRED = 'ngym_bcast_fired_v1';
  var LS_LOG = 'ngym_bcast_log_v1';
  var DAYS = ['일', '월', '화', '수', '목', '금', '토'];

  /* ---------------- 유틸 ---------------- */
  function uid(p) { return (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function hhmm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hash(str) { var h = 0x811c9dc5, i; for (i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; } return h.toString(36); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------------- 기본 데이터 ---------------- */
  var SEED_CENTERS = [
    { id: 'c_gangnam', name: '엔짐 강남', defaultVoice: { gender: 'female', voiceURI: '', rate: 1 } },
    { id: 'c_pangyo', name: '엔짐 판교', defaultVoice: { gender: 'male', voiceURI: '', rate: 0.95 } },
    { id: 'c_songdo', name: '엔짐 송도', defaultVoice: { gender: 'female', voiceURI: '', rate: 1.05 } }
  ];

  function seedBroadcasts() {
    return [
      {
        id: uid('b'), centerId: 'c_gangnam', name: '마감 30분 전 안내', enabled: true,
        script: '회원님, 안녕하세요. 엔짐 강남입니다. 금일 영업 종료 삼십 분 전입니다. 이용을 마치신 회원님께서는 샤워실과 라커룸 이용에 참고해 주시기 바랍니다. 오늘도 엔짐을 찾아주셔서 감사합니다.',
        voice: { gender: '', voiceURI: '', rate: 0 }, repeat: 1,
        schedule: { type: 'weekly', days: [1, 2, 3, 4, 5], times: ['21:30'], date: '', time: '' }
      },
      {
        id: uid('b'), centerId: 'c_gangnam', name: '기구 정리 안내', enabled: true,
        script: '회원님께 안내 말씀 드립니다. 사용하신 덤벨과 원판은 제자리에 정리해 주시고, 벤치와 매트는 비치된 클리너로 닦아주시기 바랍니다. 쾌적한 운동 환경을 위해 협조해 주셔서 감사합니다.',
        voice: { gender: 'male', voiceURI: '', rate: 0.95 }, repeat: 1,
        schedule: { type: 'weekly', days: [1, 2, 3, 4, 5, 6, 0], times: ['12:00', '19:00'], date: '', time: '' }
      },
      {
        id: uid('b'), centerId: 'c_gangnam', name: '주차 등록 안내', enabled: false,
        script: '주차 차량 안내 말씀 드립니다. 차량을 가지고 오신 회원님께서는 프런트에서 주차 등록을 진행해 주시기 바랍니다. 미등록 차량은 주차 요금이 부과될 수 있습니다.',
        voice: { gender: '', voiceURI: '', rate: 0 }, repeat: 2,
        schedule: { type: 'once', days: [], times: [], date: ymd(new Date()), time: '18:00' }
      },
      {
        id: uid('b'), centerId: 'c_pangyo', name: '개인 레슨 안내', enabled: true,
        script: '엔짐 판교를 이용해 주시는 회원님께 안내 드립니다. 전문 트레이너와 함께하는 일대일 퍼스널 레슨을 프런트에서 상담하실 수 있습니다. 편하신 시간에 문의해 주시기 바랍니다.',
        voice: { gender: '', voiceURI: '', rate: 0 }, repeat: 1,
        schedule: { type: 'weekly', days: [2, 4], times: ['18:30'], date: '', time: '' }
      }
    ];
  }

  function freshState() {
    return { centers: clone(SEED_CENTERS), activeCenterId: 'c_gangnam', broadcasts: seedBroadcasts(), v: 1 };
  }

  /* ---------------- 저장소 ---------------- */
  var Store = {
    state: null,
    subs: [],
    load: function () {
      try {
        var raw = localStorage.getItem(LS);
        if (raw) {
          var s = JSON.parse(raw);
          if (s && s.centers && s.broadcasts) { this.state = s; return this.state; }
        }
      } catch (e) { /* 손상된 저장값은 무시하고 초기화 */ }
      this.state = freshState();
      this.save();
      return this.state;
    },
    save: function () {
      try { localStorage.setItem(LS, JSON.stringify(this.state)); } catch (e) { }
      this.emit();
    },
    reset: function () { this.state = freshState(); this.save(); },
    emit: function () { var s = this.state; this.subs.forEach(function (f) { try { f(s); } catch (e) { } }); },
    sub: function (f) { this.subs.push(f); },
    center: function (id) {
      var cid = id || this.state.activeCenterId;
      return this.state.centers.filter(function (c) { return c.id === cid; })[0] || this.state.centers[0];
    },
    listFor: function (cid) {
      return this.state.broadcasts.filter(function (b) { return b.centerId === cid; });
    },
    get: function (bid) { return this.state.broadcasts.filter(function (b) { return b.id === bid; })[0]; },
    upsert: function (b) {
      var i = this.state.broadcasts.map(function (x) { return x.id; }).indexOf(b.id);
      if (i >= 0) this.state.broadcasts[i] = b; else this.state.broadcasts.push(b);
      this.save();
    },
    remove: function (bid) {
      this.state.broadcasts = this.state.broadcasts.filter(function (b) { return b.id !== bid; });
      this.save();
    }
  };

  // 관리 화면에서 바꾸면 송출 화면이 즉시 따라오도록 (같은 브라우저의 다른 탭)
  global.addEventListener('storage', function (e) {
    if (e.key === LS) { try { Store.state = JSON.parse(e.newValue); Store.emit(); } catch (err) { } }
    if (e.key === LS_LOG && Store.onLogChange) Store.onLogChange();
  });

  /* ---------------- 음성 엔진 (클로바 중계 서버) ---------------- */
  // 비밀 열쇠는 중계 서버에만 있다. 이 파일이 하는 일은 «문구를 보내고 소리를 받아오는» 것뿐이다.
  // 중계 서버 주소가 없거나 서버가 응답하지 않으면 이 기기에 설치된 기본 목소리로 내려간다.
  var Engine = {
    base: '',
    mode: 'device',            // 'clova' | 'device'
    speakers: [],
    note: '샘플 음성(임시) — 이 기기에 설치된 목소리로 읽습니다.',
    lastError: '',
    probed: false,
    onChange: null,

    init: function () {
      var cfg = global.NB_CONFIG || {};
      var base = cfg.proxyBase || '';
      if (cfg.allowQueryOverride !== false) {
        try {
          var q = new URLSearchParams(location.search).get('voice');
          if (q) base = q;
        } catch (e) { }
      }
      this.base = String(base || '').replace(/\/+$/, '');
      return this.base;
    },

    setMode: function (mode, note) {
      var changed = this.mode !== mode || this.note !== note;
      this.mode = mode; this.note = note;
      if (changed && this.onChange) { try { this.onChange(this); } catch (e) { } }
    },

    // 중계 서버가 살아 있는지, 열쇠가 꽂혀 있는지 한 번 물어본다
    probe: function () {
      var self = this;
      if (this.probed) return Promise.resolve(this);
      this.init();
      this.probed = true;
      if (!this.base) {
        this.setMode('device', '샘플 음성(임시) — 이 기기에 설치된 목소리로 읽습니다.');
        return Promise.resolve(this);
      }
      return fetchWithTimeout(this.base + '/health', { method: 'GET' }, 6000)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (j && j.configured && j.speakers && j.speakers.length) {
            self.speakers = j.speakers;
            self.setMode('clova', '클로바보이스 — 고품질 안내 음성');
          } else {
            self.setMode('device', '샘플 음성(임시) — 음성 열쇠가 아직 서버에 없어 기기 목소리로 읽습니다.');
          }
          return self;
        })
        .catch(function () {
          self.setMode('device', '샘플 음성(임시) — 음성 서버에 연결하지 못해 기기 목소리로 읽습니다.');
          return self;
        });
    },

    // 사람이 쓰는 «배속»(0.6~1.6) 을 클로바 speed 눈금(-5~5)으로 바꾼다.
    // 클로바는 숫자가 클수록 느리다 — 그래서 부호를 뒤집는다.
    rateToSpeed: function (rate) {
      var r = Math.max(0.6, Math.min(1.6, Number(rate) || 1));
      var s = r >= 1 ? -((r - 1) / 0.6) * 5 : ((1 - r) / 0.4) * 5;
      return Math.max(-5, Math.min(5, Math.round(s)));
    },

    // 문구 한 덩어리를 소리(ArrayBuffer)로 바꿔 온다
    synth: function (text, opt) {
      var self = this;
      opt = opt || {};
      var payload = {
        text: text,
        speaker: opt.speaker || '',
        speed: this.rateToSpeed(opt.rate),
        pitch: Math.max(-5, Math.min(5, Math.round(Number(opt.pitch) || 0))),
        volume: 0,
        format: 'mp3'
      };
      return fetchWithTimeout(this.base + '/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, 25000).then(function (r) {
        if (r.ok) return r.arrayBuffer();
        return r.json().catch(function () { return {}; }).then(function (j) {
          var e = new Error(j.message || '음성을 만들지 못했습니다.');
          e.code = j.error || 'upstream_error';
          e.human = j.message || '음성을 만들지 못했습니다.';
          self.lastError = e.human;
          throw e;
        });
      });
    }
  };

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

  /* ---------------- 목소리 ---------------- */
  var GENDER_MAP = {
    yuna: 'female', '유나': 'female', flo: 'female', grandma: 'female', sandy: 'female', shelley: 'female',
    sunhi: 'female', heami: 'female', 'ko-kr-x-ism-local': 'female',
    eddy: 'male', grandpa: 'male', reed: 'male', rocko: 'male', injoon: 'male', 'ko-kr-x-kob-local': 'male'
  };
  var AGE_MAP = { grandma: '어르신', grandpa: '어르신' };

  function baseName(n) { return (n || '').split('(')[0].trim().toLowerCase(); }

  var Voices = {
    all: [],
    ko: [],          // 화면이 읽는 «지금 쓸 수 있는 목소리» 목록
    deviceKo: [],    // 이 기기에 설치된 목소리 (폴백용으로 항상 들고 있는다)
    refresh: function () {
      if (!global.speechSynthesis) { this.applyEngine(); return this.ko; }
      this.all = speechSynthesis.getVoices() || [];
      var self = this;
      this.deviceKo = this.all.filter(function (v) { return (v.lang || '').toLowerCase().indexOf('ko') === 0; })
        .map(function (v) {
          var b = baseName(v.name);
          return {
            uri: v.voiceURI, name: v.name, lang: v.lang, raw: v,
            gender: GENDER_MAP[b] || 'other',
            age: AGE_MAP[b] || '',
            label: self.labelOf(v.name, GENDER_MAP[b] || 'other', AGE_MAP[b] || '')
          };
        });
      this.applyEngine();
      return this.ko;
    },

    // 클로바가 살아 있으면 클로바 화자 목록을, 아니면 기기 목소리를 쓴다.
    // 목록 모양(uri/name/gender/label)이 같아서 아래 고르기·저장 로직은 그대로 돌아간다.
    applyEngine: function () {
      if (Engine.mode === 'clova' && Engine.speakers.length) {
        this.ko = Engine.speakers.map(function (s) {
          return {
            uri: s.code, name: s.name, lang: 'ko-KR', raw: null, clova: true,
            gender: s.gender || 'other', age: s.age || '',
            recommended: !!s.recommended,
            desc: s.desc || '',
            label: (s.gender === 'female' ? '여성' : s.gender === 'male' ? '남성' : '기타') + ' — ' + s.name + (s.desc ? ' · ' + s.desc : '')
          };
        });
      } else {
        this.ko = this.deviceKo.slice();
      }
      return this.ko;
    },
    labelOf: function (name, gender, age) {
      var g = gender === 'female' ? '여성' : gender === 'male' ? '남성' : '기타';
      return (age ? g + '·' + age : g) + ' — ' + name.split('(')[0].trim();
    },
    byUri: function (uri) {
      for (var i = 0; i < this.ko.length; i++) if (this.ko[i].uri === uri) return this.ko[i];
      return null;
    },
    // 클로바가 실패했을 때 대신 읽어줄 이 기기의 목소리 하나
    deviceFallback: function (gender) {
      var list = this.deviceKo, i;
      if (!list.length) return null;
      for (i = 0; i < list.length; i++) if (list[i].gender === gender && !list[i].age) return list[i];
      for (i = 0; i < list.length; i++) if (!list[i].age) return list[i];
      return list[0];
    },
    // 성별만 골랐을 때 그 기기에서 가장 무난한 화자 하나를 고른다
    pickGender: function (gender) {
      var i, j;
      // 클로바 목록에서는 «안내방송 추천» 표시가 붙은 화자를 먼저 고른다
      if (this.ko.length && this.ko[0].clova) {
        for (j = 0; j < this.ko.length; j++) if (this.ko[j].gender === gender && this.ko[j].recommended) return this.ko[j];
        for (j = 0; j < this.ko.length; j++) if (this.ko[j].gender === gender) return this.ko[j];
        for (j = 0; j < this.ko.length; j++) if (this.ko[j].recommended) return this.ko[j];
        return this.ko[0] || null;
      }
      var pref = gender === 'male'
        ? ['eddy', 'reed', 'rocko', 'injoon']
        : ['yuna', '유나', 'sunhi', 'heami', 'shelley', 'flo'];
      for (i = 0; i < pref.length; i++)
        for (j = 0; j < this.ko.length; j++)
          if (baseName(this.ko[j].name) === pref[i]) return this.ko[j];
      for (j = 0; j < this.ko.length; j++) if (this.ko[j].gender === gender && !this.ko[j].age) return this.ko[j];
      for (j = 0; j < this.ko.length; j++) if (this.ko[j].gender === gender) return this.ko[j];
      return this.ko[0] || null;
    },
    // 방송 설정 + 센터 기본값 -> 실제 사용할 화자/속도
    resolve: function (bcast, center) {
      var dv = (center && center.defaultVoice) || { gender: 'female', voiceURI: '', rate: 1 };
      var bv = (bcast && bcast.voice) || {};
      var rate = bv.rate ? bv.rate : (dv.rate || 1);
      // 톤은 «비어 있으면 센터 기본» — 0 이 «기본 톤»이라는 뜻의 진짜 값이라서 빈 값과 구분한다
      var pitch = (bv.pitch === undefined || bv.pitch === null || bv.pitch === '')
        ? Number(dv.pitch || 0) : Number(bv.pitch);
      var uri = bv.voiceURI || '';
      var gender = bv.gender || '';
      var v = null;
      if (uri) v = this.byUri(uri);
      if (!v && gender) v = this.pickGender(gender);
      if (!v && dv.voiceURI) v = this.byUri(dv.voiceURI);
      if (!v) v = this.pickGender(dv.gender || 'female');
      return { voice: v, rate: rate, pitch: pitch, inherited: !bv.gender && !bv.voiceURI };
    }
  };
  if (global.speechSynthesis) {
    Voices.refresh();
    speechSynthesis.onvoiceschanged = function () { Voices.refresh(); if (Voices.onReady) Voices.onReady(); };
  }
  // 중계 서버 상태를 확인한 뒤 목소리 목록을 그 엔진에 맞게 갈아끼운다
  Engine.probe().then(function () {
    Voices.applyEngine();
    if (Voices.onReady) Voices.onReady();
  });

  /* ---------------- 대본 쪼개기 (긴 대본 대응) ---------------- */
  // 크롬은 한 번에 너무 긴 문장을 읽다가 중간에 끊기므로 문장 단위로 나눠 순서대로 읽는다.
  function splitScript(text, max) {
    max = max || 80;
    var norm = String(text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
    if (!norm) return [];
    var parts = norm.split(/\n+|(?<=[.!?…])\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
    var out = [], buf = '';
    function pushBuf() { if (buf.trim()) out.push(buf.trim()); buf = ''; }
    parts.forEach(function (p) {
      while (p.length > max) {
        var cut = p.lastIndexOf(',', max);
        if (cut < max * 0.4) cut = p.lastIndexOf(' ', max);
        if (cut < max * 0.4) cut = max;
        pushBuf();
        out.push(p.slice(0, cut + 1).trim());
        p = p.slice(cut + 1).trim();
      }
      if (!p) return;
      if ((buf + ' ' + p).trim().length > max) pushBuf();
      buf = (buf ? buf + ' ' : '') + p;
    });
    pushBuf();
    return out;
  }

  /* ---------------- 준비(캐시) ---------------- */
  // 같은 대본+같은 목소리면 다시 만들지 않는다. 고품질 엔진을 붙이면 여기에 음성 파일이 저장된다.
  var Cache = {
    db: null,
    mem: {},
    key: function (text, voiceUri, rate, engine) { return hash((engine || 'device') + '|' + (voiceUri || '') + '|' + rate + '|' + text); },
    open: function () {
      var self = this;
      if (this.db) return Promise.resolve(this.db);
      return new Promise(function (res) {
        if (!global.indexedDB) return res(null);
        var rq;
        try { rq = indexedDB.open('ngym_bcast', 1); } catch (e) { return res(null); }
        rq.onupgradeneeded = function () { if (!rq.result.objectStoreNames.contains('prep')) rq.result.createObjectStore('prep'); };
        rq.onsuccess = function () { self.db = rq.result; res(self.db); };
        rq.onerror = function () { res(null); };
      });
    },
    get: function (k) {
      var self = this;
      if (self.mem[k]) return Promise.resolve(self.mem[k]);
      return this.open().then(function (db) {
        if (!db) return null;
        return new Promise(function (res) {
          var rq = db.transaction('prep', 'readonly').objectStore('prep').get(k);
          rq.onsuccess = function () { if (rq.result) self.mem[k] = rq.result; res(rq.result || null); };
          rq.onerror = function () { res(null); };
        });
      });
    },
    put: function (k, val) {
      var self = this;
      self.mem[k] = val;
      return this.open().then(function (db) {
        if (!db) return;
        try { db.transaction('prep', 'readwrite').objectStore('prep').put(val, k); } catch (e) { }
      });
    },
    // 만들어둔 소리 파일 (같은 문구 + 같은 목소리면 서버에 다시 묻지 않는다 → 요금 절약)
    audioKey: function (text, speakerCode, rate, pitch) {
      return 'a' + hash('clova|' + (speakerCode || '') + '|' + rate + '|' + (pitch || 0) + '|' + text);
    },
    getAudio: function (k) {
      return this.get(k).then(function (r) { return r && r.audio ? r.audio : null; });
    },
    putAudio: function (k, buf) {
      return this.put(k, { audio: buf, at: Date.now(), engine: 'clova' });
    },

    // 방송 하나를 미리 준비해둔다 (네트워크가 끊겨도 그대로 나가도록)
    prepare: function (bcast, center) {
      var r = Voices.resolve(bcast, center);
      var k = this.key(bcast.script, r.voice ? r.voice.uri : '', r.rate, Engine.mode);
      var self = this;
      return this.get(k).then(function (hit) {
        if (hit && hit.plan) return { key: k, plan: hit.plan, cached: true };
        var plan = splitScript(bcast.script);
        return self.put(k, { plan: plan, engine: Engine.mode, at: Date.now(), name: bcast.name })
          .then(function () { return { key: k, plan: plan, cached: false }; });
      });
    },

    // 예약 시각 전에 소리를 미리 받아둔다. 방송 순간에 네트워크가 흔들려도 그대로 나간다.
    prefetch: function (bcast, center) {
      if (Engine.mode !== 'clova') return Promise.resolve({ skipped: true });
      var r = Voices.resolve(bcast, center);
      if (!r.voice || !r.voice.clova) return Promise.resolve({ skipped: true });
      var self = this, chunks = splitScript(bcast.script), got = 0;
      var seq = Promise.resolve();
      chunks.forEach(function (c) {
        seq = seq.then(function () {
          var ak = self.audioKey(c, r.voice.uri, r.rate, r.pitch);
          return self.getAudio(ak).then(function (hit) {
            if (hit) { got++; return null; }
            return Engine.synth(c, { speaker: r.voice.uri, rate: r.rate, pitch: r.pitch })
              .then(function (buf) { got++; return self.putAudio(ak, buf); })
              .catch(function () { return null; });
          });
        });
      });
      return seq.then(function () { return { ready: got, total: chunks.length }; });
    }
  };

  /* ---------------- 재생 ---------------- */
  var Player = {
    ctx: null,
    armed: false,
    primed: false,
    busy: false,
    stopped: false,
    current: null,
    audioNode: null,
    audioEl: null,
    lastVoiceError: '',
    keepTimer: null,
    resumeTimer: null,
    isChromium: /Chrome|Chromium|Edg/.test(navigator.userAgent) && !/Apple Computer/.test(navigator.vendor || ''),

    // 자동재생 차단 해제: 반드시 사용자가 버튼을 누른 그 순간에 호출해야 한다.
    arm: function () {
      var self = this;
      try {
        var AC = global.AudioContext || global.webkitAudioContext;
        if (AC && !this.ctx) this.ctx = new AC();
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { }
      // 무음 keep-alive: 오디오 세션이 잠들지 않게 붙잡아 둔다
      if (this.ctx && !this.keepTimer) {
        var tick = function () {
          try {
            if (self.ctx.state === 'suspended') self.ctx.resume();
            var b = self.ctx.createBuffer(1, 1, 22050);
            var s = self.ctx.createBufferSource();
            s.buffer = b; s.connect(self.ctx.destination); s.start(0);
          } catch (e) { }
        };
        tick();
        this.keepTimer = setInterval(tick, 15000);
      }
      // 음성 엔진도 같은 제스처 안에서 한 번 깨워둔다 (아이패드 사파리는 이게 없으면 자동 재생이 막힌다)
      // 크롬 계열은 제스처가 필요 없고, 빈 발화를 큐에 넣으면 오히려 뒤 발화가 막힐 수 있어 건너뛴다.
      if (global.speechSynthesis && !this.primed && !this.isChromium) {
        try {
          speechSynthesis.cancel();
          var u = new SpeechSynthesisUtterance('\uD14C\uC2A4\uD2B8');
          u.volume = 0; u.lang = 'ko-KR'; u.rate = 2;
          speechSynthesis.speak(u);
          this.primed = true;
        } catch (e) { }
      }
      this.armed = true;
      return this.ctx ? this.ctx.state : 'none';
    },

    // 방송 시작 알림음 (배경음악을 줄일 수 없으므로 주의를 끄는 용도)
    chime: function () {
      var self = this;
      return new Promise(function (res) {
        if (!self.ctx) return res(false);
        try {
          var t0 = self.ctx.currentTime, notes = [[880, 0], [1174.7, 0.26], [1567.9, 0.52]];
          notes.forEach(function (n) {
            var o = self.ctx.createOscillator(), g = self.ctx.createGain();
            o.type = 'sine'; o.frequency.value = n[0];
            g.gain.setValueAtTime(0.0001, t0 + n[1]);
            g.gain.exponentialRampToValueAtTime(0.22, t0 + n[1] + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + 0.45);
            o.connect(g); g.connect(self.ctx.destination);
            o.start(t0 + n[1]); o.stop(t0 + n[1] + 0.5);
          });
        } catch (e) { return res(false); }
        setTimeout(function () { res(true); }, 1150);
      });
    },

    // 한 덩어리를 읽는다. 클로바 화자면 중계 서버에서 소리를 받아 틀고,
    // 실패하거나 클로바가 아니면 이 기기에 설치된 목소리로 읽는다.
    speakChunk: function (text, voice, rate, pitch) {
      var self = this;
      if (voice && voice.clova && Engine.mode === 'clova') {
        return this.speakClova(text, voice, rate, pitch).catch(function (e) {
          self.lastVoiceError = (e && e.human) || '고품질 음성을 받지 못해 기본 음성으로 읽었습니다.';
          var fb = Voices.deviceFallback(voice.gender);
          if (!fb) return 'error:' + ((e && e.code) || 'clova');
          return self.speakDevice(text, fb, rate);
        });
      }
      return this.speakDevice(text, voice, rate);
    },

    speakClova: function (text, voice, rate, pitch) {
      var self = this;
      var k = Cache.audioKey(text, voice.uri, rate, pitch);
      return Cache.getAudio(k)
        .then(function (hit) {
          if (hit) return hit;
          return Engine.synth(text, { speaker: voice.uri, rate: rate, pitch: pitch })
            .then(function (buf) { Cache.putAudio(k, buf); return buf; });
        })
        .then(function (buf) { return self.playBuffer(buf); });
    },

    // 받아온 소리를 튼다. 예약 방송이 자동으로 나가야 하므로
    // 이미 깨워둔 오디오 통로(AudioContext)를 먼저 쓰고, 안 되면 오디오 태그로 튼다.
    playBuffer: function (buf) {
      var self = this;
      return new Promise(function (res, rej) {
        if (!self.ctx || !self.ctx.decodeAudioData) return self.playElement(buf).then(res, rej);
        var done = false;
        var ok = function (audioBuf) {
          if (done) return; done = true;
          try {
            var src = self.ctx.createBufferSource();
            src.buffer = audioBuf;
            src.connect(self.ctx.destination);
            self.audioNode = src;
            src.onended = function () { self.audioNode = null; res('end'); };
            src.start(0);
          } catch (e) { rej(e); }
        };
        var fail = function () {
          if (done) return; done = true;
          self.playElement(buf).then(res, rej);
        };
        try {
          // 디코드하면서 원본이 비워지므로 복사본을 넘긴다
          var p = self.ctx.decodeAudioData(buf.slice(0), ok, fail);
          if (p && p.then) p.then(ok, fail);
        } catch (e) { fail(); }
      });
    },

    playElement: function (buf) {
      var self = this;
      return new Promise(function (res, rej) {
        var url;
        try {
          // 실제 바이트를 보고 형식을 정한다 (RIFF 로 시작하면 WAV)
          var head = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
          var isWav = head.length === 4 && head[0] === 82 && head[1] === 73 && head[2] === 70 && head[3] === 70;
          url = URL.createObjectURL(new Blob([buf], { type: isWav ? 'audio/wav' : 'audio/mpeg' }));
        }
        catch (e) { return rej(new Error('blob')); }
        var a = new Audio(url);
        self.audioEl = a;
        var done = false;
        var cleanup = function () { try { URL.revokeObjectURL(url); } catch (e) { } self.audioEl = null; };
        a.onended = function () { if (done) return; done = true; cleanup(); res('end'); };
        a.onerror = function () { if (done) return; done = true; cleanup(); rej(new Error('audio-error')); };
        var pr = a.play();
        if (pr && pr.catch) pr.catch(function () { if (done) return; done = true; cleanup(); rej(new Error('autoplay-blocked')); });
      });
    },

    speakDevice: function (text, voice, rate) {
      var self = this;
      return new Promise(function (res) {
        if (!global.speechSynthesis) return res('no-engine');
        var u = new SpeechSynthesisUtterance(text);
        u.lang = 'ko-KR';
        if (voice && voice.raw) u.voice = voice.raw;
        u.rate = Math.max(0.5, Math.min(2, rate || 1));
        u.pitch = 1; u.volume = 1;
        var done = false;
        var finish = function (why) { if (done) return; done = true; clearInterval(self.resumeTimer); self.resumeTimer = null; res(why); };
        u.onend = function () { finish('end'); };
        u.onerror = function (e) { finish('error:' + (e && e.error ? e.error : '?')); };
        try { speechSynthesis.speak(u); } catch (e) { return finish('throw'); }
        // 크롬은 재생이 길어지면 스스로 멈추는 버그가 있어 주기적으로 깨운다
        if (self.isChromium) {
          self.resumeTimer = setInterval(function () {
            if (speechSynthesis.speaking && !speechSynthesis.paused) { try { speechSynthesis.pause(); speechSynthesis.resume(); } catch (e) { } }
          }, 8000);
        }
        // 엔진이 통째로 응답하지 않는 경우를 위한 안전장치
        setTimeout(function () { finish('timeout'); }, 12000 + text.length * 320);
      });
    },

    stop: function () {
      try { speechSynthesis.cancel(); } catch (e) { }
      // 클로바 음성(파일 재생)도 같이 멈춘다
      try { if (this.audioNode) { this.audioNode.onended = null; this.audioNode.stop(0); } } catch (e) { }
      this.audioNode = null;
      try { if (this.audioEl) { this.audioEl.pause(); this.audioEl.src = ''; } } catch (e) { }
      this.audioEl = null;
      this.stopped = true;
      clearInterval(this.resumeTimer); this.resumeTimer = null;
      this.busy = false; this.current = null;
      if (this.onState) this.onState(null);
    },

    // 방송 한 건 재생 (알림음 -> 대본 -> 반복)
    play: function (bcast, center, opts) {
      opts = opts || {};
      var self = this;
      if (this.busy && !opts.force) return Promise.resolve({ ok: false, why: 'busy' });
      this.busy = true;
      this.stopped = false;
      this.lastVoiceError = '';
      this.current = { name: bcast.name, id: bcast.id, at: Date.now() };
      if (this.onState) this.onState(this.current);
      var r = Voices.resolve(bcast, center);
      var repeat = Math.max(1, Math.min(3, bcast.repeat || 1));
      var chunks = null, results = [];
      return Cache.prepare(bcast, center)
        .then(function (prep) {
          chunks = prep.plan && prep.plan.length ? prep.plan : splitScript(bcast.script);
          if (opts.chime === false || !self.ctx) return null;
          return self.chime();
        })
        .then(function () {
          var seq = Promise.resolve();
          for (var n = 0; n < repeat; n++) {
            chunks.forEach(function (c) {
              seq = seq.then(function () {
                if (self.stopped) { results.push('stopped'); return null; }
                return self.speakChunk(c, r.voice, r.rate, r.pitch).then(function (w) { results.push(w); });
              });
            });
            if (n < repeat - 1) seq = seq.then(function () { return new Promise(function (z) { setTimeout(z, 900); }); });
          }
          return seq;
        })
        .then(function () {
          self.busy = false; self.current = null;
          if (self.onState) self.onState(null);
          var bad = results.filter(function (w) { return w && w.indexOf('error') === 0; });
          return { ok: bad.length === 0, chunks: chunks.length, repeat: repeat, results: results, voice: r.voice ? r.voice.name : '(없음)' };
        })
        .catch(function (e) {
          self.busy = false; self.current = null;
          if (self.onState) self.onState(null);
          return { ok: false, why: String(e) };
        });
    },

    // 미리듣기: 저장 전 대본을 그 자리에서 읽어준다
    preview: function (text, voice, rate, repeat, pitch) {
      var self = this;
      this.arm();
      try { speechSynthesis.cancel(); } catch (e) { }
      var chunks = splitScript(text);
      if (!chunks.length) return Promise.resolve({ ok: false, why: 'empty' });
      this.busy = true;
      this.stopped = false;
      this.lastVoiceError = '';
      if (this.onState) this.onState({ name: '미리듣기', id: '__preview', at: Date.now() });
      var seq = Promise.resolve(), n, rep = Math.max(1, Math.min(3, repeat || 1));
      for (n = 0; n < rep; n++) {
        chunks.forEach(function (c) {
          seq = seq.then(function () {
            if (self.stopped) return null;
            return self.speakChunk(c, voice, rate, pitch);
          });
        });
        if (n < rep - 1) seq = seq.then(function () { return new Promise(function (z) { setTimeout(z, 900); }); });
      }
      return seq.then(function () {
        self.busy = false;
        if (self.onState) self.onState(null);
        return { ok: true, chunks: chunks.length, note: self.lastVoiceError || '' };
      });
    }
  };

  /* ---------------- 예약 계산 ---------------- */
  function occurrences(b, from, days) {
    var out = [], i, d, t;
    if (!b || !b.schedule) return out;
    var s = b.schedule;
    if (s.type === 'once') {
      if (s.date && s.time) {
        var dt = new Date(s.date + 'T' + s.time + ':00');
        if (!isNaN(dt.getTime())) out.push(dt.getTime());
      }
      return out;
    }
    if (s.type === 'weekly' && s.days && s.days.length && s.times && s.times.length) {
      var base = new Date(from); base.setHours(0, 0, 0, 0);
      for (i = 0; i <= (days || 8); i++) {
        d = new Date(base.getTime() + i * 86400000);
        if (s.days.indexOf(d.getDay()) < 0) continue;
        for (t = 0; t < s.times.length; t++) {
          var hm = s.times[t].split(':');
          var x = new Date(d); x.setHours(+hm[0], +hm[1], 0, 0);
          out.push(x.getTime());
        }
      }
    }
    out.sort(function (a, b2) { return a - b2; });
    return out;
  }

  function nextRun(b, now) {
    var occ = occurrences(b, new Date(now), 8);
    for (var i = 0; i < occ.length; i++) if (occ[i] > now) return occ[i];
    return null;
  }

  // 「811분 뒤」처럼 읽기 힘든 표기를 막는다
  function humanGap(ms) {
    var m = Math.round(ms / 60000);
    if (m < 1) return '곧';
    if (m < 60) return m + '분 뒤';
    var h = Math.floor(m / 60), mm = m % 60;
    if (h < 24) return h + '시간' + (mm ? ' ' + mm + '분' : '') + ' 뒤';
    return Math.floor(h / 24) + '일 뒤';
  }

  // 1회성 예약인데 시각이 이미 지났는지
  function isPastOnce(b, now) {
    var s = b.schedule || {};
    if (s.type !== 'once' || !s.date || !s.time) return false;
    var t = new Date(s.date + 'T' + s.time + ':00').getTime();
    return !isNaN(t) && t <= now;
  }

  function scheduleLabel(b) {
    var s = b.schedule || {};
    if (s.type === 'once') return s.date && s.time ? (s.date.slice(5).replace('-', '월 ') + '일 ' + s.time) : '시각 미설정';
    if (!s.days || !s.days.length || !s.times || !s.times.length) return '시각 미설정';
    var ds = s.days.length === 7 ? '매일' : [0, 1, 2, 3, 4, 5, 6].filter(function (d) { return s.days.indexOf(d) >= 0; }).map(function (d) { return DAYS[d]; }).join('·');
    return ds + ' ' + s.times.slice().sort().join(', ');
  }

  /* ---------------- 송출 이력 ---------------- */
  var Log = {
    all: function () { try { return JSON.parse(localStorage.getItem(LS_LOG) || '[]'); } catch (e) { return []; } },
    add: function (row) {
      var a = this.all();
      a.unshift(row);
      if (a.length > 300) a = a.slice(0, 300);
      try { localStorage.setItem(LS_LOG, JSON.stringify(a)); } catch (e) { }
      return a;
    },
    today: function (centerId) {
      var t = ymd(new Date());
      return this.all().filter(function (r) { return r.day === t && (!centerId || r.centerId === centerId); });
    },
    clear: function () { try { localStorage.removeItem(LS_LOG); } catch (e) { } }
  };

  /* ---------------- 스케줄러 (시계 기준 절대시각 비교) ---------------- */
  var Scheduler = {
    running: false,
    timer: null,
    fired: {},
    LATE_MS: 90000, // 탭이 멈췄다 돌아왔을 때 이 정도까지는 늦게라도 내보낸다
    loadFired: function () {
      try {
        var o = JSON.parse(localStorage.getItem(LS_FIRED) || '{}');
        var cut = Date.now() - 6 * 3600 * 1000, k;
        for (k in o) if (o[k] > cut) this.fired[k] = o[k];
      } catch (e) { }
    },
    saveFired: function () { try { localStorage.setItem(LS_FIRED, JSON.stringify(this.fired)); } catch (e) { } },
    start: function (getBroadcasts, onFire) {
      if (this.running) return;
      this.running = true;
      this.loadFired();
      var self = this;
      function tick() {
        if (!self.running) return;
        var now = Date.now();
        try {
          var list = getBroadcasts() || [];
          list.forEach(function (b) {
            if (!b.enabled) return;
            var occ = occurrences(b, new Date(now - 86400000), 2);
            occ.forEach(function (t) {
              if (t > now + 500) return;              // 아직 시각이 아니다
              var key = b.id + '@' + t;
              if (self.fired[key]) return;            // 이미 나갔다
              if (now - t > self.LATE_MS) { self.fired[key] = now; return; } // 너무 늦어 버림
              self.fired[key] = now;
              self.saveFired();
              onFire(b, t, now - t);
            });
          });
        } catch (e) { }
        // setInterval 누적 오차를 쓰지 않고 매번 다음 초 경계로 다시 건다
        var delay = 1000 - (Date.now() % 1000);
        self.timer = setTimeout(tick, delay < 60 ? delay + 1000 : delay);
      }
      tick();
    },
    stop: function () { this.running = false; clearTimeout(this.timer); }
  };

  global.NB = {
    DAYS: DAYS, uid: uid, pad: pad, hhmm: hhmm, ymd: ymd, hash: hash, clone: clone,
    Store: Store, Voices: Voices, Player: Player, Cache: Cache, Log: Log, Scheduler: Scheduler, Engine: Engine,
    splitScript: splitScript, occurrences: occurrences, nextRun: nextRun, scheduleLabel: scheduleLabel,
    humanGap: humanGap, isPastOnce: isPastOnce,
    KEYS: { state: LS, log: LS_LOG, fired: LS_FIRED }
  };
})(window);
