import type {
  AnalyzeRequest,
  AnalyzeResponse,
  ApiError,
  CompareStats,
  Exam,
  FollowUpQuestionsRequest,
  InitialQuestionsRequest,
  InterviewQuestionType,
  Lang,
  Mode,
  PresentationLevel,
  Question,
  QuestionImageResponse,
  QuestionsResponse,
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

// [0] 처음 질문: 녹음 전 질문 화면에서 부른다 (면접은 지원 직무, 오픽은 서베이 주제·단계로).
// 스피킹은 LLM이 실패하면 빈 목록이 오고, 화면이 가진 문항 데이터로 낸다
export async function initialQuestions(req: InitialQuestionsRequest): Promise<QuestionsResponse> {
  if (USE_MOCK) return mockInitialQuestions(req);

  return post<QuestionsResponse>("/api/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}

// 토익 Part 2 사진 생성 (10~30초). 질문을 받자마자 뒤에서 부른다. 실패하면 오류 → 기본 사진
export async function questionImage(scene: string, signal?: AbortSignal): Promise<string> {
  const res = await post<QuestionImageResponse>(
    "/api/questions/image",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scene }),
      signal,
    },
    { background: true },
  );
  return res.image;
}

// mock 처음 질문: 면접은 직무만 끼워 넣은 고정 질문, 스피킹은 LLM 실패처럼 빈 목록 (화면의 문항 데이터로 낸다)
async function mockInitialQuestions(req: InitialQuestionsRequest): Promise<QuestionsResponse> {
  await new Promise((r) => setTimeout(r, 800));
  if (req.mode === "speaking")
    return {
      kind: "initial",
      mode: "speaking",
      language: "en",
      exam: req.exam,
      questions: [],
      warnings: ["llm_failed"],
    };
  const { language, job } = req;
  const items: [InterviewQuestionType, string][] =
    language === "en"
      ? [
          ["intro", "Please introduce yourself in about one minute."],
          ["motivation", `Why do you want to work as a ${job}?`],
          ["job", `What skills make you a good fit for the ${job} role?`],
          [
            "experience",
            "Tell me about a time you had a conflict with a teammate and how you resolved it.",
          ],
          ["closing", "Is there anything else you would like to tell us?"],
        ]
      : [
          ["intro", "1분 동안 자기소개를 해 주세요."],
          ["motivation", `${job} 직무에 지원한 이유는 무엇인가요?`],
          ["job", `${job}로 일하는 데 가장 중요한 역량은 무엇이고, 본인은 어떻게 갖췄나요?`],
          ["experience", "팀 프로젝트에서 갈등이 생겼을 때 어떻게 해결했는지 말해 주세요."],
          ["closing", "마지막으로 하고 싶은 말이 있나요?"],
        ];
  const typeEn: Record<InterviewQuestionType, string> = {
    intro: "Self-introduction",
    motivation: "Motivation",
    job: "Job knowledge",
    experience: "Past experience (STAR)",
    closing: "Closing",
  };
  return {
    kind: "initial",
    mode: "interview",
    language,
    job,
    questions: items.map(([type, text], i) => ({
      type,
      text,
      prompt: `Interview Q${i + 1} (${typeEn[type]})\nJob: ${job}\nQuestion: ${text}`,
    })),
  };
}

