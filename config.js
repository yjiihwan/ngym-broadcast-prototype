/* 엔짐 자동방송 — 환경 설정 (여기에는 비밀 열쇠를 절대 넣지 않는다)
 *
 * proxyBase 는 «음성 중계 서버» 주소다. 클로바 열쇠는 그 서버 안에만 있고
 * 이 파일에는 주소만 적는다. 주소가 비어 있으면 브라우저 기본 음성으로 동작한다.
 *
 * 열쇠를 받은 뒤 할 일: 아래 proxyBase 에 배포된 중계 서버 주소를 적는다.
 *   예) proxyBase: 'https://ngym-voice-proxy.up.railway.app'
 */
window.NB_CONFIG = {
  proxyBase: '',
  // 주소 뒤에 ?voice=<주소> 를 붙이면 그 값이 우선한다 (시험용).
  allowQueryOverride: true
};
