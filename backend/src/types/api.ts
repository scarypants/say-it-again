// docs/api.md의 응답 타입과 동일하게 유지한다. 바꾸면 docs/api.md도 함께 고친다.

export type Mode = 'presentation' | 'speaking' | 'interview';
export type Level = 'assignment' | 'exam' | 'keynote';
export type Exam = 'TOEIC-Speaking' | 'opic';
export type Language = 'ko' | 'en';
export type Category = 'panic' | 'filler' | 'repeat' | 'expression' | 'grammar';

/** 대본의 한 줄 = 한 문장. 2초(스피킹 1.5초) 이상 정지는 pause 줄로 따로 들어간다. */
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
  accuracy?: number; // 스피킹·면접·발표 예상 질문 답변만: 답변 정확성 0~100 (LLM, 토익 Part 1은 지문 일치율)
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
  score: number; // scoreDetail이 있으면 round(habit^(1-w) × accuracy^w) (w = accuracyWeight), 없으면 habit
  /** 스피킹·면접(발표 예상 질문 답변 포함)만. 프론트는 이 값으로 점수 산출 방식을 설명한다 */
  scoreDetail?: { habit: number; accuracy: number; accuracyWeight: number };
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
  questions?: string[]; // 스피킹·면접, 발표 예상 질문 답변
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
  accuracy?: number; // 이전 analysis.scoreDetail.accuracy (스피킹·면접·발표 질의응답). 보내면 정확성까지 비교한다
};

export type RetryRequest = AnalyzeRequest & { previous: RetryPrevious };

export type CompareStats = {
  score: number; // habit/accuracy가 있으면 analyze와 같은 공식의 총점, 없으면 습관 점수
  habit?: number; // 정확성까지 비교할 때만: 습관 점수 (100 − panic − filler − repeat)
  accuracy?: number; // 정확성까지 비교할 때만: 답변 정확성 (before = previous.accuracy, after = 새로 채점)
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

// ---- POST /api/questions (질문 생성: 처음 질문 · 꼬리질문) ----

/** 면접 처음 질문 5개 = 유형 5개, 이 순서로 하나씩 */
export type InterviewQuestionType = 'intro' | 'motivation' | 'job' | 'experience' | 'closing';

export type QuestionKind = 'initial' | 'followUp';

export type QuestionType =
  | InterviewQuestionType // 면접 처음 질문
  | 'readAloud' | 'describePicture' | 'respond' | 'information' | 'opinion' // 토익
  | 'description' | 'routine' | 'rolePlayAsk' | 'rolePlaySolve' // 오픽 (intro·experience는 면접과 이름이 같다)
  | 'expected' // 발표 예상 질문
  | 'followUp'; // 오픽·면접 꼬리질문

export type ToeicSchedule = { title: string; rows: { time: string; session: string; speaker: string }[] };

export type OpicTopic = { id: string; label: string };

export type Question = {
  type: QuestionType;
  text: string; // 화면에 보여 주는(토익·오픽은 TTS로 읽어 주는) 질문
  prompt: string; // transcribe·analyze·retry의 questions[i]로 그대로 보내는 문자열
  part?: 1 | 2 | 3 | 4 | 5; // 토익
  context?: string; // 토익 Part 1 지문, Part 3 상황
  picture?: {
    scene: string; // /api/questions/image에 보낼 장면 설명
    prompt: string; // 생성 사진으로 출제했을 때의 questions[i]
    fallback: { id: 'cafeteria'; prompt: string }; // 기본 사진으로 출제했을 때
  };
  schedule?: ToeicSchedule; // 토익 Part 4
  topic?: OpicTopic; // 오픽 처음 질문
  hint?: string; // 발표: 답변 방향 / 면접: 질문 의도
  about?: number; // 꼬리질문이 이어지는 답변 번호 (answers 기준, 0부터)
};

export type InitialQuestionsRequest =
  | { kind: 'initial'; mode: 'speaking'; language: 'en'; exam: 'TOEIC-Speaking' }
  | { kind: 'initial'; mode: 'speaking'; language: 'en'; exam: 'opic'; opic: { topics: OpicTopic[]; level: number } }
  | { kind: 'initial'; mode: 'interview'; language: Language; job: string };

export type FollowUpQuestionsRequest = {
  kind: 'followUp';
  mode: Mode;
  language: Language;
  level?: Level; // 발표
  exam?: Exam; // 스피킹
  job?: string; // 면접
  count: 1 | 2 | 3; // 받을 꼬리질문 개수 (요청에서 빠지면 3)
  answers: { question?: string; text: string }[]; // 꼬리질문을 만들 재료: 녹음(파트)마다 실제로 말한 대본
  asked: string[]; // 이미 받은 꼬리질문 (중복 방지)
};

export type QuestionsRequest = InitialQuestionsRequest | FollowUpQuestionsRequest;

export type QuestionsResponse = {
  kind: QuestionKind;
  mode: Mode;
  language: Language;
  exam?: Exam;
  job?: string;
  questions: Question[];
  warnings?: string[];
};

// ---- POST /api/questions/image (토익 Part 2 사진) ----

export type QuestionImageRequest = { scene: string };

export type QuestionImageResponse = { image: string }; // data URL
