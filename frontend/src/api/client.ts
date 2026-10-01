import type { AnalyzeRequest, AnalyzeResponse, ApiError } from "../types/api";

// VITE_USE_MOCK=true 이면 서버 없이 mocks/analyze.sample.json 을 돌려준다
const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

// 녹음 형식에 맞는 확장자 (Safari는 mp4, 그 외 webm)
export function audioFileName(blob: Blob) {
  const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
  return `recording.${ext}`;
}

export async function analyze(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 1500)); // 로딩 화면 확인용
    const mock = await import("../mocks/analyze.sample.json");
    return mock.default as unknown as AnalyzeResponse;
  }

  const form = new FormData();
  form.append("audio", req.audio, audioFileName(req.audio));
  form.append("mode", req.mode);
  form.append("language", req.language);
  if (req.keywords) form.append("keywords", req.keywords);
  if (req.material) form.append("material", req.material);

  let res: Response;
  try {
    res = await fetch("/api/analyze", { method: "POST", body: form });
  } catch {
    throw new Error("서버에 연결하지 못했어요. 백엔드가 켜져 있는지 확인해 주세요.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new Error(body?.error ?? `분석 요청에 실패했어요 (${res.status})`);
  }
  return (await res.json()) as AnalyzeResponse;
}
