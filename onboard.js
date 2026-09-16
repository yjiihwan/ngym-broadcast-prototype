/* 최초 진입 사용설명 — 자동 노출은 처음 한 번뿐, 다시 보기는 «? 도움말» */
(function () {
  'use strict';
  var mask = document.getElementById('obMask');
  if (!mask) return;
  var KEY = (window.NB && NB.KEYS && NB.KEYS.onboarded) || 'ngym_bcast_onboarded_v1';

  function seen() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return true; } }
  function mark() { try { localStorage.setItem(KEY, '1'); } catch (e) { } }

  function open() {
    mask.classList.remove('hide');
    document.body.style.overflow = 'hidden';
    var b = document.getElementById('obStart');
    if (b) b.focus();
  }
  function close() {
    mask.classList.add('hide');
    document.body.style.overflow = '';
    mark();   // 닫는 순간 본 것으로 친다 — 어느 버튼으로 닫아도 같다
  }

  document.getElementById('obClose').addEventListener('click', close);
  document.getElementById('obStart').addEventListener('click', close);
  mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !mask.classList.contains('hide')) close();
  });
  document.getElementById('helpBtn').addEventListener('click', open);

  if (!seen()) open();

  window.__onboard = { open: open, close: close };
})();
