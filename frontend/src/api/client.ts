import type {
  AnalyzeRequest,
  AnalyzeResponse,
  ApiError,
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

async function mock<T>(load: () => Promise<{ default: unknown }>): Promise<T> {
  await new Promise((r) => setTimeout(r, 1200)); // 로딩 화면 확인용
  return (await load()).default as T;
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
    throw new Error(body?.error ?? `요청에 실패했어요 (${res.status})`);
  }
  return (await res.json()) as T;
}
