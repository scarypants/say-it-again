// docs/api.md 와 동일하게 유지한다. 계약이 바뀌면 이 파일도 같이 고친다.
// 흐름: 녹음 → [1] POST /api/transcribe → 대본 검토·수정 → [2] POST /api/analyze → 결과

export type Mode = "presentation" | "speaking"; // 발표 / 어학 스피킹
export type Lang = "ko" | "en";

// 발표 성격: 과제 발표 / 시험 발표 / 큰 강연
export type PresentationLevel = "assignment" | "exam" | "keynote";

export type Exam = "TOEIC-Speaking" | "opic"; // 토익 스피킹 / 오픽

// 대본의 한 줄 = 한 문장. 2초 이상 정지는 pause 줄로 따로 들어간다
export type Line = {
  start: number; // 초
  end: number;
  offset: number; // 이 줄 첫 단어의 파트 전체 단어 번호 (하이라이트 from/to 기준)
  words: string[]; // pause 줄은 빈 배열
  wordTimes?: [number, number][]; // 단어별 [start, end]. 받은 그대로 돌려보낸다
  pause?: boolean; // true면 패닉존 (길이 = end - start)
};

export type ScriptPart = { duration: number; script: Line[] };

// [1] transcribe 요청 (multipart). 프론트에선 객체로 들고 client.ts가 폼으로 바꾼다
export type TranscribeRequest = {
  mode: Mode;
  language: Lang;
  audio: Blob[]; // 녹음 순서대로. 발표는 5분 단위 파일, 스피킹은 질문별 답변. 1~5개
  level?: PresentationLevel; // 발표만
  exam?: Exam; // 스피킹만
  questions?: string[]; // 스피킹만. audio와 같은 순서·같은 개수
};

export type TranscribeResponse = {
  mode: Mode;
  level?: PresentationLevel;
  exam?: Exam;
  language: Lang;
  parts: ScriptPart[]; // 녹음 파일 하나당 하나
};

// [2] analyze 요청 (JSON). transcribe 응답의 parts에서 words만 고쳐서 보낸다
export type AnalyzeRequest = {
  mode: Mode;
  level?: PresentationLevel;
  exam?: Exam;
  language: Lang;
  questions?: string[]; // 스피킹. 배열 그대로
  parts: ScriptPart[];
};

export type HighlightCategory = "panic" | "filler" | "repeat" | "expression" | "grammar";

export type Highlight = {
  from: number; // 파트 전체 단어 번호 (pause 줄 제외, 0부터) = line.offset + 줄 안 번호
  to: number; // 포함
  category: HighlightCategory;
  reason?: string;
  fixed?: string; // 개선된 표현. 삭제 권장이면 빈 문자열
  pauseSec?: number; // panic일 때 정지 시간(초)
};

export type Part = {
  comment?: string; // 파트별 한 줄 코멘트. 스피킹에만 있다
  duration: number; // 초
  script: Line[]; // 고친 대본 (offset 다시 계산됨)
  highlight: Highlight[];
  final: { words: string[] }[]; // 문장 단위 최종 대본. 빈 배열이면 없음 (토익 Part 1)
};

export type Charts = {
  categoryRatio: Record<HighlightCategory | "normal", number>;
  repeatTop: { word: string; count: number }[];
  fillerTop: { word: string; count: number }[];
};

export type Analysis = {
  score: number; // 0~100
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
  level?: PresentationLevel;
  exam?: Exam;
  language: Lang;
  parts: Part[]; // 요청 parts와 같은 순서
  charts: Charts;
  analysis: Analysis;
  warnings?: string[]; // 예: ["llm_failed"]
};

export type ApiError = { error: string };
