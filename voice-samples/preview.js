/* 목소리 미리듣기 — 미리 만들어 둔 클로바보이스 mp3 를 눌러 비교하는 영역.
 * WHY 정적 파일: 이 단계는 중계 서버 없이 소리만 들려주는 것이 목적이다(형 승인 전 서버 배포 금지). */
(function () {
  var D = window.NB_SAMPLES;
  var root = document.getElementById('vsPanel');
  if (!D || !root) return;

  var pick = D.scripts[0].no;
  var audio = new Audio();
  var playing = '';

  var segEl = document.getElementById('vsScript');
  var textEl = document.getElementById('vsText');
  var listEl = document.getElementById('vsList');

  D.scripts.forEach(function (s) {
    var b = document.createElement('button');
    b.type = 'button';
    b.dataset.v = s.no;
    b.textContent = s.title;
    segEl.appendChild(b);
  });

  listEl.innerHTML = D.speakers.map(function (sp) {
    return '<div class="vs-card" data-testid="vs-card-' + sp.id + '">' +
      '<div class="vs-card-h">' +
        '<b class="vs-name">' + sp.name + '</b>' +
        '<span class="tag">' + sp.gender + '</span>' +
      '</div>' +
      '<p class="vs-note">' + sp.note + '</p>' +
      '<button type="button" class="btn btn-cta vs-play" data-sp="' + sp.id + '" ' +
        'data-testid="vs-play-' + sp.id + '">▶ 들어보기</button>' +
    '</div>';
  }).join('');

  function stop() {
    audio.pause();
    audio.currentTime = 0;
    playing = '';
    paint();
  }

  function paint() {
    Array.prototype.forEach.call(segEl.children, function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.v === pick));
    });
    var s = D.scripts.filter(function (x) { return x.no === pick; })[0];
    textEl.textContent = '「' + s.text + '」';
    Array.prototype.forEach.call(listEl.querySelectorAll('.vs-play'), function (b) {
      var on = b.dataset.sp === playing;
      b.textContent = on ? '■ 멈추기' : '▶ 들어보기';
      b.setAttribute('aria-pressed', String(on));
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
    if (!b) return;
    var sp = b.dataset.sp;
    if (playing === sp) { stop(); return; }
    audio.src = 'voice-samples/' + sp + '_' + pick + '.mp3';
    playing = sp;
    paint();
    audio.play().catch(function () { stop(); });
  });

  audio.addEventListener('ended', stop);
  paint();
})();
