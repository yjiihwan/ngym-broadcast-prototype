/* 관리 화면 */
(function () {
  'use strict';
  var S = NB.Store, V = NB.Voices, P = NB.Player, L = NB.Log;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  S.load();
  var editing = null;   // 편집 중인 방송 사본

  /* ---------- 토스트 ---------- */
  var toastT = null;
  function toast(msg) {
    var el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('data-testid', 'toast'); document.body.appendChild(el); }
    el.textContent = msg;
    clearTimeout(toastT);
    toastT = setTimeout(function () { el.remove(); }, 2600);
  }

  /* ---------- 세그먼트 버튼 ---------- */
  function segSet(wrapId, val) {
    [].forEach.call($(wrapId).querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.v === String(val)));
    });
  }
  function segGet(wrapId) {
    var on = $(wrapId).querySelector('button[aria-pressed="true"]');
    return on ? on.dataset.v : '';
  }
  function segBind(wrapId, onChange) {
    $(wrapId).addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      segSet(wrapId, b.dataset.v);
      if (onChange) onChange(b.dataset.v);
    });
  }

  /* ---------- 목소리 드롭다운 ---------- */
  function fillVoiceSelect(sel, withInherit) {
    var ko = V.ko;
    sel.innerHTML = '';
    var o0 = document.createElement('option');
    o0.value = '';
    o0.textContent = withInherit ? '자동 (위에서 고른 성별)' : '자동 (성별로 자동 선택)';
    sel.appendChild(o0);
    ko.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v.uri; o.textContent = v.label;
      sel.appendChild(o);
    });
    if (!ko.length) { o0.textContent = '이 기기에 한국어 목소리가 없습니다'; }
  }
  function refreshVoiceUI() {
    V.refresh();
    fillVoiceSelect($('defVoice'), true);
    fillVoiceSelect($('edVoice'), true);
    var n = V.ko.length;
    $('voiceCount').textContent = n ? '한국어 목소리 ' + n + '개 사용 가능' : '한국어 목소리 없음';
    $('voiceCount').className = 'tag ' + (n ? 'ok' : 'off');
    var c = S.center();
    $('defVoice').value = c.defaultVoice.voiceURI || '';
    if (editing) $('edVoice').value = (editing.voice && editing.voice.voiceURI) || '';
  }
  V.onReady = refreshVoiceUI;

  /* ---------- 센터 ---------- */
  function renderCenters() {
    var sel = $('centerSel');
    sel.innerHTML = '';
    S.state.centers.forEach(function (c) {
      var o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.appendChild(o);
    });
    sel.value = S.state.activeCenterId;
  }
  function renderDefaults() {
    var c = S.center();
    segSet('defGender', c.defaultVoice.gender || 'female');
    $('defRate').value = c.defaultVoice.rate || 1;
    $('defRateV').textContent = Number(c.defaultVoice.rate || 1).toFixed(2);
    $('defVoice').value = c.defaultVoice.voiceURI || '';
    $('listTitle').textContent = c.name + ' 방송 목록';
  }

  /* ---------- 목록 ---------- */
  function voiceTag(b) {
    var r = V.resolve(b, S.center());
    var who = r.voice ? r.voice.label : '목소리 없음';
    return (r.inherited ? '센터 기본 · ' : '') + who + ' · ' + Number(r.rate).toFixed(2) + '배속';
  }
  function nextTag(b) {
    if (!b.enabled) return { cls: 'off', t: '꺼짐' };
    var n = NB.nextRun(b, Date.now());
    if (!n) return { cls: 'off', t: NB.isPastOnce(b, Date.now()) ? '지난 시각 (다시 안 나감)' : '예약 없음' };
    var d = new Date(n), today = NB.ymd(new Date()) === NB.ymd(d);
    return { cls: 'cta', t: '다음 ' + (today ? '오늘 ' : (d.getMonth() + 1) + '/' + d.getDate() + ' ') + NB.hhmm(d) };
  }
  function renderList() {
    var box = $('list'), items = S.listFor(S.state.activeCenterId);
    if (!items.length) {
      box.innerHTML = '<div class="empty">등록된 방송이 없습니다.<br>오른쪽 위 «+ 새 방송»으로 시작하세요.</div>';
      return;
    }
    box.innerHTML = items.map(function (b) {
      var nt = nextTag(b);
      return '<article class="bcard ' + (b.enabled ? '' : 'off') + '" data-testid="bcard" data-id="' + b.id + '">' +
        '<div class="bcard-h"><h3>' + esc(b.name) + '</h3>' +
        '<button class="sw" data-act="toggle" data-testid="toggle" aria-pressed="' + (b.enabled ? 'true' : 'false') + '" aria-label="켜기/끄기"></button></div>' +
        '<p class="bcard-script">' + esc(b.script) + '</p>' +
        '<div class="bcard-meta">' +
        '<span class="tag">' + esc(NB.scheduleLabel(b)) + '</span>' +
        '<span class="tag ' + nt.cls + '">' + esc(nt.t) + '</span>' +
        '<span class="tag">' + esc(voiceTag(b)) + '</span>' +
        '<span class="tag">' + (b.repeat || 1) + '회 반복</span>' +
        '</div>' +
        '<div class="bcard-acts">' +
        '<button class="btn btn-sm" data-act="preview" data-testid="card-preview">▶ 미리듣기</button>' +
        '<button class="btn btn-sm" data-act="now" data-testid="card-now">즉시 송출</button>' +
        '<button class="btn btn-sm" data-act="edit" data-testid="card-edit">수정</button>' +
        '<button class="btn btn-sm btn-danger" data-act="del">삭제</button>' +
        '</div></article>';
    }).join('');
  }
  function renderLog() {
    var rows = L.today(S.state.activeCenterId);
    $('adminLog').innerHTML = rows.length
      ? rows.map(function (r) {
        return '<div class="logrow"><span class="lt">' + esc(r.time) + '</span><span class="ln">' + esc(r.name) + '</span><span class="ls">' + esc(r.status) + '</span></div>';
      }).join('')
      : '<p class="hintline" style="margin:0">오늘 송출된 방송이 없습니다.</p>';
  }
  function renderAll() { renderCenters(); renderDefaults(); renderList(); renderLog(); }

  /* ---------- 재생 ---------- */
  function logPlay(b, status) {
    var d = new Date();
    L.add({ ts: d.getTime(), day: NB.ymd(d), time: NB.hhmm(d), centerId: b.centerId, bid: b.id, name: b.name, status: status });
    renderLog();
  }
  function playNow(b) {
    P.arm();
    toast('«' + b.name + '» 송출 중…');
    logPlay(b, '즉시 송출');   // 나간 시각이 기록되어야 하므로 시작할 때 남긴다
    P.play(b, S.center(), { force: true }).then(function (r) {
      if (!r.ok) { logPlay(b, '실패'); toast('소리를 낼 수 없습니다. 이 기기에 한국어 목소리가 없을 수 있습니다.'); }
      else toast('송출 완료');
    });
  }

  /* ---------- 편집기 ---------- */
  function blank() {
    return {
      id: NB.uid('b'), centerId: S.state.activeCenterId, name: '', script: '', enabled: true,
      voice: { gender: '', voiceURI: '', rate: 0 }, repeat: 1,
      schedule: { type: 'weekly', days: [1, 2, 3, 4, 5], times: [], date: NB.ymd(new Date()), time: '' }
    };
  }
  function renderDays() {
    $('edDays').innerHTML = NB.DAYS.map(function (d, i) {
      return '<button type="button" data-d="' + i + '" aria-pressed="' + (editing.schedule.days.indexOf(i) >= 0) + '">' + d + '</button>';
    }).join('');
  }
  function renderTimes() {
    var t = editing.schedule.times.slice().sort();
    $('edTimes').innerHTML = t.length
      ? t.map(function (x) { return '<span class="timechip" data-testid="timechip">' + x + '<button type="button" data-t="' + x + '" aria-label="삭제">✕</button></span>'; }).join('')
      : '<span class="hintline" style="margin:0">등록된 시각이 없습니다.</span>';
  }
  function renderType() {
    var t = editing.schedule.type;
    segSet('edType', t);
    $('edWeekly').classList.toggle('hide', t !== 'weekly');
    $('edOnce').classList.toggle('hide', t !== 'once');
  }
  function openEditor(b) {
    editing = b ? NB.clone(b) : blank();
    $('edTitle').textContent = b ? '방송 편집' : '새 방송';
    $('edDelete').classList.toggle('hide', !b);
    $('edName').value = editing.name;
    $('edScript').value = editing.script;
    segSet('edGender', editing.voice.gender || '');
    segSet('edRepeat', editing.repeat || 1);
    $('edVoice').value = editing.voice.voiceURI || '';
    $('edRate').value = editing.voice.rate || S.center().defaultVoice.rate || 1;
    $('edRateV').textContent = editing.voice.rate ? Number(editing.voice.rate).toFixed(2) : '센터 기본';
    $('edDate').value = editing.schedule.date || NB.ymd(new Date());
    $('edTime').value = editing.schedule.time || '';
    $('edTimeNew').value = '';
    renderDays(); renderTimes(); renderType(); updLen();
    $('mask').classList.remove('hide');
    document.body.style.overflow = 'hidden';
  }
  function closeEditor() {
    $('mask').classList.add('hide');
    document.body.style.overflow = '';
    editing = null;
    try { speechSynthesis.cancel(); } catch (e) { }
  }
  function updLen() {
    var n = $('edScript').value.length;
    var chunks = NB.splitScript($('edScript').value).length;
    $('edLen').textContent = n ? '(' + n + '자 · ' + chunks + '문장으로 나눠 읽음)' : '';
  }
  function collect() {
    editing.name = $('edName').value.trim();
    editing.script = $('edScript').value.trim();
    editing.voice.gender = segGet('edGender');
    editing.voice.voiceURI = $('edVoice').value;
    editing.voice.rate = $('edRate').dataset.touched === '1' ? Number($('edRate').value) : editing.voice.rate;
    editing.repeat = Number(segGet('edRepeat')) || 1;
    editing.schedule.type = segGet('edType');
    editing.schedule.date = $('edDate').value;
    editing.schedule.time = $('edTime').value;
    return editing;
  }
  function editorVoice() {
    var g = segGet('edGender'), uri = $('edVoice').value;
    var tmp = { voice: { gender: g, voiceURI: uri, rate: $('edRate').dataset.touched === '1' ? Number($('edRate').value) : 0 } };
    return V.resolve(tmp, S.center());
  }

  /* ---------- 이벤트 ---------- */
  $('centerSel').addEventListener('change', function () {
    S.state.activeCenterId = this.value; S.save(); renderAll(); refreshVoiceUI();
  });

  segBind('defGender');
  $('defRate').addEventListener('input', function () { $('defRateV').textContent = Number(this.value).toFixed(2); });
  $('defSave').addEventListener('click', function () {
    var c = S.center();
    c.defaultVoice = { gender: segGet('defGender'), voiceURI: $('defVoice').value, rate: Number($('defRate').value) };
    S.save(); renderList(); toast('센터 기본 목소리를 저장했습니다.');
  });
  $('defPreview').addEventListener('click', function () {
    P.arm();
    var g = segGet('defGender'), uri = $('defVoice').value;
    var v = uri ? V.byUri(uri) : V.pickGender(g);
    if (!v) return toast('이 기기에 한국어 목소리가 없습니다.');
    toast('들려드리는 중…');
    P.preview('안녕하세요. 엔짐 ' + S.center().name.replace('엔짐 ', '') + '입니다. 이 목소리로 안내 방송을 진행합니다.', v, Number($('defRate').value), 1);
  });

  $('newBtn').addEventListener('click', function () { openEditor(null); });
  $('clearLog').addEventListener('click', function () { L.clear(); renderLog(); toast('이력을 비웠습니다.'); });
  $('resetBtn').addEventListener('click', function () {
    if (!confirm('모든 방송을 샘플 데이터로 되돌립니다. 계속할까요?')) return;
    S.reset(); L.clear(); renderAll(); refreshVoiceUI(); toast('샘플 데이터로 되돌렸습니다.');
  });

  $('list').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]'); if (!btn) return;
    var card = e.target.closest('[data-id]'); if (!card) return;
    var b = S.get(card.dataset.id); if (!b) return;
    var act = btn.dataset.act;
    if (act === 'toggle') { b.enabled = !b.enabled; S.upsert(b); renderList(); toast(b.name + ' — ' + (b.enabled ? '켰습니다' : '껐습니다')); }
    else if (act === 'edit') openEditor(b);
    else if (act === 'del') { if (confirm('«' + b.name + '» 방송을 삭제할까요?')) { S.remove(b.id); renderList(); toast('삭제했습니다.'); } }
    else if (act === 'now') playNow(b);
    else if (act === 'preview') {
      P.arm();
      var r = V.resolve(b, S.center());
      if (!r.voice) return toast('이 기기에 한국어 목소리가 없습니다.');
      toast('미리듣기 중…');
      P.preview(b.script, r.voice, r.rate, 1);
    }
  });

  segBind('edGender', function () { $('edVoice').value = ''; });
  segBind('edRepeat');
  segBind('edType', function (v) { editing.schedule.type = v; renderType(); });
  $('edRate').addEventListener('input', function () { this.dataset.touched = '1'; $('edRateV').textContent = Number(this.value).toFixed(2); });
  $('edScript').addEventListener('input', updLen);
  $('edDays').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var d = Number(b.dataset.d), i = editing.schedule.days.indexOf(d);
    if (i >= 0) editing.schedule.days.splice(i, 1); else editing.schedule.days.push(d);
    renderDays();
  });
  $('edTimeAdd').addEventListener('click', function () {
    var t = $('edTimeNew').value;
    if (!t) return toast('시각을 먼저 고르세요.');
    if (editing.schedule.times.indexOf(t) >= 0) return toast('이미 등록된 시각입니다.');
    editing.schedule.times.push(t); renderTimes(); $('edTimeNew').value = '';
  });
  $('edTimes').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-t]'); if (!b) return;
    editing.schedule.times = editing.schedule.times.filter(function (x) { return x !== b.dataset.t; });
    renderTimes();
  });
  $('edPreview').addEventListener('click', function () {
    P.arm();
    var txt = $('edScript').value.trim();
    if (!txt) return toast('대본을 먼저 입력하세요.');
    var r = editorVoice();
    if (!r.voice) return toast('이 기기에 한국어 목소리가 없습니다.');
    $('edPrevHint').textContent = '지금 «' + r.voice.label + '» 목소리로 읽는 중입니다.';
    P.preview(txt, r.voice, r.rate, Number(segGet('edRepeat')) || 1).then(function () {
      $('edPrevHint').textContent = '저장하기 전에 지금 이 대본을 그대로 읽어드립니다.';
    });
  });
  $('edSave').addEventListener('click', function () {
    var b = collect();
    if (!b.name) return toast('방송 이름을 입력하세요.');
    if (!b.script) return toast('대본을 입력하세요.');
    if (b.schedule.type === 'weekly' && (!b.schedule.days.length || !b.schedule.times.length)) return toast('요일과 시각을 각각 하나 이상 지정하세요.');
    if (b.schedule.type === 'once' && (!b.schedule.date || !b.schedule.time)) return toast('날짜와 시각을 지정하세요.');
    S.upsert(b); closeEditor(); renderList(); toast('저장했습니다.');
  });
  $('edDelete').addEventListener('click', function () {
    if (!confirm('이 방송을 삭제할까요?')) return;
    S.remove(editing.id); closeEditor(); renderList(); toast('삭제했습니다.');
  });
  $('edClose').addEventListener('click', closeEditor);
  $('edCancel').addEventListener('click', closeEditor);
  $('mask').addEventListener('click', function (e) { if (e.target === $('mask')) closeEditor(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('mask').classList.contains('hide')) closeEditor(); });

  S.sub(function () { renderList(); renderLog(); });
  renderAll();
  refreshVoiceUI();
  setTimeout(refreshVoiceUI, 900);
  setInterval(renderList, 30000); // «다음 송출» 배지 갱신

  window.__admin = { openEditor: openEditor, renderAll: renderAll, toast: toast };
})();
