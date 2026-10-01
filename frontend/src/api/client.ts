import type {
  AnalyzeRequest,
  AnalyzeResponse,
  ApiError,
  CompareStats,
  RetryRequest,
  RetryResponse,
  TranscribeRequest,
  TranscribeResponse,
} from "../types/api";

// VITE_USE_MOCK=true 이면 서버 없이 mocks/의 예시 응답을 돌려준다
const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

// 녹음 형식에 맞는 확장자 (Safari는 mp4, 그 외 webm)
export function audioFileName(blob: Blob) {
  // 올린 파일은 원래 확장자를 쓴다 (서버·whisper가 확장자로 형식을 본다)
  const own = blob instanceof File ? blob.name.match(/\.(\w+)$/)?.[1]?.toLowerCase() : undefined;
  const ext =
    own ?? (blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm");
  return `recording.${ext}`;
}

// 안드로이드 녹음 앱의 .m4a는 속이 3gp 형식(ftyp 3gp4)이라 whisper가 거절한다.
// 오디오는 같은 AAC라서 앞의 형식 표시만 M4A로 바꾸면 읽힌다
async function fix3gp(blob: Blob): Promise<Blob> {
  const head = new Uint8Array(await blob.slice(0, 24).arrayBuffer());
  const brand = String.fromCharCode(...head.slice(8, 11));
  if (brand !== "3gp") return blob;
  const m4a = [0x4d, 0x34, 0x41, 0x20]; // "M4A "
  head.set(m4a, 8);
  head.set([0x69, 0x73, 0x6f, 0x6d], 16); // "isom"
  if (head.length >= 24) head.set(m4a, 20);
  return new Blob([head, blob.slice(24)], { type: "audio/mp4" });
}

// [1] 녹음 → 문장 단위 대본. audio 필드를 녹음 순서대로 여러 번 붙인다 (서버는 붙인 순서를 파트 순서로 씀)
export async function transcribe(req: TranscribeRequest): Promise<TranscribeResponse> {
  if (USE_MOCK) return mock(() => import("../mocks/transcribe.sample.json"));

  const form = new FormData();
  form.append("mode", req.mode);
  form.append("language", req.language);
  if (req.level) form.append("level", req.level);
  if (req.exam) form.append("exam", req.exam);
  if (req.questions) form.append("questions", JSON.stringify(req.questions));
  const prefix = req.mode === "speaking" ? "q" : "part";
  const audio = await Promise.all(req.audio.map(fix3gp));
  audio.forEach((a, i) =>
    form.append("audio", a, `${prefix}${i + 1}-${audioFileName(req.audio[i])}`),
  );

  return post<TranscribeResponse>("/api/transcribe", { method: "POST", body: form });
}

// [2] 검토·수정한 대본 → 분석. 녹음 파일은 다시 보내지 않는다
export async function analyze(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  if (USE_MOCK) return mock(() => import("../mocks/analyze.sample.json"));

  return post<AnalyzeResponse>("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}

// [3] "다시, 말해" 재도전: 새 대본 + 이전 결과 요약 → 분석 + 전후 비교
export async function retry(req: RetryRequest): Promise<RetryResponse> {
  if (USE_MOCK) return mockRetry(req);

  return post<RetryResponse>("/api/retry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}

// mock 재도전: 예시 분석 결과를 docs/api.md 5절의 retry 응답 모양으로 바꾸고 이전 수치와 비교한다 (화면 확인용)
async function mockRetry(req: RetryRequest): Promise<RetryResponse> {
  const res = await mock<AnalyzeResponse>(() => import("../mocks/analyze.sample.json"));
  const perMin = (n: number, sec: number) => (sec > 0 ? Math.round((n / sec) * 600) / 10 : 0);
  const stats = (
    s: AnalyzeResponse["analysis"]["stats"],
    score: number,
    durationSec: number,
  ): CompareStats => ({
    score,
    durationSec,
    wpm: s.wpm,
    fillerCount: s.fillerCount,
    panicCount: s.panicCount,
    panicTotalSec: s.panicTotalSec,
    repeatCount: s.repeatCount,
    fillerPerMin: perMin(s.fillerCount, durationSec),
    panicPerMin: perMin(s.panicCount, durationSec),
    repeatPerMin: perMin(s.repeatCount, durationSec),
  });
  const r = req.previous.categoryRatio;
  const before = stats(
    req.previous.stats,
    r.normal + r.expression + r.grammar,
    req.previous.durationSec,
  );
  const after = stats(
    {
      ...res.analysis.stats,
      fillerCount: 2,
      panicCount: 1,
      panicTotalSec: 2.1,
      expressionCount: 0,
      grammarCount: 0,
    },
    Math.min(100, before.score + 12),
    Math.round(res.parts.reduce((sum, p) => sum + p.duration, 0) * 10) / 10,
  );
  const retry = {
    improved: [`패닉존이 ${before.panicCount}번에서 ${after.panicCount}번으로 줄었어요`],
    remaining: ["해결책으로 넘어가는 부분에서 아직 2초 정도 멈춰요"],
    comment: "대안 대본을 따라 문장을 짧게 끊으면서 막힘이 줄었어요.",
  };
  return {
    ...res,
    // retry는 panic·filler·repeat만, 패닉 원인·대안 없음, final은 빈 배열
    parts: res.parts.map((p) => ({
      ...p,
      comment: undefined,
      final: [],
      highlight: p.highlight
        .filter((h) => h.category === "panic" || h.category === "filler" || h.category === "repeat")
        .map((h) => (h.category === "panic" ? { ...h, reason: undefined, fixed: undefined } : h)),
    })),
    charts: {
      ...res.charts,
      categoryRatio: { ...res.charts.categoryRatio, expression: 0, grammar: 0 },
    },
    analysis: {
      score: after.score,
      stats: {
        ...res.analysis.stats,
        fillerCount: after.fillerCount,
        panicCount: after.panicCount,
        panicTotalSec: after.panicTotalSec,
        expressionCount: 0,
        grammarCount: 0,
      },
      summary: { headline: retry.comment, topPriorities: retry.remaining, comment: "" },
    },
    compare: { scriptMatch: req.previous.final.length ? 87 : null, before, after },
    retry,
  };
}

async function mock<T>(load: () => Promise<{ default: unknown }>): Promise<T> {
  await new Promise((r) => setTimeout(r, 1200)); // 로딩 화면 확인용
  return (await load()).default as T;
}

// 서버가 돌려준 오류. status로 종류를 구분한다 (예: 422 = 음성이 감지되지 않음)
export class RequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function post<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error("서버에 연결하지 못했어요. 백엔드가 켜져 있는지 확인해 주세요.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new RequestError(body?.error ?? `요청에 실패했어요 (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}
