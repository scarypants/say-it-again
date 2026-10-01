// docs/api.md의 응답 타입과 동일하게 유지한다. 바꾸면 docs/api.md도 함께 고친다.

export type Mode = 'presentation' | 'speaking';
export type Level = 'assignment' | 'exam' | 'keynote';
export type Exam = 'TOEIC-Speaking' | 'opic';
export type Language = 'ko' | 'en';
export type Category = 'panic' | 'filler' | 'repeat' | 'expression' | 'grammar';

export type Line = {
  start: number;
  end: number;
  words: string[];
  pause?: boolean;
};

export type Highlight = {
  from: number;
  to: number;
  category: Category;
  reason?: string;
  fixed?: string;
  pauseSec?: number;
};

export type Part = {
  comment?: string;
  duration: number;
  script: Line[];
  highlight: Highlight[];
  final: { words: string[] }[];
};

export type Charts = {
  categoryRatio: Record<Category | 'normal', number>;
  repeatTop: { word: string; count: number }[];
  fillerTop: { word: string; count: number }[];
};

export type Analysis = {
  score: number;
  stats: {
    wpm: number;
    fillerCount: number;
    panicCount: number;
    panicTotalSec: number;
    repeatCount: number;
    expressionCount: number;
    grammarCount: number;
  };
  summary: { headline: string; topPriorities: string[]; comment: string };
};

export type AnalyzeResponse = {
  mode: Mode;
  level?: Level;
  exam?: Exam;
  language: Language;
  parts: Part[];
  charts: Charts;
  analysis: Analysis;
  warnings?: string[];
};
