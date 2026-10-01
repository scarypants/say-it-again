// 서버 튜닝 상수는 이 파일에 모은다.

// 줄 분할 (단어 사이 간격, 초)
export const LINE_GAP = 0.8;
export const PANIC_GAP = 2.0;
export const MAX_WORDS = 12;

// 업로드 제한
export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // whisper 파일 크기 제한
export const GRACE_SEC = 5; // 길이 검증 여유 시간

// 답변 1개(파일 1개)당 최대 길이(초)
export const MAX_AUDIO_SEC = {
  presentation: 5 * 60,
  opic: 2 * 60,
  'TOEIC-Speaking': 60,
} as const;

// 중복 단어: 5줄 윈도우에서 같은 어간 3회 이상
export const REPEAT_WINDOW_LINES = 5;
export const REPEAT_MIN_COUNT = 3;

// OpenAI
export const STT_MODEL = 'whisper-1';
export const LLM_MODEL = process.env.OPENAI_LLM_MODEL ?? '';
