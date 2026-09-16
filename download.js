/* PC 앱 다운로드 화면 — 표기는 전부 desktop-releases.js 한 곳에서 온다 */
(function () {
  'use strict';
  // OS 표식은 그림 파일 없이 그린다 — 이모지는 글꼴이 없는 PC 에서 흑백으로 떨어진다.
  var MARKS = {
    win: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" role="img" focusable="false">' +
      '<path d="M3 5.4 10.6 4.3v7.2H3zM11.7 4.1 21 2.8v8.7h-9.3zM3 12.6h7.6v7.2L3 18.7zM11.7 12.6H21v8.7l-9.3-1.3z"/></svg>',
    mac: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" role="img" focusable="false">' +
      '<path d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.9-1.4-.1-2.8.9-3.6.9-.7 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.5.8 1.2 1.7 2.4 3 2.4 1.2 0 1.6-.8 3.1-.8 1.4 0 1.8.8 3.1.7 1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.5-1-2.6-3.9zM14.1 5.4c.7-.8 1.1-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z"/></svg>'
  };

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
    ic.innerHTML = MARKS[b.icon] || '';
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
