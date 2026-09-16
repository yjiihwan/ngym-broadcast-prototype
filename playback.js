/* 소리는 화면 전체에서 한 번에 하나만 난다 — 공용 단일 재생 관리자.
 * WHY 공용: 목소리 카드 들어보기 · 방송 카드 미리듣기 · 즉시 송출 · 편집 미리듣기 · 송출 화면이
 * 저마다 재생 상태를 들고 있으면, 두 소리가 겹쳐 울리고 밀려난 쪽 버튼 글자가 «■ 멈추기» 로 남는다.
 * 새로 시작할 때 여기서 앞엣것을 먼저 끊고, 구독자 전원이 버튼 글자를 다시 그린다.
 * 원래 voice-picker.js 안에만 있던 장치를 끌어올린 것이다. */
(function (global) {
  'use strict';
  var NB = global.NB;
  if (!NB) return;

  var cur = null;   // { key: '어디서 튼 소리인가', stop: function (byUser) {} }
  var subs = [];

  function notify() {
    var k = cur ? cur.key : '';
    subs.slice().forEach(function (f) { try { f(k); } catch (e) { } });
  }

  /* 울리던 소리를 끊는다.
   * byUser=true  → 사람이 «멈추기» 를 눌렀다
   * byUser=false → 다른 재생이 시작돼 밀려났다
   * 어느 쪽이든 «끝까지 나가지 못했다»는 뜻이므로 주인은 이력에 중간 중단을 남긴다. */
  function clear(byUser) {
    if (!cur) return false;
    var prev = cur;
    cur = null;                       // 먼저 비운다 — prev.stop() 안에서 end() 가 되불려도 헛돌게
    try { prev.stop(byUser === true); } catch (e) { }
    return true;
  }

  // 새 재생을 등록한다. 앞엣것은 자동으로 끊긴다.
  function begin(key, stopFn) {
    clear(false);
    cur = { key: String(key), stop: typeof stopFn === 'function' ? stopFn : function () { } };
    notify();
    return cur.key;
  }

  // 사람이 «멈추기» 를 눌렀다
  function stop() {
    if (!clear(true)) return false;
    notify();
    return true;
  }

  // 끝까지 다 나갔다 (자연 종료) — 주인이 스스로 뒷정리한 뒤 부른다
  function end(key) {
    if (!cur) return false;
    if (key != null && cur.key !== String(key)) return false;   // 이미 다른 소리로 넘어갔다
    cur = null;
    notify();
    return true;
  }

  function isOn(key) { return !!cur && cur.key === String(key); }
  function key() { return cur ? cur.key : ''; }
  function sub(fn) { if (typeof fn === 'function') subs.push(fn); return fn; }

  NB.Playback = {
    begin: begin, stop: stop, end: end,
    isOn: isOn, key: key, sub: sub, notify: notify
  };
})(window);
