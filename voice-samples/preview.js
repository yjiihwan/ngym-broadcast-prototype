/* 「방송 목소리」 패널의 «들어볼 문안» 고르기.
 * 목소리 카드는 voice-picker.js 한 곳에 있고, 이 패널의 카드는 admin.js 가 띄운다.
 * 여기서는 문안을 바꿔 그 문안으로 미리듣기가 나게만 한다. */
(function () {
  var D = window.NB_SAMPLES;
  var segEl = document.getElementById('vsScript');
  var textEl = document.getElementById('vsText');
  if (!D || !segEl || !textEl) return;

  var pick = D.scripts[0].no;

  D.scripts.forEach(function (s) {
    var b = document.createElement('button');
    b.type = 'button';
    b.dataset.v = s.no;
    b.textContent = s.title;
    segEl.appendChild(b);
  });

  function paint() {
    [].forEach.call(segEl.children, function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.v === pick));
    });
    var s = D.scripts.filter(function (x) { return x.no === pick; })[0];
    textEl.textContent = '「' + s.text + '」';
  }

  segEl.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    pick = b.dataset.v;
    if (window.NB_setPreviewScript) NB_setPreviewScript(pick);
    paint();
  });

  paint();
})();
