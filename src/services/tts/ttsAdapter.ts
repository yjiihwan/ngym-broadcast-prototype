/**
 * 음성 합성 어댑터 (TypeScript 판) — 빌드 도구(Vite 등)를 쓰는 앱으로 옮길 때 쓰는 드롭인 파일.
 *
 * 프로토타입(정적 HTML)은 같은 내용의 `tts-adapter.js` 를 쓴다. 둘의 인터페이스는 같다.
 * 앱의 다른 코드는 `synthesize()` 하나만 import 한다. 서버를 붙일 때 고칠 곳도 이 파일 하나다.
 *
 * 전환 방법 (두 줄이면 끝)
 *   1) .env 에  VITE_TTS_API_BASE=https://tts.example.com
 *   2) 끝. 값이 비어 있으면 자동으로 mock 으로 떨어진다.
 *
 * 규격은 docs/HANDOFF_FOR_DEV.md §3 «서버가 제공해야 할 API» 와 같다.
 */

export type SpeakerId = 'nara_call' | 'nminyoung' | 'njonghyun' | 'nsinu';

export interface SynthesizeRequest {
  /** 읽을 문구. 긴 대본은 호출 전에 문장 단위로 쪼개 보낸다. */
  text: string;
  /** 화자 코드. 화면에서 고를 수 있는 값은 SpeakerId 4종뿐이다. */
  speaker: SpeakerId | string;
  /** 말하기 속도. 클로바 눈금(-5~5, 클수록 느림). 이 서비스는 항상 0(기본). */
  speed?: number;
  /** 목소리 톤(-5~5). 이 서비스는 항상 0(기본). */
  pitch?: number;
  format?: 'mp3' | 'wav';
}

export interface SynthesizeResult {
  /** 재생할 소리. null 이면 «브라우저 기본 음성으로 읽으라»는 뜻. */
  audio: ArrayBuffer | null;
  /** 어느 구현이 응답했는지 — 화면의 «데모 음성» 안내를 띄울지 판단한다. */
  source: 'server' | 'mock';
}

export interface TtsHealth {
  configured: boolean;
  speakers: Array<{ code: string; name: string; gender?: string; desc?: string }>;
}

export class TtsError extends Error {
  code: string;
  human: string;
  constructor(code: string, human: string) {
    super(human);
    this.code = code;
    this.human = human;
  }
}

/** 서버 주소. 비어 있으면 mock 으로 동작한다. */
// TODO(handoff): 실서버 연동 — .env 의 VITE_TTS_API_BASE 한 줄만 채우면 serverTts 로 전환된다.
const API_BASE: string = (import.meta.env?.VITE_TTS_API_BASE ?? '').replace(/\/+$/, '');

const TIMEOUT_MS = 25_000;

async function withTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* ── mock: 서버 없이 화면을 끝까지 돌리기 위한 구현 ───────────────────────
 * 미리 합성해 둔 데모 mp3 가 있으면 그것을 돌려주고, 없으면 null 을 돌려
 * 브라우저의 Web Speech API 로 읽게 한다.
 * 이 경로로 소리가 날 때는 화면에 «데모 음성 — 실서비스에선 서버에서 합성됩니다» 를 띄운다. */
const DEMO_DIR = '/voice-samples/';
const DEMO_SCRIPTS: Record<string, string> = {
  // 문구 앞머리(공백 제거 24자) -> 데모 파일 번호
  // 실제 목록은 voice-samples/samples.js 가 정본이다.
};

const mockTts = {
  async health(): Promise<TtsHealth | null> {
    return null;
  },
  async synthesize(req: SynthesizeRequest): Promise<SynthesizeResult> {
    const key = req.text.replace(/\s+/g, '').slice(0, 24);
    const no = DEMO_SCRIPTS[key];
    if (!no || !req.speaker) return { audio: null, source: 'mock' };
    try {
      const r = await withTimeout(`${DEMO_DIR}${req.speaker}_${no}.mp3`, { method: 'GET' }, 8_000);
      return { audio: r.ok ? await r.arrayBuffer() : null, source: 'mock' };
    } catch {
      return { audio: null, source: 'mock' };
    }
  },
};

/* ── server: 실서비스 구현 ────────────────────────────────────────────── */
const serverTts = {
  async health(): Promise<TtsHealth | null> {
    try {
      const r = await withTimeout(`${API_BASE}/health`, { method: 'GET' }, 6_000);
      return r.ok ? ((await r.json()) as TtsHealth) : null;
    } catch {
      return null;
    }
  },
  async synthesize(req: SynthesizeRequest): Promise<SynthesizeResult> {
    // TODO(handoff): 서버가 인증을 요구하면 여기에 헤더를 추가한다 (예: Authorization).
    //                클로바 Client ID/Secret 은 절대 프론트엔드에 두지 않는다 — 서버 안에만 둔다.
    const r = await withTimeout(
      `${API_BASE}/tts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: req.text,
          speaker: req.speaker,
          speed: req.speed ?? 0,
          pitch: req.pitch ?? 0,
          volume: 0,
          format: req.format ?? 'mp3',
        }),
      },
      TIMEOUT_MS,
    );
    if (r.ok) {
      // 서버는 둘 중 아무 모양으로나 답해도 된다: mp3 본문, 또는 { audioUrl } JSON
      const ct = (r.headers.get('content-type') ?? '').toLowerCase();
      if (!ct.includes('application/json')) return { audio: await r.arrayBuffer(), source: 'server' };
      const j = (await r.json()) as { audioUrl?: string };
      if (!j.audioUrl) throw new TtsError('bad_response', '음성을 받지 못했습니다.');
      const a = await withTimeout(j.audioUrl, { method: 'GET' }, TIMEOUT_MS);
      return { audio: await a.arrayBuffer(), source: 'server' };
    }
    const body = await r.json().catch(() => ({}) as Record<string, string>);
    throw new TtsError(body.error ?? 'upstream_error', body.message ?? '음성을 만들지 못했습니다.');
  },
};

const impl = () => (API_BASE ? serverTts : mockTts);

/** 지금 어느 구현이 붙어 있는지 — 화면의 «데모 음성» 안내 표시에 쓴다. */
export const ttsMode = (): 'server' | 'mock' => (API_BASE ? 'server' : 'mock');

/** 서버가 살아 있고 열쇠가 꽂혀 있는지 확인한다. mock 이면 null. */
export const health = (): Promise<TtsHealth | null> => impl().health();

/** 글자를 소리로 바꾼다. 앱의 다른 코드는 이 함수만 부른다. */
export const synthesize = (req: SynthesizeRequest): Promise<SynthesizeResult> => impl().synthesize(req);

export default { ttsMode, health, synthesize };
