import { GRACE_SEC, MAX_AUDIO_SEC } from '../config';
import { HttpError } from '../errors';
import { panicRule } from '../modes';
import type { TranscribeResponse } from '../types/api';
import type { ModeInfo, TranscribeInput } from '../types/internal';
import { splitSentences } from './script';
import { transcribe } from './stt';

/** 1단계: 녹음마다 병렬 STT → 문장 단위 대본. 사용자가 이 대본의 전사 오류를 고친 뒤 analyze를 부른다. */
export async function transcribeAll(input: TranscribeInput): Promise<TranscribeResponse> {
  const transcripts = await Promise.all(input.audio.map((file, i) => transcribe(file, input.language, i, input.questions?.[i])));
  checkDurations(input, transcripts.map((t) => t.duration));

  return {
    mode: input.mode,
    level: input.level,
    exam: input.exam,
    language: input.language,
    parts: transcripts.map((t) => ({ duration: t.duration, script: splitSentences(t.words, t.segmentEnds, panicRule(input)) })),
  };
}

/** 녹음 길이 확인 (+GRACE_SEC 여유). transcribe는 whisper duration, analyze는 보내온 duration 기준. */
export function checkDurations(info: ModeInfo, durations: number[]): void {
  const limit =
    info.mode === 'interview'
      ? MAX_AUDIO_SEC.interview
      : info.mode === 'speaking' && info.exam
        ? MAX_AUDIO_SEC[info.exam]
        : MAX_AUDIO_SEC.presentation;
  durations.forEach((duration, i) => {
    if (duration > limit + GRACE_SEC) {
      throw new HttpError(400, `${i + 1}번째 녹음이 너무 깁니다 (최대 ${limit}초).`);
    }
  });
}
