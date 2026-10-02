import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import OpenAI, { toFile } from 'openai';
import type { TranscriptionVerbose } from 'openai/resources/audio/transcriptions';
import { MIN_WORDS, MOCK_STT, STT_DUMP_DIR, STT_MODEL } from '../config';
import { HttpError } from '../errors';
import { MOCK_WHISPER, mockDelay, readFixture } from '../mock';
import { getOpenAI } from '../openai';
import type { Language } from '../types/api';
import type { Transcript } from '../types/internal';

/** whisper가 군말을 지우지 않고 받아 적도록 유도하는 힌트 */
const FILLER_PROMPT: Record<Language, string> = {
  ko: '음, 어, 그, 저기, 그러니까, 이제… 말하다가 멈칫하는 부분도 그대로 적어 주세요.',
  en: 'Um, uh, like, you know, so... I mean, er, hmm.',
};

/** 질문 문자열에서 whisper 힌트로 쓸 줄 (질문·직무·상황·자료). 너무 길면 앞쪽만 */
const HINT_LINE = /^(Question|Job|Situation|Information):\s*(.+)$/;
const MAX_HINT_CHARS = 400;

/**
 * whisper 힌트: 질문 내용(고유명사·전문용어를 맞게 받아 적도록) + 군말 예시.
 * whisper는 힌트의 뒤쪽을 더 많이 반영하므로 군말 예시를 맨 뒤에 둔다.
 * 토익 Part 1 지문은 넣지 않는다: 잘못 읽은 부분까지 지문대로 받아 적으면 지문 읽기 정확성이 부풀려진다.
 */
export function whisperPrompt(language: Language, question?: string): string {
  const hint = (question ?? '')
    .split('\n')
    .map((line) => HINT_LINE.exec(line.trim())?.[2]?.trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, MAX_HINT_CHARS);
  return hint ? `${hint} ${FILLER_PROMPT[language]}` : FILLER_PROMPT[language];
}

/**
 * whisper로 전사해 단어별 타임스탬프와 녹음 길이를 돌려준다. question이 있으면 힌트에 넣는다.
 * 단어가 거의 없으면 422, API 실패는 1회 재시도 후 502.
 */
export async function transcribe(
  file: Express.Multer.File,
  language: Language,
  index: number,
  question?: string,
): Promise<Transcript> {
  const label = `${index + 1}번째 녹음`;
  const prompt = whisperPrompt(language, question);
  const request = MOCK_STT ? () => mockWhisper(language) : () => requestWhisper(file, language, prompt);
  const result = await withRetry(request).catch((err: unknown) => {
    console.error(`[stt] ${label} 실패`, err);
    if (err instanceof OpenAI.BadRequestError) {
      throw new HttpError(400, `${label}의 오디오 형식을 읽을 수 없습니다. webm 또는 mp4로 녹음해 주세요.`);
    }
    throw new HttpError(502, `${label}을 전사하지 못했습니다. 잠시 후 다시 시도해 주세요.`);
  });

  await dump(result, index);

  const words = (result.words ?? [])
    .map((w) => ({ word: w.word.trim(), start: w.start, end: w.end }))
    .filter((w) => w.word.length > 0);
  if (words.length < MIN_WORDS) {
    throw new HttpError(422, `${label}에서 음성이 감지되지 않았습니다.`);
  }

  return {
    words,
    duration: result.duration,
    segmentEnds: (result.segments ?? []).map((s) => s.end),
  };
}

async function requestWhisper(file: Express.Multer.File, language: Language, prompt: string): Promise<TranscriptionVerbose> {
  return getOpenAI().audio.transcriptions.create({
    file: await toFile(file.buffer, file.originalname, { type: file.mimetype }),
    model: STT_MODEL,
    language,
    prompt,
    response_format: 'verbose_json',
    timestamp_granularities: ['word', 'segment'],
  });
}

/** mock 모드: 언어별 저장된 whisper 응답을 돌려준다 (녹음 내용과 상관없음) */
async function mockWhisper(language: Language): Promise<TranscriptionVerbose> {
  await mockDelay(800);
  return readFixture<TranscriptionVerbose>(MOCK_WHISPER[language]);
}

/** 일시적인 오류(429, 5xx, 네트워크)만 1회 재시도한다. 형식 오류 같은 4xx는 바로 실패. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof OpenAI.APIError && err.status !== undefined && err.status < 500 && err.status !== 429) {
      throw err;
    }
    return fn();
  }
}

/** STT_DUMP_DIR이 설정되어 있으면 whisper 원본 응답을 저장한다 (샘플·mock 데이터용) */
async function dump(result: TranscriptionVerbose, index: number): Promise<void> {
  if (!STT_DUMP_DIR || MOCK_STT) return;
  await mkdir(STT_DUMP_DIR, { recursive: true });
  const file = path.join(STT_DUMP_DIR, `whisper-${Date.now()}-${index + 1}.json`);
  await writeFile(file, JSON.stringify(result, null, 2));
  console.log(`[stt] 저장: ${file}`);
}
