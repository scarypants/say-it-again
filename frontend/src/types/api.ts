// docs/api.md 와 동일하게 유지한다. 계약이 바뀌면 이 파일도 같이 고친다.
// 흐름: (스피킹·면접) [0] POST /api/questions로 질문 받기 → 녹음 → [1] POST /api/transcribe → 대본 검토·수정 → [2] POST /api/analyze → 결과
// 결과 화면에서: 재도전은 [3] POST /api/retry, 꼬리질문은 [0] POST /api/questions (followUp)

export type Mode = "presentation" | "speaking" | "interview"; // 발표 / 어학 스피킹 / 면접
export type Lang = "ko" | "en";

// 발표 성격: 과제 발표 / 시험 발표 / 큰 강연
export type PresentationLevel = "assignment" | "exam" | "keynote";

export type Exam = "TOEIC-Speaking" | "opic"; // 토익 스피킹 / 오픽

// 대본의 한 줄 = 한 문장. 2초(스피킹 1.5초) 이상 정지는 pause 줄로 따로 들어간다 (질문에 답하는 연습은 첫마디 전 3초 이상 침묵도)
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
  questions?: string[]; // 스피킹·면접. audio와 같은 순서·같은 개수
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
  accuracy?: number; // 스피킹·면접: 답변 정확성 0~100 (LLM). 이 파트의 LLM이 실패하면 없음
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
  score: number; // 0~100. scoreDetail이 있으면 round(habit^(1−w) × accuracy^w)
  // 스피킹·면접(발표 예상 질문 답변 포함): 말하기 습관 점수 + 파트별 정확성 평균 + 정확성 비중 w
  // (스피킹 0.5, 면접 0.7). accuracyWeight가 없는 옛 응답은 0.5로 본다
  scoreDetail?: { habit: number; accuracy: number; accuracyWeight?: number };
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
  compare?: Compare; // 재도전(/api/retry)일 때만
  retry?: Retry; // 재도전일 때만. LLM 실패 시 없음 (숫자 비교만 표시)
  warnings?: string[]; // 예: ["llm_failed"], 재도전은 "script_mismatch"도
};

// [3] "다시, 말해" 재도전 (JSON). 새 녹음의 검토한 대본 + 이전 결과 요약 (docs/api.md 5절)
export type RetryRequest = AnalyzeRequest & {
  previous: {
    durationSec: number; // 이전 parts[].duration의 합
    accuracy?: number; // 이전 scoreDetail.accuracy. 보내면 서버가 정확성까지 다시 채점해 비교한다 (스피킹·면접)
    stats: Analysis["stats"];
    categoryRatio: Charts["categoryRatio"];
    topPriorities: string[];
    final: { words: string[] }[]; // 이전 최종 대본 (파트 순서대로 이어 붙임). 없으면 []
  };
};

export type Compare = {
  scriptMatch: number | null; // 0~100. 이전 최종 대본 중 실제로 말한 비율. final이 비었으면 null
  before: CompareStats;
  after: CompareStats;
};

// 서버가 같은 기준(군말·패닉존·반복만)으로 계산한 전후 수치. 전후 비교는 이 숫자만 쓴다
export type CompareStats = {
  score: number;
  durationSec: number;
  wpm: number;
  fillerCount: number;
  panicCount: number;
  panicTotalSec: number;
  repeatCount: number;
  fillerPerMin: number; // 녹음 1분당 횟수. 길이가 달라지므로 비교는 이 값을 권장
  panicPerMin: number;
  repeatPerMin: number;
  habit?: number; // 정확성까지 비교할 때만: 말하기 습관 점수
  accuracy?: number; // 정확성까지 비교할 때만: 답변 정확성 점수
};

export type Retry = {
  improved: string[]; // 개선된 점 1~3개
  remaining: string[]; // 아직 개선할 점 1~3개
  comment: string; // 재도전 한 줄 총평
};

// AnalyzeResponse와 같은 모양 + compare(항상). expression·grammar는 0, parts[].final은 []
export type RetryResponse = AnalyzeResponse & Required<Pick<AnalyzeResponse, "compare">>;

// [0] 질문 생성 (JSON) POST /api/questions (docs/api.md 6절)
// 처음 질문(initial): 녹음 전 질문 화면에서. 면접·토익·오픽 5개, 순서 고정
// 꼬리질문(followUp): 결과 화면에서 사용자가 버튼을 눌렀을 때만. 1~3개
export type InterviewQuestionType = "intro" | "motivation" | "job" | "experience" | "closing";

export type OpicTopic = { id: string; label: string };

export type InitialQuestionsRequest =
  | { kind: "initial"; mode: "speaking"; language: "en"; exam: "TOEIC-Speaking" }
  | {
      kind: "initial";
      mode: "speaking";
      language: "en";
      exam: "opic";
      opic: { topics: OpicTopic[]; level: number }; // 서베이에서 고른 주제, 자가 평가 1~6
    }
  | { kind: "initial"; mode: "interview"; language: Lang; job: string }; // job: 1~50자

export type FollowUpQuestionsRequest = {
  kind: "followUp";
  mode: Mode;
  language: Lang;
  level?: PresentationLevel; // 발표
  exam?: Exam; // 스피킹
  job?: string; // 면접
  count?: 1 | 2 | 3; // 기본 3
  answers: { question?: string; text: string }[]; // 원래 연습의 파트마다 하나. text는 실제로 말한 대본
  asked?: string[]; // 이미 받은 꼬리질문 text (중복 방지)
};

export type Question = {
  type: string; // 처음 질문: 면접 intro… / 토익 readAloud… / 오픽 intro… · 꼬리질문: expected·respond·opinion·followUp
  text: string; // 화면에 보여 주는(토익·오픽은 TTS로 읽어 주는) 질문 한 문장
  prompt: string; // transcribe·analyze·retry의 questions[i]로 그대로 보낸다
  part?: 1 | 2 | 3 | 4 | 5; // 토익
  context?: string; // 토익 Part 1 읽을 지문, Part 3 상황
  picture?: {
    // 토익 Part 2. 사진은 POST /api/questions/image로 따로 받는다
    scene: string; // /api/questions/image에 그대로 보낸다
    prompt: string; // 생성 사진으로 출제했을 때의 questions[i]
    fallback: { id: "cafeteria"; prompt: string }; // 기본 사진으로 출제했을 때
  };
  schedule?: { title: string; rows: { time: string; session: string; speaker: string }[] }; // 토익 Part 4
  topic?: OpicTopic; // 오픽
  hint?: string; // 발표: 답변 방향 / 면접: 질문 의도 (한국어)
  about?: number; // 꼬리질문이 이어지는 답변 번호 (answers 기준, 0부터)
};

export type QuestionsResponse = {
  kind: "initial" | "followUp";
  mode: Mode;
  language: Lang;
  exam?: Exam;
  job?: string; // 면접: 공백을 정리한 직무
  questions: Question[];
  warnings?: string[]; // "llm_failed": 면접 처음 질문은 기본 질문, 나머지는 빈 목록
};

// POST /api/questions/image: 토익 Part 2 사진 1장 (10~30초). 실패하면 400·502 → 기본 사진
export type QuestionImageResponse = { image: string }; // data URL

export type ApiError = { error: string };
