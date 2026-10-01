import type { Request } from 'express';
import { MAX_FILES } from '../config';
import { HttpError } from '../errors';
import type { Analysis, Charts, Exam, Level, Line, RetryPrevious, TranscriptPart } from '../types/api';
import type { AnalyzeInput, ModeInfo, RetryInput, TranscribeInput } from '../types/internal';

const LEVELS: Level[] = ['assignment', 'exam', 'keynote'];
const EXAMS: Exam[] = ['TOEIC-Speaking', 'opic'];
const AUDIO_TYPES = ['audio/webm', 'video/webm', 'audio/mp4', 'video/mp4', 'audio/x-m4a'];

/** POST /api/transcribe (multipart): 녹음 파일과 모드 정보를 검증한다. 실패하면 400. */
export function parseTranscribeRequest(req: Request): TranscribeInput {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const audio = files?.audio ?? [];

  if (audio.length < 1 || audio.length > MAX_FILES) {
    throw new HttpError(400, `audio는 1~${MAX_FILES}개여야 합니다.`);
  }
  // mimetype은 "audio/webm;codecs=opus"처럼 올 수 있어서 앞부분만 비교한다.
  if (audio.some((f) => !AUDIO_TYPES.includes(f.mimetype.split(';')[0]))) {
    throw new HttpError(400, 'audio는 webm 또는 mp4만 허용합니다.');
  }

  return { ...parseModeInfo(req.body ?? {}, audio.length), audio };
}

/** POST /api/analyze (JSON): transcribe 응답에서 단어만 고친 대본과 모드 정보를 검증한다. 실패하면 400. */
export function parseAnalyzeRequest(req: Request): AnalyzeInput {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const parts = parseParts(body.parts);
  return { ...parseModeInfo(body, parts.length), parts };
}

/** POST /api/retry (JSON): analyze 요청 + 이전 결과 요약(previous)을 검증한다. 실패하면 400. */
export function parseRetryRequest(req: Request): RetryInput {
  const body = (req.body ?? {}) as Record<string, unknown>;
  return { ...parseAnalyzeRequest(req), previous: parsePrevious(body.previous) };
}

const STAT_KEYS = ['wpm', 'fillerCount', 'panicCount', 'panicTotalSec', 'repeatCount', 'expressionCount', 'grammarCount'] as const;
const RATIO_KEYS = ['panic', 'filler', 'repeat', 'expression', 'grammar', 'normal'] as const;

/** 이전 AnalyzeResponse에서 복사한 값이라 숫자·배열 형식만 확인한다. */
function parsePrevious(raw: unknown): RetryPrevious {
  const p = raw as Partial<RetryPrevious> | null;
  if (!p || typeof p !== 'object') throw new HttpError(400, 'previous가 필요합니다.');
  if (typeof p.durationSec !== 'number' || p.durationSec < 0) {
    throw new HttpError(400, 'previous.durationSec가 올바르지 않습니다.');
  }
  const stats = pickNumbers(p.stats, STAT_KEYS, 'previous.stats') as Analysis['stats'];
  const categoryRatio = pickNumbers(p.categoryRatio, RATIO_KEYS, 'previous.categoryRatio') as Charts['categoryRatio'];
  if (!Array.isArray(p.topPriorities) || !p.topPriorities.every((t) => typeof t === 'string')) {
    throw new HttpError(400, 'previous.topPriorities는 문자열 배열이어야 합니다.');
  }
  if (!Array.isArray(p.final)) throw new HttpError(400, 'previous.final은 배열이어야 합니다.');
  const final = p.final.map((sentence: unknown) => {
    const words = (sentence as { words?: unknown } | null)?.words;
    if (!Array.isArray(words) || !words.every((w) => typeof w === 'string')) {
      throw new HttpError(400, 'previous.final의 words는 문자열 배열이어야 합니다.');
    }
    return { words };
  });
  return { durationSec: p.durationSec, stats, categoryRatio, topPriorities: p.topPriorities, final };
}

