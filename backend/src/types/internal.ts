import type { Exam, Highlight, InterviewQuestionType, Language, Level, Mode, RetryPrevious, TranscriptPart } from './api';

// ---- 서버 내부 전용 타입 ----

export type Word = { word: string; start: number; end: number };

/** 두 API 공통 요청 정보 */
export type ModeInfo = {
  mode: Mode;
  language: Language;
  level?: Level;
  exam?: Exam;
  questions?: string[];
};

export type TranscribeInput = ModeInfo & { audio: Express.Multer.File[] };

export type AnalyzeInput = ModeInfo & { parts: TranscriptPart[] };

export type RetryInput = AnalyzeInput & { previous: RetryPrevious };

/** LLM이 파트 하나에 대해 돌려주는 결과 (코드가 찾은 필러·중복은 포함하지 않는다) */
export type LlmPartResult = {
  highlight: Highlight[]; // expression / grammar
  panicNotes: Map<number, { reason: string; fixed: string }>; // pause 줄 번호 → 원인·대안
  final: { words: string[] }[];
  comment?: string;
};

/** STT 결과 */
export type Transcript = {
  words: Word[];
  duration: number;
  segmentEnds: number[]; // whisper segment(대략 문장) 끝 시각
};

/** 면접 처음 질문 생성 (POST /api/questions의 면접 initial이 쓴다) */
export type InterviewQuestionsInput = { language: Language; job: string };

export type InterviewQuestionsResult = {
  language: Language;
  job: string;
  questions: { type: InterviewQuestionType; text: string }[]; // 항상 5개: intro → motivation → job → experience → closing
  warnings?: string[]; // LLM 실패 시 ["llm_failed"] + 기본 질문
};
