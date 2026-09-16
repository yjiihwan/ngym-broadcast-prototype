/* 목소리 고르기 카드 — 화면 세 곳(방송 목소리 / 센터 기본값 / 방송 편집)이 모두 이 파일 하나를 쓴다.
 * WHY 한 곳: 같은 카드를 세 벌로 복사하면 문구·선택 표시·미리듣기가 서로 어긋난다.
 * 고를 수 있는 값은 core.js 의 SPEAKERS 4명뿐이다. 속도·톤·성별 고르기는 없다. */
(function (global) {
  'use strict';
  var NB = global.NB;
  if (!NB) return;

  // 미리듣기는 화면 전체에서 한 번에 하나만 난다 (여러 카드가 겹쳐 울리지 않게)
  var audio = new Audio();
  var playing = '';        // 지금 울리는 화자 id
  var owner = null;        // 그 소리를 튼 피커
  var mounted = [];

  function resetLocal() {
    try { audio.pause(); audio.currentTime = 0; } catch (e) { }
    playing = ''; owner = null;
    repaintAll();
  }
  /* 단일 재생 관리는 NB.Playback 으로 옮겼다 (방송 미리듣기·즉시 송출과도 겹치지 않게).
   * 여기서 울리는 중일 때만 관리자에게 넘긴다 — 남의 소리를 끄면 안 된다. */
  function stopAll() {
    if (playing && NB.Playback) { NB.Playback.stop(); return; }
    resetLocal();
  }
  function repaintAll() { mounted.forEach(function (p) { try { p.paint(); } catch (e) { } }); }
  audio.addEventListener('ended', stopAll);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* el 에 카드 4장을 그린다.
   * opts.get()            -> 지금 고른 화자 id (항상 4명 중 하나여야 한다)
   * opts.set(id)          -> 고른 값을 저장한다
   * opts.showDefaultHint  -> 방송 편집처럼 «센터 기본은 지금 OOO» 안내 줄을 다는 화면
   * opts.defaultSpeaker() -> 그 시점 센터 기본 화자 id (되돌리기 버튼이 이 값으로 되돌린다)
   * opts.testPrefix       -> data-testid 앞머리 (기본 'vs')
   * opts.pickLabel/pickedLabel -> 고르기 버튼 글자
   * opts.scriptNo         -> 미리듣기로 틀 문안 번호 (기본 '1')
   */
  function mount(el, opts) {
    if (!el) return null;
    opts = opts || {};
    var pre = opts.testPrefix || 'vs';
    var pickLabel = opts.pickLabel || '이 목소리로 설정';
    var pickedLabel = opts.pickedLabel || '✓ 이 목소리로 설정됨';
    var scriptNo = opts.scriptNo || '1';

    el.classList.add('vp');
    el.innerHTML =
      '<div class="vs-list" data-testid="' + pre + '-list">' +
        NB.SPEAKERS.map(function (sp) {
          return '<div class="vs-card" data-testid="' + pre + '-card-' + sp.id + '" data-sp="' + sp.id + '">' +
            '<div class="vs-card-h">' +
              '<b class="vs-name">' + esc(sp.name) + '</b>' +
              '<span class="tag cta vs-badge" data-testid="' + pre + '-badge-' + sp.id + '">✓ 선택됨</span>' +
            '</div>' +
            '<p class="vs-note">' + esc((sp.gender === 'female' ? '여성' : '남성') + ' · ' + sp.tone) + '</p>' +
            '<button type="button" class="btn btn-cta vs-play" data-sp="' + sp.id + '" ' +
              'data-testid="' + pre + '-play-' + sp.id + '">▶ 들어보기</button>' +
            '<button type="button" class="btn vs-pick" data-sp="' + sp.id + '" ' +
              'data-testid="' + pre + '-pick-' + sp.id + '">' + pickLabel + '</button>' +
          '</div>';
        }).join('') +
      '</div>' +
      (opts.showDefaultHint
        ? '<p class="vp-state" data-testid="' + pre + '-state"></p>'
        : '') +
      '<p class="vp-demo" data-testid="' + pre + '-demo" hidden>데모 음성 — 실서비스에선 서버에서 합성됩니다.</p>';

    var listEl = el.querySelector('.vs-list');
    var stateEl = el.querySelector('.vp-state');
    var demoEl = el.querySelector('.vp-demo');

    var api = {
      el: el,
      setScript: function (no) { scriptNo = no || '1'; if (playing && owner === api) stopAll(); },
      paint: paint,
      destroy: function () {
        if (owner === api) stopAll();
        mounted = mounted.filter(function (x) { return x !== api; });
      }
    };

    function paint() {
      var cur = opts.get ? (opts.get() || '') : '';
      // 고른 값이 비거나 깨졌으면 센터 기본으로 채워 «항상 한 장은 선택» 상태를 지킨다
      if (!NB.speakerById(cur)) cur = opts.defaultSpeaker ? (opts.defaultSpeaker() || '') : '';
      if (!NB.speakerById(cur)) cur = NB.DEFAULT_SPEAKER;
      var def = opts.defaultSpeaker ? (opts.defaultSpeaker() || '') : '';
      [].forEach.call(listEl.querySelectorAll('.vs-card'), function (card) {
        var id = card.dataset.sp;
        var on = id === cur;
        card.classList.toggle('is-on', on);
        card.setAttribute('aria-selected', String(on));
        var play = card.querySelector('.vs-play');
        var live = (owner === api) && playing === id;
        play.textContent = live ? '■ 멈추기' : '▶ 들어보기';
        play.setAttribute('aria-pressed', String(live));
        var pk = card.querySelector('.vs-pick');
        pk.textContent = on ? pickedLabel : pickLabel;
        pk.classList.toggle('is-on', on);
        pk.setAttribute('aria-pressed', String(on));
      });
      if (stateEl) {
        var cs = NB.speakerById(cur), ds = NB.speakerById(def);
        // 방송마다 화자를 따로 들고 있으므로, 센터 기본은 «참고값»으로만 알려준다.
        stateEl.innerHTML = (cur === def)
          ? '이 방송은 <b>' + esc(cs ? cs.name : '') + '</b> 목소리로 나갑니다 — 지금 센터 기본 목소리와 같습니다.'
          : '이 방송은 <b>' + esc(cs ? cs.name : '') + '</b> 목소리로 나갑니다. ' +
            '지금 센터 기본 목소리는 <b>' + esc(ds ? ds.name : '') + '</b> 입니다. ' +
            '<button type="button" class="linkbtn" data-act="inherit" data-testid="' + pre + '-inherit">센터 기본값으로 되돌리기</button>';
      }
      if (demoEl) demoEl.hidden = !(owner === api && playing);
    }

    listEl.addEventListener('click', function (e) {
      var pl = e.target.closest('.vs-play');
      if (pl) {
        var id = pl.dataset.sp;
        if (owner === api && playing === id) { stopAll(); return; }
        stopAll();
        audio.src = 'voice-samples/' + id + '_' + scriptNo + '.mp3';
        playing = id; owner = api;
        if (NB.Playback) NB.Playback.begin('sample:' + id, resetLocal);
        repaintAll();
        audio.play().catch(stopAll);
        return;
      }
      var pk = e.target.closest('.vs-pick');
      if (!pk) return;
      // 항상 4장 중 한 장이 선택돼 있다 — 다시 눌러도 선택이 풀리지 않는다
      var want = pk.dataset.sp;
      if (opts.set) opts.set(want);
      repaintAll();
    });

    if (stateEl) {
      stateEl.addEventListener('click', function (e) {
        if (!e.target.closest('[data-act=inherit]')) return;
        var d = opts.defaultSpeaker ? opts.defaultSpeaker() : '';
        if (opts.set && NB.speakerById(d)) opts.set(d);
        repaintAll();
      });
    }

    mounted.push(api);
    paint();
    return api;
  }

  // _audio 는 검증 스크립트가 재생 상태를 들여다보려고 열어 둔 것이다
  NB.VoicePicker = { mount: mount, stopAll: stopAll, repaintAll: repaintAll, _audio: audio };
})(window);
