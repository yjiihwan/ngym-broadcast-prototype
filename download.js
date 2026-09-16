/* PC 앱 다운로드 화면 — 표기는 전부 desktop-releases.js 한 곳에서 온다 */
(function () {
  'use strict';
  var D = window.NGYM_DESKTOP;
  if (!D) return;

  var badge = document.querySelector('[data-testid="dl-version"]');
  if (badge) badge.textContent = '버전 ' + D.VERSION;

  var grid = document.getElementById('dlGrid');
  D.BUILDS.forEach(function (b) {
    var card = document.createElement('div');
    card.className = 'dl-card';
    card.setAttribute('data-testid', 'dl-card-' + b.os);

    var h = document.createElement('div');
    h.className = 'dl-card-h';
    var ic = document.createElement('span');
    ic.className = 'dl-ic';
    ic.setAttribute('aria-hidden', 'true');
    ic.textContent = b.icon;
    var nm = document.createElement('h3');
    nm.textContent = b.osName;
    h.appendChild(ic); h.appendChild(nm);

    var dl = document.createElement('dl');
    dl.className = 'dl-spec';
    [['버전', D.VERSION], ['파일 크기', b.size], ['필요 사양', b.requires]].forEach(function (pair) {
      var dt = document.createElement('dt'); dt.textContent = pair[0];
      var dd = document.createElement('dd'); dd.textContent = pair[1];
      dl.appendChild(dt); dl.appendChild(dd);
    });

    var note = document.createElement('p');
    note.className = 'hintline';
    note.textContent = b.note;

    var a = document.createElement('a');
    a.className = 'btn btn-cta';
    a.href = b.url;
    a.setAttribute('download', b.fileName);
    a.setAttribute('rel', 'noopener');
    a.setAttribute('data-testid', 'dl-btn-' + b.os);
    a.textContent = b.osName + '용 받기';

    var fn = document.createElement('p');
    fn.className = 'dl-file';
    fn.textContent = b.fileName;

    card.appendChild(h);
    card.appendChild(dl);
    card.appendChild(note);
    card.appendChild(a);
    card.appendChild(fn);
    grid.appendChild(card);
  });

  if (D.MAC_UNSIGNED_NOTICE) {
    var p = document.getElementById('dlMacPanel');
    if (p) p.hidden = false;
  }
})();
