// docs/api.md 와 동일하게 유지한다. 계약이 바뀌면 이 파일도 같이 고친다.

export type Mode = "lecture" | "language" | "interview";
export type Lang = "ko" | "en";

export type AnalyzeRequest = {
  audio: Blob;
  mode: Mode;
  language: Lang;
  keywords?: string;
  material?: File;
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
