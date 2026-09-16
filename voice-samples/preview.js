/* 방송 목소리 고르기 — 미리 만들어 둔 클로바보이스 mp3 로 네 목소리를 들어보고 그중 하나를 고른다.
 * WHY 정적 파일: 이 단계는 중계 서버 없이 소리만 들려주는 것이 목적이다(형 승인 전 서버 배포 금지).
 * 고른 값은 센터 기본 목소리(defaultVoice.speaker)로 저장돼 실제 송출 화자로 쓰인다. */
(function () {
  var D = window.NB_SAMPLES;
  var S = window.NB && NB.Store;
  var root = document.getElementById('vsPanel');
  if (!D || !S || !root) return;

  var pick = D.scripts[0].no;
  var audio = new Audio();
  var playing = '';

  var segEl = document.getElementById('vsScript');
  var textEl = document.getElementById('vsText');
  var listEl = document.getElementById('vsList');

  function chosen() {
    var dv = S.center().defaultVoice || {};
    return NB.speakerById(dv.speaker) ? dv.speaker : NB.DEFAULT_SPEAKER;
  }

  D.scripts.forEach(function (s) {
    var b = document.createElement('button');
    b.type = 'button';
    b.dataset.v = s.no;
    b.textContent = s.title;
    segEl.appendChild(b);
  });

  listEl.innerHTML = NB.SPEAKERS.map(function (sp) {
    var who = (sp.gender === 'female' ? '여성' : '남성') + ' · ' + sp.tone;
    return '<div class="vs-card" data-testid="vs-card-' + sp.id + '" data-sp="' + sp.id + '">' +
      '<div class="vs-card-h">' +
        '<b class="vs-name">' + sp.name + '</b>' +
        '<span class="tag cta vs-badge" data-testid="vs-badge-' + sp.id + '">✓ 선택됨</span>' +
      '</div>' +
      '<p class="vs-note">' + who + '</p>' +
      '<p class="vs-hz">' + sp.hz + '</p>' +
      '<button type="button" class="btn btn-cta vs-play" data-sp="' + sp.id + '" ' +
        'data-testid="vs-play-' + sp.id + '">▶ 들어보기</button>' +
      '<button type="button" class="btn vs-pick" data-sp="' + sp.id + '" ' +
        'data-testid="vs-pick-' + sp.id + '">이 목소리로 설정</button>' +
    '</div>';
  }).join('');

  function stop() {
    audio.pause();
    audio.currentTime = 0;
    playing = '';
    paint();
  }

  function paint() {
    var sel = chosen();
    Array.prototype.forEach.call(segEl.children, function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.v === pick));
    });
    var s = D.scripts.filter(function (x) { return x.no === pick; })[0];
    textEl.textContent = '「' + s.text + '」';
    Array.prototype.forEach.call(listEl.querySelectorAll('.vs-card'), function (card) {
      var on = card.dataset.sp === sel;
      card.classList.toggle('is-on', on);
      card.setAttribute('aria-selected', String(on));
      var play = card.querySelector('.vs-play');
      var live = play.dataset.sp === playing;
      play.textContent = live ? '■ 멈추기' : '▶ 들어보기';
      play.setAttribute('aria-pressed', String(live));
      var pk = card.querySelector('.vs-pick');
      pk.textContent = on ? '✓ 이 목소리로 설정됨' : '이 목소리로 설정';
      pk.classList.toggle('is-on', on);
      pk.setAttribute('aria-pressed', String(on));
    });
  }

  segEl.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    pick = b.dataset.v;
    stop();
  });

  listEl.addEventListener('click', function (e) {
    var b = e.target.closest('.vs-play');
    if (b) {
      var sp = b.dataset.sp;
      if (playing === sp) { stop(); return; }
      audio.src = 'voice-samples/' + sp + '_' + pick + '.mp3';
      playing = sp;
      paint();
      audio.play().catch(function () { stop(); });
      return;
    }
    var k = e.target.closest('.vs-pick');
    if (!k) return;
    var c = S.center();
    if (c.defaultVoice.speaker === k.dataset.sp) return;
    c.defaultVoice.speaker = k.dataset.sp;
    c.defaultVoice.voiceURI = '';   // 직접 지정해 둔 화자가 있으면 고른 목소리를 덮어써 버린다
    S.save();
    paint();
    if (window.NB_onVoicePicked) NB_onVoicePicked();
  });

  audio.addEventListener('ended', stop);
  S.sub(paint);
  paint();
  window.NB_paintVoicePick = paint;
})();
