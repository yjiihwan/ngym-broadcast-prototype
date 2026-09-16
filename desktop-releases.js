/* 엔짐 자동방송 PC 앱 — 배포 정본 (SSOT)
 *
 * 다음 판을 올릴 때는 아래 VERSION 한 줄만 바꾸면 파일명·내려받기 주소·화면 표기가 전부 따라온다.
 * (용량은 실제 파일 크기로 함께 고쳐 준다.)
 * 애플 서명·공증이 끝나면 MAC_UNSIGNED_NOTICE 를 false 로만 바꾸면 경고 안내가 사라진다.
 */
(function (global) {
  var VERSION = '0.1.0';
  var REPO = 'yjiihwan/ngym-broadcast-desktop';
  var TAG = 'v' + VERSION;
  var BASE = 'https://github.com/' + REPO + '/releases/download/' + TAG + '/';

  function fileOf(name) { return BASE + name; }

  global.NGYM_DESKTOP = {
    VERSION: VERSION,
    REPO: REPO,
    TAG: TAG,
    RELEASE_PAGE: 'https://github.com/' + REPO + '/releases/tag/' + TAG,
    MAC_UNSIGNED_NOTICE: true,
    BUILDS: [
      {
        os: 'win',
        icon: 'win',
        osName: '윈도우',
        fileName: 'Enzyme-Broadcast-Setup-' + VERSION + '.exe',
        url: fileOf('Enzyme-Broadcast-Setup-' + VERSION + '.exe'),
        size: '93.6 MB',
        requires: '윈도우 10 이상 · 64비트',
        note: '내려받은 파일을 두 번 눌러 설치하면 바로 실행됩니다.'
      },
      {
        os: 'mac',
        icon: 'mac',
        osName: '맥',
        fileName: 'Enzyme-Broadcast-' + VERSION + '-universal.dmg',
        url: fileOf('Enzyme-Broadcast-' + VERSION + '-universal.dmg'),
        size: '200.1 MB',
        requires: 'macOS 11 빅서 이상 · 애플 실리콘과 인텔 모두',
        note: '인텔 맥과 애플 실리콘 맥에서 같은 파일을 씁니다.'
      }
    ]
  };
})(window);
