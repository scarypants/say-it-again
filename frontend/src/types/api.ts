// docs/api.md 와 동일하게 유지한다. 계약이 바뀌면 이 파일도 같이 고친다.

export type Mode = "presentation" | "speaking" | "interview"; // 발표 / 어학 스피킹 / 면접(예정)
export type Lang = "ko" | "en";

export type AnalyzeRequest = {
  audio: Blob[]; // 녹음 순서대로. 파일 하나당 최대 5분, 최대 5개
  mode: Mode;
  language: Lang;
  level?: PresentationLevel; // 발표 모드에서만
};

// 발표 수준: 과제 발표 / 시험 발표 / 큰 강연
export type PresentationLevel = "assignment" | "exam" | "keynote";

export type Exam = "TOEIC-Speaking" | "opic"; // 토익 스피킹 / 오픽

// 어학 스피킹 분석 요청: 질문과 답변 녹음을 같은 순서로 한 번에
export type SpeakingAnalyzeRequest = {
  exam: Exam;
  answers: { question: string; audio: Blob }[];
};

export type Line = {
  start: number;
  end: number;
  words: string[]; // pause 줄은 빈 배열
  pause?: boolean; // true면 패닉존 (길이 = end - start)
};

export type HighlightType = "vague" | "register" | "wrongWord" | "grammar";

// [시작단어idx, 끝단어idx, 이유, 개선된 표현, 유형]
export type HighlightItem = [number, number, string, string, HighlightType];

export type PanicInfo = { reason: string; altScript: string };

export type Stats = {
  wpm: number;
  fillerCount: number;
  panicCount: number;
  panicTotalSec: number;
  score: number;
};

export type Summary = {
  headline: string;
  topPriorities: string[];
  modeComment: string;
};

export type AnalyzeResponse = {
  duration: number;
  lines: Line[];
  fillers: Record<number, number[]>;
  repeats: Record<number, number[]>;
  panic: Record<number, PanicInfo>;
  highlight: Record<number, HighlightItem[]>;
  stats: Stats;
  fillerTop: { word: string; count: number }[];
  summary: Summary;
};

export type ApiError = { error: string };
