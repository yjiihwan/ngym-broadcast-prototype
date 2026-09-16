/* 관리 화면 */
(function () {
  'use strict';
  var S = NB.Store, V = NB.Voices, P = NB.Player, L = NB.Log, E = NB.Engine;
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

  /* ---------- 목소리 고르기 (카드 4장 — 화면 세 곳이 같은 부품을 쓴다) ---------- */
  // 센터 기본값 화면: 고른 값이 곧 센터 기본 목소리다 («안 고름» 상태가 없다)
  var defPicker = NB.VoicePicker.mount($('defVoicePick'), {
    testPrefix: 'vs',
    scriptNo: '1',
    get: function () { return S.center().defaultVoice.speaker || NB.DEFAULT_SPEAKER; },
    set: function (id) {
      if (!id) return;
      var c = S.center();
      if (c.defaultVoice.speaker === id) return;
      c.defaultVoice.speaker = id;
      S.save();
      renderDefaults(); renderList(); edPicker.paint();
      var sp = NB.speakerById(id);
      toast('센터 기본 목소리를 «' + (sp ? sp.name : id) + '»(으)로 저장했습니다.');
    }
  });
  // 방송 편집 화면: 안 고르면 '' = 센터 기본값을 따른다
  var edPicker = NB.VoicePicker.mount($('edVoicePick'), {
    testPrefix: 'edv',
    allowInherit: true,
    pickLabel: '이 목소리로',
    pickedLabel: '✓ 이 목소리로',
    get: function () { return (editing && editing.voice && editing.voice.speaker) || ''; },
    set: function (id) {
      if (!editing) return;
      editing.voice.speaker = id || '';
      $('edPrevHint').textContent = '저장하기 전에 지금 이 대본을 그대로 읽어드립니다.';
    },
    inheritSpeaker: function () { return S.center().defaultVoice.speaker || NB.DEFAULT_SPEAKER; }
  });

  function refreshVoiceUI() {
    V.refresh();
    var n = V.ko.length, hq = E.mode === 'clova';
    $('voiceCount').textContent = hq ? '고품질 안내 음성' : (n ? '데모 음성' : '데모 음성 · 목소리 없음');
    $('voiceCount').className = 'tag ' + (hq && n ? 'ok' : 'off');
    $('voiceEngine').textContent = E.note;
    defPicker.paint(); edPicker.paint();
    renderList();
  }
  V.onReady = refreshVoiceUI;
  E.onChange = refreshVoiceUI;

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
    var sp = NB.speakerById(c.defaultVoice.speaker) || NB.speakerById(NB.DEFAULT_SPEAKER);
    $('defSpeaker').textContent = NB.speakerLine(sp);
    defPicker.paint();
    $('listTitle').textContent = c.name + ' 방송 목록';
  }

  /* ---------- 목록 ---------- */
  function voiceTag(b) {
    var r = V.resolve(b, S.center());
    var sp = NB.speakerById(r.speaker);
    return (r.inherited ? '센터 기본 · ' : '') + (sp ? sp.name : '목소리 없음') + ' 목소리';
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
        '<p class="bcard-script" data-testid="bcard-script">' + esc(b.script) + '</p>' +
        '<button class="bcard-more" data-act="more" data-testid="card-more" hidden></button>' +
        '<div class="bcard-meta">' +
        '<span class="tag">' + esc(NB.scheduleLabel(b)) + '</span>' +
        '<span class="tag ' + nt.cls + '">' + esc(nt.t) + '</span>' +
        '<span class="tag">' + esc(voiceTag(b)) + '</span>' +
        '</div>' +
        '<div class="bcard-acts">' +
        '<button class="btn btn-sm" data-act="preview" data-testid="card-preview">▶ 미리듣기</button>' +
        '<button class="btn btn-sm" data-act="now" data-testid="card-now">즉시 송출</button>' +
        '<button class="btn btn-sm" data-act="edit" data-testid="card-edit">수정</button>' +
        '<button class="btn btn-sm btn-danger" data-act="del">삭제</button>' +
        '</div></article>';
    }).join('');
    applyClamp();
  }
  // 문구는 기본이 «전문 노출». 8줄을 실제로 넘길 때만 접고 «더보기»를 띄운다.
  // 폭에 따라 줄 수가 달라지므로 글자 수가 아니라 실측 높이로 판단한다.
  var MAX_LINES = 8, expanded = Object.create(null);
  function applyClamp() {
    var cards = document.querySelectorAll('#list [data-testid=bcard]');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i], el = card.querySelector('.bcard-script'), more = card.querySelector('.bcard-more');
      if (!el || !more) continue;
      var id = card.dataset.id, open = !!expanded[id];
      el.classList.remove('is-clamped');
      var lh = parseFloat(getComputedStyle(el).lineHeight) || 21;
      var overflows = el.scrollHeight > lh * MAX_LINES + 1;
      if (!overflows) { more.hidden = true; delete expanded[id]; continue; }
      more.hidden = false;
      more.textContent = open ? '접기' : '더보기';
      more.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open) el.classList.add('is-clamped');
    }
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
      voice: { speaker: '' },   // '' = 센터 기본 목소리를 따른다
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
    if (!editing.voice) editing.voice = { speaker: '' };
    if (!NB.speakerById(editing.voice.speaker)) editing.voice.speaker = '';
    edPicker.paint();
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
    NB.VoicePicker.stopAll();
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
    editing.schedule.type = segGet('edType');
    editing.schedule.date = $('edDate').value;
    editing.schedule.time = $('edTime').value;
    return editing;
  }
  function editorVoice() {
    return V.resolve({ voice: { speaker: (editing && editing.voice && editing.voice.speaker) || '' } }, S.center());
  }

  /* ---------- 이벤트 ---------- */
  $('centerSel').addEventListener('change', function () {
    S.state.activeCenterId = this.value; S.save(); renderAll(); refreshVoiceUI();
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
    if (act === 'more') { if (expanded[b.id]) delete expanded[b.id]; else expanded[b.id] = 1; applyClamp(); return; }
    if (act === 'toggle') { b.enabled = !b.enabled; S.upsert(b); renderList(); toast(b.name + ' — ' + (b.enabled ? '켰습니다' : '껐습니다')); }
    else if (act === 'edit') openEditor(b);
    else if (act === 'del') { if (confirm('«' + b.name + '» 방송을 삭제할까요?')) { S.remove(b.id); renderList(); toast('삭제했습니다.'); } }
    else if (act === 'now') playNow(b);
    else if (act === 'preview') {
      P.arm();
      var r = V.resolve(b, S.center());
      if (!r.voice) return toast('이 기기에 한국어 목소리가 없습니다.');
      toast('미리듣기 중…');
      P.preview(b.script, r.voice, r.rate, r.pitch).then(function (x) { if (x && x.note) toast(x.note); });
    }
  });

  segBind('edType', function (v) { editing.schedule.type = v; renderType(); });
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
    var sp = NB.speakerById(r.speaker);
    $('edPrevHint').textContent = '지금 «' + (sp ? sp.name : '') + '» 목소리로 읽는 중입니다.'
      + (r.inherited ? ' (센터 기본 목소리)' : '');
    P.preview(txt, r.voice, r.rate, r.pitch).then(function (x) {
      $('edPrevHint').textContent = (x && x.note) ? x.note : '저장하기 전에 지금 이 대본을 그대로 읽어드립니다.';
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
  // 폭이 바뀌면 줄 수가 바뀐다 → 접기 필요 여부를 다시 판정
  var clampTimer; addEventListener('resize', function () { clearTimeout(clampTimer); clampTimer = setTimeout(applyClamp, 150); });

  window.NB_setPreviewScript = function (no) { defPicker.setScript(no); };

  window.__admin = { openEditor: openEditor, renderAll: renderAll, toast: toast };
})();
