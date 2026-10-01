// 서버 튜닝 상수는 이 파일에 모은다.
import type { Category } from './types/api';

/** 기본으로 허용하는 요청 출처(Origin): 내 PC, 같은 와이파이(사설 IP), ngrok 주소 (포트 무관) */
export const DEFAULT_ORIGINS: RegExp[] = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https?:\/\/(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.ngrok(-free)?\.(app|dev|io)$/,
];

/** 추가로 허용할 출처. 쉼표로 여러 개, "https://*.example.com" 형식 가능, "*"면 모두 허용 */
export const EXTRA_ORIGINS: string[] = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

/** 문장 분할: whisper segment(문장) 끝에서 끊고, PANIC_GAP초 이상 멈추면 pause 줄을 넣는다 */
export const PANIC_GAP = 2.0;
export const MAX_WORDS = 40; // 한 문장 최대 단어 수 (whisper가 아주 긴 segment를 줄 때 대비)

// 업로드 제한
export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // whisper 파일 크기 제한
export const GRACE_SEC = 5; // 길이 검증 여유 시간

/** 답변 1개(파일 1개)당 최대 길이(초) */
export const MAX_AUDIO_SEC = {
  presentation: 5 * 60,
  opic: 2 * 60,
  'TOEIC-Speaking': 60,
  interview: 2 * 60,
} as const;

/** 면접 질문 생성: 지원 직무 글자 수 상한 (앞뒤 공백 제거 후) */
export const MAX_JOB_LENGTH = 50;

/** 단어가 이보다 적으면 음성이 없는 것으로 본다 (422) */
export const MIN_WORDS = 3;

/** 애매한 필러(그, 이제, like 등)는 바로 뒤에 이 이상 멈칫했을 때만 필러로 본다 ("그… 저는") */
export const AMBIGUOUS_FILLER_GAP = 0.3;

/** 패닉존 하이라이트는 정지 직전 줄의 마지막 몇 단어만 표시한다 */
export const PANIC_TAIL_WORDS = 3;

// 중복 단어: 5줄 윈도우에서 같은 어간 3회 이상
export const REPEAT_WINDOW_LINES = 5;
export const REPEAT_MIN_COUNT = 3;

/** 하이라이트 우선순위 (categoryRatio 계산 시 겹치면 앞쪽 하나만 센다) */
export const CATEGORY_PRIORITY: Category[] = ['panic', 'filler', 'repeat', 'expression', 'grammar'];

/** 재도전: 이전 최종 대본과의 일치율(%)이 이보다 낮으면 script_mismatch 경고 (비교는 참고용) */
export const RETRY_MATCH_LOW = 40;

/** 차트 Top N */
export const TOP_N = 10;

// OpenAI
export const STT_MODEL = 'whisper-1';
export const LLM_MODEL = process.env.OPENAI_LLM_MODEL ?? '';
export const LLM_TIMEOUT_MS = 90_000;
/** 추론 강도. 높을수록 느리고 꼼꼼하다 ('minimal' | 'low' | 'medium' | 'high') */
export const LLM_REASONING_EFFORT = 'low' as const;

/** LLM 표현 개선 하이라이트는 파트당 최대 개수 (영향도 순) */
export const MAX_EXPRESSIONS = 8;

// mock 모드: 키·네트워크 없이 backend/fixtures의 저장된 응답으로 대신한다 (시연 백업, 프론트 개발용)
export const MOCK_STT = process.env.MOCK_STT === 'true';
export const MOCK_LLM = process.env.MOCK_LLM === 'true';

/** whisper 원본 응답을 JSON으로 저장할 폴더 (샘플·mock용, 비우면 저장 안 함) */
export const STT_DUMP_DIR = process.env.STT_DUMP_DIR ?? '';
