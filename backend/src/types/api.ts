// docs/api.md의 응답 타입과 동일하게 유지한다. 바꾸면 docs/api.md도 함께 고친다.

export type Mode = 'presentation' | 'speaking';
export type Level = 'assignment' | 'exam' | 'keynote';
export type Exam = 'TOEIC-Speaking' | 'opic';
export type Language = 'ko' | 'en';
export type Category = 'panic' | 'filler' | 'repeat' | 'expression' | 'grammar';

/** 대본의 한 줄 = 한 문장. 2초 이상 정지는 pause 줄로 따로 들어간다. */
export type Line = {
  start: number;
  end: number;
  offset: number; // 이 줄 첫 단어의 파트 전체 단어 번호 (하이라이트 from/to 기준)
  words: string[]; // pause 줄은 빈 배열
  wordTimes?: [number, number][]; // 단어별 [start, end]. 프론트는 받은 그대로 돌려보낸다
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

// ---- POST /api/transcribe 응답, POST /api/analyze 요청 ----

export type TranscriptPart = {
  duration: number;
  script: Line[];
};

export type TranscribeResponse = {
  mode: Mode;
  level?: Level;
  exam?: Exam;
  language: Language;
  parts: TranscriptPart[];
};

export type AnalyzeRequest = {
  mode: Mode;
  level?: Level;
  exam?: Exam;
  language: Language;
  questions?: string[]; // 스피킹만
  parts: TranscriptPart[]; // transcribe 응답의 parts에서 words만 고쳐서 보낸다
};

// ---- POST /api/retry ("다시, 말해" 재도전) ----

/** 이전 AnalyzeResponse에서 프론트가 그대로 복사해 보내는 요약 */
export type RetryPrevious = {
  durationSec: number; // 이전 parts[].duration의 합
  stats: Analysis['stats'];
  categoryRatio: Charts['categoryRatio'];
  topPriorities: string[];
  final: { words: string[] }[]; // 이전 parts[].final을 파트 순서대로 이어 붙인 것. 없으면 []
};

export type RetryRequest = AnalyzeRequest & { previous: RetryPrevious };

export type CompareStats = {
  score: number; // 코드 기준 점수: 100 − (panic + filler + repeat 비율)
  durationSec: number;
  wpm: number;
  fillerCount: number;
  panicCount: number;
  panicTotalSec: number;
  repeatCount: number;
  fillerPerMin: number;
  panicPerMin: number;
  repeatPerMin: number;
};

export type Compare = {
  scriptMatch: number | null; // 0~100. 이전 최종 대본 중 실제로 말한 비율. previous.final이 비었으면 null
  before: CompareStats;
  after: CompareStats;
};

export type Retry = {
  improved: string[];
  remaining: string[];
  comment: string;
};

export type RetryResponse = AnalyzeResponse & {
  compare: Compare;
  retry?: Retry;
};
