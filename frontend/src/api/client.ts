import type {
  AnalyzeRequest,
  AnalyzeResponse,
  ApiError,
  SpeakingAnalyzeRequest,
} from "../types/api";
import { rememberRecordings } from "../pages/script/recordings";

// VITE_USE_MOCK=true 이면 서버 없이 mocks/analyze.sample.json 을 돌려준다
const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

// 녹음 형식에 맞는 확장자 (Safari는 mp4, 그 외 webm)
export function audioFileName(blob: Blob) {
  const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
  return `recording.${ext}`;
}

export async function analyze(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  if (USE_MOCK) {
    const result = await mockResponse();
    rememberRecordings(result, req.audio);
    return result;
  }

  // 긴 발표는 5분짜리 파일 여러 개: audio 필드를 녹음 순서대로 여러 번 붙인다
  const form = new FormData();
  req.audio.forEach((a, i) => form.append("audio", a, `part${i + 1}-${audioFileName(a)}`));
  form.append("mode", req.mode);
  form.append("language", req.language);
  if (req.level) form.append("level", req.level);

  const result = await postAnalyze(form);
  rememberRecordings(result, req.audio);
  return result;
}

// 어학 스피킹: 질문과 답변 녹음을 한 번에 보낸다 (와이어프레임: 모드 + 녹음 파일 + 질문)
// audio 필드를 질문 순서대로 여러 번 붙이고, questions는 같은 순서의 JSON 문자열 배열
export async function analyzeSpeaking(req: SpeakingAnalyzeRequest): Promise<AnalyzeResponse> {
  if (USE_MOCK) {
    const result = await mockResponse();
    rememberRecordings(
      result,
      req.answers.map((answer) => answer.audio),
    );
    return result;
  }

  const form = new FormData();
  form.append("mode", "speaking");
  form.append("language", "en");
  form.append("exam", req.exam);
  form.append("questions", JSON.stringify(req.answers.map((a) => a.question)));
  req.answers.forEach((a, i) =>
    form.append("audio", a.audio, `q${i + 1}-${audioFileName(a.audio)}`),
  );
  const result = await postAnalyze(form);
  rememberRecordings(
    result,
    req.answers.map((answer) => answer.audio),
  );
  return result;
}

async function mockResponse() {
  await new Promise((r) => setTimeout(r, 1500)); // 로딩 화면 확인용
  const mock = await import("../mocks/analyze.sample.json");
  return mock.default as unknown as AnalyzeResponse;
}

async function postAnalyze(form: FormData): Promise<AnalyzeResponse> {
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