// [0] 꼬리질문: 결과 화면에서 버튼을 누르면 실제로 말한 대본으로 질문 1~3개를 받는다 (docs/api.md 6절)
export async function followUpQuestions(req: FollowUpQuestionsRequest): Promise<QuestionsResponse> {
  const res = USE_MOCK
    ? await mockFollowUp(req)
    : await post<QuestionsResponse>("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
  // LLM 실패는 200 + 빈 목록으로 온다
  if (!res.questions.length) throw new Error("질문을 만들지 못했어요. 다시 시도해 주세요.");
  return res;
}

// mock 꼬리질문: 서버 없이 화면을 확인하려고 모드별 고정 질문을 docs/api.md 7절 머리말 형식으로 만든다.
// 다시 받으면(asked) 다음 질문부터 돌려 쓴다
async function mockFollowUp(req: FollowUpQuestionsRequest): Promise<QuestionsResponse> {
  await new Promise((r) => setTimeout(r, 900));
  const en = req.language === "en";
  const pool: Omit<Question, "prompt">[] =
    req.mode === "presentation"
      ? [
          {
            type: "expected",
            text: en
              ? "How did you collect the numbers you showed?"
              : "발표에서 말한 수치는 어떤 방법으로 조사했나요?",
            hint: "조사 기간·표본 수·측정 방법을 짧게 밝히고 한계도 인정하세요.",
          },
          {
            type: "expected",
            text: en
              ? "How much would your solution cost to put in place?"
              : "제안한 해결책을 실제로 적용하려면 비용이 얼마나 드나요?",
            hint: "정확한 금액이 없으면 비용이 드는 항목과 우선순위로 답하세요.",
          },
          {
            type: "expected",
            text: en
              ? "What would you do if the plan did not work?"
              : "계획대로 되지 않으면 어떤 대안이 있나요?",
            hint: "대안 하나를 구체적으로 말하고, 언제 바꿀지 기준을 제시하세요.",
          },
          {
            type: "expected",
            text: en
              ? "Who benefits most from this idea?"
              : "이 제안으로 가장 큰 도움을 받는 사람은 누구인가요?",
            hint: "대상을 좁혀 말하고, 그들이 얻는 변화를 숫자로 보여 주세요.",
          },
        ]
      : req.mode === "interview"
        ? [
            {
              type: "followUp",
              about: req.answers.length - 1,
              text: en
                ? "What exactly did you do yourself in that situation?"
                : "그 상황에서 본인이 직접 맡은 일은 구체적으로 무엇이었나요?",
              hint: "팀의 성과와 본인의 역할을 구분하는지 보려는 질문입니다.",
            },
            {
              type: "followUp",
              about: 0,
              text: en
                ? "Which of the strengths you mentioned is the most relevant to this job, and why?"
                : "말한 강점 중 이 직무에 가장 중요한 것 하나와 그 이유를 말해 주세요.",
              hint: "직무 이해도와 우선순위 판단을 확인하려는 질문입니다.",
            },
            {
              type: "followUp",
              about: Math.min(1, req.answers.length - 1),
              text: en
                ? "If you could redo that, what would you change?"
                : "그때로 돌아간다면 무엇을 다르게 하겠어요?",
              hint: "경험에서 배운 점을 스스로 돌아보는지 보려는 질문입니다.",
            },
            {
              type: "followUp",
              about: 0,
              text: en
                ? "How would your last team describe you?"
                : "지난 팀원들은 당신을 어떤 사람이라고 말할까요?",
              hint: "자기 객관화와 협업 태도를 확인하려는 질문입니다.",
            },
          ]
        : req.exam === "TOEIC-Speaking"
          ? [
              {
                type: "opinion",
                part: 5,
                text: "Do you agree or disagree that students should take part-time jobs while in college? Give specific reasons.",
              },
              {
                type: "respond",
                part: 3,
                context:
                  "A marketing firm is doing research in your area about weekend activities.",
                text: "Where do you usually go on weekends, and why?",
              },
              {
                type: "opinion",
                part: 5,
                text: "Which is better for learning a new skill: taking a class or teaching yourself? Explain why.",
              },
              {
                type: "respond",
                part: 3,
                context: "A friend is planning to visit your city and is asking you about it.",
                text: "What is the best way to get around your city?",
              },
            ]
          : [
              {
                type: "followUp",
                about: 1,
                topic: { id: "home", label: "사는 곳" },
                text: "You mentioned your home. How has it changed since you first moved in?",
              },
              {
                type: "followUp",
                about: 2,
                topic: { id: "home", label: "사는 곳" },
                text: "Tell me about a problem you had at home and how you solved it.",
              },
              {
                type: "followUp",
                about: 1,
                topic: { id: "home", label: "사는 곳" },
                text: "What would you like to change about your home in the future?",
              },
              {
                type: "followUp",
                about: 3,
                topic: { id: "home", label: "사는 곳" },
                text: "Who do you usually spend time with at home, and what do you do together?",
              },
            ];
  const asked = new Set(req.asked ?? []);
  const fresh = pool.filter((q) => !asked.has(q.text));
  const picked = (fresh.length ? fresh : pool).slice(0, req.count ?? 3);
  const origin = (about?: number) =>
    req.answers[about ?? 0]?.question?.match(/\bQ(\d+)\b/)?.[1] ?? String((about ?? 0) + 1);
  const questions = picked.map((q, i): Question => {
    const n = i + 1;
    const prompt =
      req.mode === "presentation"
        ? `Presentation Q&A ${n}\nQuestion: ${q.text}`
        : req.mode === "interview"
          ? `Interview Follow-up ${n} (about Q${origin(q.about)})\nJob: ${req.job ?? ""}\nQuestion: ${q.text}`
          : q.part === 3
            ? `TOEIC Speaking Part 3 (질문에 답하기)\nSituation: ${q.context}\nQuestion: ${q.text}`
            : q.part === 5
              ? `TOEIC Speaking Part 5 (의견 제시하기)\nQuestion: ${q.text}`
              : `OPIc Follow-up ${n} (topic: ${q.topic?.label ?? ""})\nQuestion: ${q.text}`;
    return { ...q, prompt };
  });
  return {
    kind: "followUp",
    mode: req.mode,
    language: req.language,
    exam: req.exam,
    job: req.job,
    questions,
  };
}

// [1] 녹음 → 문장 단위 대본. audio 필드를 녹음 순서대로 여러 번 붙인다 (서버는 붙인 순서를 파트 순서로 씀)
export async function transcribe(req: TranscribeRequest): Promise<TranscribeResponse> {
  if (USE_MOCK) {
    const sample = await mock<TranscribeResponse>(() =>
      req.mode === "speaking"
        ? import("../mocks/transcribe.speaking.sample.json")
        : import("../mocks/transcribe.sample.json"),
    );
    return { ...sample, ...echo(req), parts: fit(sample.parts, req.audio.length) };
  }

  const form = new FormData();
  form.append("mode", req.mode);
  form.append("language", req.language);
  if (req.level) form.append("level", req.level);
  if (req.exam) form.append("exam", req.exam);
  if (req.questions) form.append("questions", JSON.stringify(req.questions));
  const prefix = req.mode === "presentation" ? "part" : "q";
  const audio = await Promise.all(req.audio.map(fix3gp));
  audio.forEach((a, i) =>
    form.append("audio", a, `${prefix}${i + 1}-${audioFileName(req.audio[i])}`),
  );

  return post<TranscribeResponse>("/api/transcribe", { method: "POST", body: form });
}

// [2] 검토·수정한 대본 → 분석. 녹음 파일은 다시 보내지 않는다
export async function analyze(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  if (USE_MOCK) {
    const sample = await mock<AnalyzeResponse>(() =>
      req.mode === "speaking"
        ? import("../mocks/analyze.speaking.sample.json")
        : import("../mocks/analyze.sample.json"),
    );
    const parts = fit(sample.parts, req.parts.length).map((part, index) =>
      req.mode === "speaking" &&
      req.exam === "TOEIC-Speaking" &&
      /^TOEIC Speaking Part 1\b/.test(req.questions?.[index] ?? "")
        ? { ...part, final: [] }
        : part,
    );
    return { ...sample, ...echo(req), parts };
  }

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
    ...echo(req),
    // retry는 panic·filler·repeat만, 패닉 원인·대안 없음, final은 빈 배열
    parts: fit(res.parts, req.parts.length).map((p) => ({
      ...p,
      comment: undefined,
      final: [],
      highlight: p.highlight
        .filter((h) => h.category === "panic" || h.category === "filler" || h.category === "repeat")
        .map((h) => (h.category === "panic" ? { ...h, reason: undefined, fixed: undefined } : h)),
    })),
    charts: {
      ...res.charts,
      // 재도전은 표현 개선·문법을 보지 않으므로 그만큼 정상으로 (합 100 유지)
      categoryRatio: {
        ...res.charts.categoryRatio,
        normal:
          res.charts.categoryRatio.normal +
          res.charts.categoryRatio.expression +
          res.charts.categoryRatio.grammar,
        expression: 0,
        grammar: 0,
      },
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

// mock 응답이 요청한 모드·언어·수준·시험을 따르게 한다 (실제 서버처럼). 면접도 mock으로 끝까지 돌 수 있게
function echo(req: { mode: Mode; language: Lang; level?: PresentationLevel; exam?: Exam }) {
  return {
    mode: req.mode,
    language: req.language,
    level: req.level,
    exam: req.exam,
  };
}

// mock 파트 수를 녹음·답변 수에 맞춘다 (모자라면 예시 파트를 돌려 쓴다)
function fit<T>(parts: T[], n: number): T[] {
  return Array.from({ length: Math.max(1, n) }, (_, i) => parts[i % parts.length]);
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

// 진행 중인 요청 수. 0보다 크면 화면 전체 클릭을 막는다 (Layout). 뒤에서 도는 요청(토익 사진)은 세지 않는다
let pending = 0;
const pendingListeners = new Set<() => void>();
function setPending(delta: number) {
  pending += delta;
  pendingListeners.forEach((l) => l());
}
export function subscribePending(listener: () => void) {
  pendingListeners.add(listener);
  return () => {
    pendingListeners.delete(listener);
  };
}
export const getPending = () => pending;

async function track<T>(work: Promise<T>): Promise<T> {
  setPending(1);
  try {
    return await work;
  } finally {
    setPending(-1);
  }
}

async function post<T>(url: string, init: RequestInit, { background = false } = {}): Promise<T> {
  return background ? send<T>(url, init) : track(send<T>(url, init));
}

async function send<T>(url: string, init: RequestInit): Promise<T> {
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
