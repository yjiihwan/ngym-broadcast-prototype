/* 송출 화면 — 현장 PC / 아이패드에서 상시 열어두는 화면 */
(function () {
  'use strict';
  var S = NB.Store, V = NB.Voices, P = NB.Player, L = NB.Log, SC = NB.Scheduler;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  S.load();
  var started = false;
  var wakeSentinel = null;

  /* ---------- 시계 (실제 시각 기준) ---------- */
  function paintClock() {
    var d = new Date();
    $('clock').innerHTML = NB.pad(d.getHours()) + ':' + NB.pad(d.getMinutes()) + '<small>' + NB.pad(d.getSeconds()) + '</small>';
    $('dateLine').textContent = d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + NB.DAYS[d.getDay()] + '요일';
  }
  (function clockLoop() {
    paintClock();
    setTimeout(clockLoop, 1000 - (Date.now() % 1000) + 5);
  })();

  /* ---------- 화면 꺼짐 방지 ---------- */
  function wakeLock() {
    if (!navigator.wakeLock || !navigator.wakeLock.request) {
      $('wakeTag').textContent = '화면 유지 미지원';
      $('wakeTag').className = 'tag off';
      $('wakeWarn').classList.remove('hide');
      return;
    }
    navigator.wakeLock.request('screen').then(function (s) {
      wakeSentinel = s;
      $('wakeTag').textContent = '화면 유지 켜짐';
      $('wakeTag').className = 'tag ok';
      $('wakeWarn').classList.add('hide');
      s.addEventListener('release', function () { wakeSentinel = null; });
    }).catch(function () {
      $('wakeTag').textContent = '화면 유지 실패';
      $('wakeTag').className = 'tag off';
      $('wakeWarn').classList.remove('hide');
    });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      if (started && !wakeSentinel) wakeLock();
      if (started) P.arm();   // 화면이 돌아오면 오디오 세션을 다시 붙잡는다
      paintAll();
    }
  });

  /* ---------- 화면 그리기 ---------- */
  function myBroadcasts() { return S.listFor(S.state.activeCenterId); }

  function renderCenters() {
    var sel = $('centerSel'); sel.innerHTML = '';
    S.state.centers.forEach(function (c) {
      var o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.appendChild(o);
    });
    sel.value = S.state.activeCenterId;
  }

  function nextUp() {
    var now = Date.now(), best = null;
    myBroadcasts().forEach(function (b) {
      if (!b.enabled) return;
      var t = NB.nextRun(b, now);
      if (t && (!best || t < best.t)) best = { t: t, b: b };
    });
    return best;
  }

  function renderNext() {
    var n = nextUp();
    if (!n) {
      $('nextLine').innerHTML = '<span class="t">—</span> 예약된 방송이 없습니다';
      $('prepLine').textContent = '';
      return;
    }
    var d = new Date(n.t), today = NB.ymd(d) === NB.ymd(new Date());
    var when = (today ? '오늘 ' : (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ') + NB.hhmm(d);
    $('nextLine').innerHTML = '<span class="t">' + esc(when) + '</span> · ' + esc(n.b.name) +
      ' <span style="color:var(--muted);font-size:.7em">(' + esc(NB.humanGap(n.t - Date.now())) + ')</span>';
    // 미리 준비해 두면 인터넷이 끊겨도 그대로 나간다
    NB.Cache.prepare(n.b, S.center()).then(function (p) {
      $('prepLine').textContent = '준비 완료 · ' + p.plan.length + '문장' + (p.cached ? ' (이미 만들어 둔 음성 재사용)' : '');
    });
  }

  function renderPlan() {
    var now = Date.now(), end = new Date(); end.setHours(23, 59, 59, 999);
    var rows = [];
    myBroadcasts().forEach(function (b) {
      if (!b.enabled) return;
      NB.occurrences(b, new Date(), 1).forEach(function (t) {
        if (t >= now && t <= end.getTime()) rows.push({ t: t, name: b.name });
      });
    });
    rows.sort(function (a, b) { return a.t - b.t; });
    $('planBox').innerHTML = rows.length
      ? rows.slice(0, 12).map(function (r) {
        return '<div class="logrow"><span class="lt">' + NB.hhmm(new Date(r.t)) + '</span><span class="ln">' + esc(r.name) + '</span></div>';
      }).join('')
      : '<p class="hintline" style="margin:0">오늘 남은 방송이 없습니다.</p>';
  }

  function renderLog() {
    var rows = L.today(S.state.activeCenterId);
    $('logBox').innerHTML = rows.length
      ? rows.slice(0, 20).map(function (r) {
        return '<div class="logrow"><span class="lt">' + esc(r.time) + '</span><span class="ln">' + esc(r.name) + '</span><span class="ls">' + esc(r.status) + '</span></div>';
      }).join('')
      : '<p class="hintline" style="margin:0">아직 송출된 방송이 없습니다.</p>';
  }

  function paintAll() { renderCenters(); renderNext(); renderPlan(); renderLog(); }

  /* ---------- 송출 ---------- */
  P.onState = function (cur) {
    if (cur) {
      $('liveBar').classList.remove('hide');
      $('liveName').textContent = '송출 중 — ' + cur.name;
      $('statusTag').textContent = '송출 중';
      $('statusTag').className = 'tag gold';
    } else {
      $('liveBar').classList.add('hide');
      $('statusTag').textContent = started ? '대기 중' : '멈춤';
      $('statusTag').className = 'tag ' + (started ? 'ok' : 'off');
    }
  };

  function record(b, status) {
    var d = new Date();
    L.add({ ts: d.getTime(), day: NB.ymd(d), time: NB.hhmm(d), centerId: b.centerId, bid: b.id, name: b.name, status: status });
    renderLog();
    window.__fired = (window.__fired || []).concat([{ name: b.name, status: status, at: d.getTime() }]);
  }

  // 다른 방송이 나가는 중이면 끝날 때까지 기다렸다가 이어서 내보낸다 (겹쳐서 버리지 않는다)
  function fire(b, planned, lateMs, waited) {
    waited = waited || 0;
    if (P.busy && waited < 60000) { return setTimeout(function () { fire(b, planned, lateMs, waited + 1000); }, 1000); }
    record(b, (lateMs > 5000 || waited > 5000) ? '자동 송출(지연)' : '자동 송출');
    P.play(b, S.center(), { force: true }).then(function (r) {
      if (!r.ok) record(b, '실패');
      renderNext(); renderPlan();
    });
  }

  /* ---------- 시작 ---------- */
  function start() {
    if (started) return;
    started = true;
    var state = P.arm();          // 반드시 클릭 안에서 호출 (자동재생 차단 해제)
    $('gate').classList.add('hide');
    wakeLock();
    SC.start(myBroadcasts, fire);
    paintAll();
    P.onState(null);
    window.__armed = state;
    // 소리가 실제로 열렸는지 형이 바로 알 수 있게 짧은 확인 음성
    var v = V.resolve({ voice: {} }, S.center());
    P.chime().then(function () {
      if (v.voice) return P.preview('엔짐 자동방송을 시작합니다.', v.voice, v.rate, 1);
    });
  }

  $('startBtn').addEventListener('click', start);

  $('centerSel').addEventListener('change', function () {
    S.state.activeCenterId = this.value; S.save(); paintAll();
  });

  $('testBtn').addEventListener('click', function () {
    P.arm();
    var list = myBroadcasts().filter(function (b) { return b.enabled; });
    var b = list[0] || myBroadcasts()[0];
    if (!b) return;
    record(b, '시험 송출');
    P.play(b, S.center(), { force: true }).then(function (r) { if (!r.ok) record(b, '실패'); });
  });

  $('test1mBtn').addEventListener('click', function () {
    P.arm();
    var t = new Date(Date.now() + 70000);
    t.setSeconds(0, 0);
    if (t.getTime() <= Date.now() + 5000) t = new Date(t.getTime() + 60000);
    var b = {
      id: NB.uid('t'), centerId: S.state.activeCenterId, name: '시험 방송 (' + NB.hhmm(t) + ')', enabled: true,
      script: '시험 방송입니다. 예약한 시각에 안내 방송이 정상적으로 나가고 있습니다.',
      voice: { gender: '', voiceURI: '', rate: 0 }, repeat: 1,
      schedule: { type: 'once', days: [], times: [], date: NB.ymd(t), time: NB.hhmm(t) }
    };
    S.upsert(b);
    paintAll();
    alert('«' + NB.hhmm(t) + '» 에 시험 방송이 자동으로 나갑니다. 이 화면을 그대로 두고 기다려 주세요.');
  });

  S.sub(paintAll);
  S.onLogChange = renderLog;
  paintAll();
  setInterval(function () { renderNext(); renderPlan(); }, 20000);

  // 검증용 훅
  window.__onair = { start: start, nextUp: nextUp, isStarted: function () { return started; } };
})();
