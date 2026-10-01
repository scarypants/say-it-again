import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { toFile } from 'openai';
import type { TranscriptionVerbose } from 'openai/resources/audio/transcriptions';
import { MIN_WORDS, STT_DUMP_DIR, STT_MODEL } from '../config';
import { HttpError } from '../errors';
import { getOpenAI } from '../openai';
import type { Language } from '../types/api';
import type { Transcript } from '../types/internal';

// whisper가 군말을 지우지 않고 받아 적도록 유도하는 힌트
const FILLER_PROMPT: Record<Language, string> = {
  ko: '음, 어, 그, 저기, 그러니까, 이제… 말하다가 멈칫하는 부분도 그대로 적어 주세요.',
  en: 'Um, uh, like, you know, so... I mean, er, hmm.',
};

// whisper로 전사해 단어별 타임스탬프와 녹음 길이를 돌려준다.
// 단어가 거의 없으면 422, API 실패는 1회 재시도 후 502.
export async function transcribe(
  file: Express.Multer.File,
  language: Language,
  index: number,
): Promise<Transcript> {
  const label = `${index + 1}번째 녹음`;
  const result = await withRetry(() => requestWhisper(file, language)).catch((err: unknown) => {
    console.error(`[stt] ${label} 실패`, err);
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

async function requestWhisper(file: Express.Multer.File, language: Language): Promise<TranscriptionVerbose> {
  return getOpenAI().audio.transcriptions.create({
    file: await toFile(file.buffer, file.originalname, { type: file.mimetype }),
    model: STT_MODEL,
    language,
    prompt: FILLER_PROMPT[language],
    response_format: 'verbose_json',
    timestamp_granularities: ['word', 'segment'],
  });
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return fn();
  }
}

// STT_DUMP_DIR이 설정되어 있으면 whisper 원본 응답을 저장한다 (샘플·mock 데이터용)
async function dump(result: TranscriptionVerbose, index: number): Promise<void> {
  if (!STT_DUMP_DIR) return;
  await mkdir(STT_DUMP_DIR, { recursive: true });
  const file = path.join(STT_DUMP_DIR, `whisper-${Date.now()}-${index + 1}.json`);
  await writeFile(file, JSON.stringify(result, null, 2));
  console.log(`[stt] 저장: ${file}`);
}
