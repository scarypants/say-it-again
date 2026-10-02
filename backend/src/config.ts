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
/** 스피킹은 답변이 30~60초로 짧아 1.5초만 멈춰도 티가 난다 */
export const SPEAKING_PANIC_GAP = 1.5;
/** 질문에 답하는 모드(스피킹·면접): 녹음 시작 후 첫마디까지 이 이상 걸리면 패닉존 (말문이 막힌 것) */
export const LEAD_PANIC_SEC = 3.0;
/**
 * 한 단어가 이보다 길면 whisper가 침묵을 단어에 붙인 것으로 보고 이 길이로 자른다.
 * (영어에서 um 같은 소리를 지우면서 그 시간을 앞뒤 단어에 붙이는 경우가 많아, 그대로 두면 멈춤이 사라진다)
 */
export const MAX_WORD_SEC = 1.5;
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

// 질문 생성 (POST /api/questions)
export const MAX_FOLLOW_UPS = 3; // 꼬리질문 최대 개수 (기본값도 이 값)
export const MAX_ANSWER_CHARS = 20_000; // 꼬리질문 재료(answers[].text) 합계 글자 수 상한
export const MAX_QUESTION_CHARS = 2_000; // answers[].question 하나의 글자 수 상한
export const MAX_ASKED = 30; // asked(이미 받은 꼬리질문) 개수 상한
export const MAX_OPIC_TOPICS = 3; // 오픽 서베이 주제 개수 상한 (프론트에서도 최대 3개)
export const OPIC_HARD_LEVEL = 5; // 오픽 자가 평가 이 단계 이상이면 롤플레이가 문제 해결형 (프론트와 같은 값)

/** 단어가 이보다 적으면 음성이 없는 것으로 본다 (422) */
export const MIN_WORDS = 3;

/** 애매한 필러(그, 이제, like 등)는 바로 뒤에 이 이상 멈칫했을 때만 필러로 본다 ("그… 저는") */
export const AMBIGUOUS_FILLER_GAP = 0.3;

/** 패닉존 하이라이트는 정지 직전 줄의 마지막 몇 단어만 표시한다 */
export const PANIC_TAIL_WORDS = 3;

// 중복 단어: 5줄 윈도우에서 같은 어간 3회 이상
export const REPEAT_WINDOW_LINES = 5;
export const REPEAT_MIN_COUNT = 3;

/**
 * 총점에서 답변 정확성(LLM)의 비중. score = habit^(1-w) × accuracy^w (가중 기하평균).
 * 기하평균이라 한쪽이 무너지면(질문과 상관없는 답 등) 다른 쪽이 좋아도 점수가 크게 떨어진다.
 * - 스피킹: 시험은 유창성(습관)과 내용이 같은 비중 → 0.5 (= √(habit × accuracy))
 * - 면접·발표 예상 질문 답변: 질문에 맞는 내용이 더 중요 → 0.7
 * - 발표: 질문이 없어 정확성을 매기지 않는다 (습관 점수만)
 */
export const ACCURACY_WEIGHT = { speaking: 0.5, interview: 0.7 } as const;

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

/** 토익 Part 2 사진 생성 모델 (docs/api.md 6절). 비어 있으면 사진 생성은 502 → 프론트가 기본 사진을 쓴다 */
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? '';
export const IMAGE_TIMEOUT_MS = 60_000;
export const IMAGE_SIZE = '1536x1024'; // 가로형
export const IMAGE_QUALITY = 'low' as const; // 속도 우선
export const MAX_SCENE_LENGTH = 1_000; // 장면 설명 글자 수 상한

/** LLM 표현 개선 하이라이트는 파트당 최대 개수 (영향도 순) */
export const MAX_EXPRESSIONS = 8;

// mock 모드: 키·네트워크 없이 backend/fixtures의 저장된 응답으로 대신한다 (시연 백업, 프론트 개발용)
export const MOCK_STT = process.env.MOCK_STT === 'true';
export const MOCK_LLM = process.env.MOCK_LLM === 'true';

/** whisper 원본 응답을 JSON으로 저장할 폴더 (샘플·mock용, 비우면 저장 안 함) */
export const STT_DUMP_DIR = process.env.STT_DUMP_DIR ?? '';