function pickNumbers<K extends string>(raw: unknown, keys: readonly K[], name: string): Record<K, number> {
  const obj = raw as Record<string, unknown> | null;
  if (!obj || typeof obj !== 'object' || keys.some((k) => typeof obj[k] !== 'number')) {
    throw new HttpError(400, `${name}에 ${keys.join('·')} 숫자가 필요합니다.`);
  }
  return Object.fromEntries(keys.map((k) => [k, obj[k]])) as Record<K, number>;
}

/** 세 API 공통: mode·language·level·exam·questions 조합 검증. count = 녹음(파트) 수 */
function parseModeInfo(body: Record<string, unknown>, count: number): ModeInfo {
  const { mode, language, level, exam } = body;

  if (mode === 'presentation') {
    if (language !== 'ko' && language !== 'en') {
      throw new HttpError(400, '발표 모드의 language는 ko 또는 en이어야 합니다.');
    }
    if (!LEVELS.includes(level as Level)) throw new HttpError(400, 'level이 올바르지 않습니다.');
    return { mode, language, level: level as Level };
  }

  if (mode === 'speaking') {
    if (language !== 'en') throw new HttpError(400, '스피킹 모드의 language는 en이어야 합니다.');
    if (!EXAMS.includes(exam as Exam)) throw new HttpError(400, 'exam이 올바르지 않습니다.');
    const questions = parseQuestions(body.questions);
    if (questions.length !== count) {
      throw new HttpError(400, '질문 수와 녹음(파트) 수가 같아야 합니다.');
    }
    return { mode, language, exam: exam as Exam, questions };
  }

  throw new HttpError(400, 'mode가 올바르지 않습니다.');
}

/** multipart에서는 JSON 문자열, JSON 요청에서는 배열로 온다. */
function parseQuestions(raw: unknown): string[] {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      // 아래에서 400으로 처리한다.
    }
  }
  if (Array.isArray(value) && value.every((q) => typeof q === 'string')) return value;
  throw new HttpError(400, 'questions는 문자열 배열이어야 합니다.');
}

function parseParts(raw: unknown): TranscriptPart[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_FILES) {
    throw new HttpError(400, `parts는 1~${MAX_FILES}개여야 합니다.`);
  }
  return raw.map((part: unknown, i) => {
    const p = part as Partial<TranscriptPart> | null;
    if (!p || typeof p.duration !== 'number' || !Array.isArray(p.script)) {
      throw new HttpError(400, `${i + 1}번째 파트의 duration·script가 올바르지 않습니다.`);
    }
    return { duration: p.duration, script: p.script.map((line, j) => parseLine(line, i, j)) };
  });
}

function parseLine(raw: unknown, partIndex: number, lineIndex: number): Line {
  const l = raw as Partial<Line> | null;
  const where = `${partIndex + 1}번째 파트 ${lineIndex + 1}번째 줄`;
  if (!l || typeof l.start !== 'number' || typeof l.end !== 'number' || l.end < l.start || !Array.isArray(l.words)) {
    throw new HttpError(400, `${where}이 올바르지 않습니다.`);
  }
  if (l.pause) return { start: l.start, end: l.end, offset: 0, words: [], pause: true };

  // 사용자가 한 칸에 여러 단어를 적었을 수 있어 공백으로 다시 나눈다.
  const words = l.words
    .filter((w): w is string => typeof w === 'string')
    .flatMap((w) => w.trim().split(/\s+/))
    .filter((w) => w.length > 0);
  const wordTimes = isWordTimes(l.wordTimes) && l.wordTimes.length === words.length ? l.wordTimes : undefined;
  return { start: l.start, end: l.end, offset: 0, words, ...(wordTimes && { wordTimes }) };
}

function isWordTimes(value: unknown): value is [number, number][] {
  return (
    Array.isArray(value) &&
    value.every((t) => Array.isArray(t) && t.length === 2 && typeof t[0] === 'number' && typeof t[1] === 'number')
  );
}
