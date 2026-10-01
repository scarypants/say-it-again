import type { Exam, Highlight, Language, Level, Mode } from './api';

// ---- 서버 내부 전용 타입 ----

export type Word = { word: string; start: number; end: number };

export type AnalyzeInput = {
  mode: Mode;
  language: Language;
  level?: Level;
  exam?: Exam;
  questions?: string[];
  audio: Express.Multer.File[];
};

// LLM이 파트 하나에 대해 돌려주는 결과 (코드가 찾은 필러·중복은 포함하지 않는다)
export type LlmPartResult = {
  highlight: Highlight[];
  final: { words: string[] }[];
  comment?: string;
};
