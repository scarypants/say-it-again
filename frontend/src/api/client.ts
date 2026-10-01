import type { AnalyzeRequest, AnalyzeResponse, ApiError, Exam } from "../types/api";
import { QUESTION_BANK } from "./questionBank";

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
  if (req.question) form.append("question", req.question);

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

// 어학 질문 5개. 서버(GET /api/questions?exam=)가 만들어 주면 그걸 쓰고,
// 서버가 없거나 실패하면 기본 문제은행으로 대신한다 (시연이 끊기지 않게)
export async function fetchQuestions(exam: Exam): Promise<string[]> {
  if (USE_MOCK) return QUESTION_BANK[exam];
  try {
    const res = await fetch(`/api/questions?exam=${exam}`);
    if (!res.ok) throw new Error();
    const body = (await res.json()) as { questions?: string[] };
    return body.questions?.length ? body.questions : QUESTION_BANK[exam];
  } catch {
    return QUESTION_BANK[exam];
  }
}
