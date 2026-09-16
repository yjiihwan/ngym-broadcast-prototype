/* 엔짐 자동방송 — 환경 설정 (여기에는 비밀 열쇠를 절대 넣지 않는다)
 *
 * ttsApiBase 는 음성 합성 서버의 주소다. 클로바 Client ID/Secret 은 그 서버 안에만 두고
 * 이 파일에는 주소만 적는다. 주소가 비어 있으면 서버 없이 데모 음성으로 동작한다.
 *
 * TODO(handoff): 서버를 배포한 뒤 아래 ttsApiBase 에 그 주소를 적으면 실연동된다.
 *   예) ttsApiBase: 'https://tts.example.com'
 * (빌드 도구를 쓰는 앱으로 옮길 때는 .env 의 VITE_TTS_API_BASE — src/services/tts/ttsAdapter.ts 참고)
 */
window.NB_CONFIG = {
  ttsApiBase: '',
  // 주소 뒤에 ?voice=<주소> 를 붙이면 그 값이 우선한다 (시험용).
  allowQueryOverride: true
};
