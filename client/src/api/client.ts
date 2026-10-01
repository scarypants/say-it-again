import type { AnalyzeRequest, AnalyzeResponse, ApiError } from "../types/api";

// VITE_USE_MOCK=true 이면 서버 없이 mocks/analyze.sample.json 을 돌려준다
const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

export async function analyze(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  if (USE_MOCK) {
    const mock = await import("../mocks/analyze.sample.json");
    return mock.default as unknown as AnalyzeResponse;
  }

  const form = new FormData();
  form.append("audio", req.audio, "recording.webm");
  form.append("mode", req.mode);
  form.append("language", req.language);
  if (req.keywords) form.append("keywords", req.keywords);
  if (req.material) form.append("material", req.material);

  const res = await fetch("/api/analyze", { method: "POST", body: form });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new Error(body?.error ?? `분석 요청 실패 (${res.status})`);
  }
  return (await res.json()) as AnalyzeResponse;
}
