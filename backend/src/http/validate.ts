import type { Request } from 'express';
import { MAX_FILES } from '../config';
import { HttpError } from '../errors';
import type { Exam, Level } from '../types/api';
import type { AnalyzeInput } from '../types/internal';

const LEVELS: Level[] = ['assignment', 'exam', 'keynote'];
const EXAMS: Exam[] = ['TOEIC-Speaking', 'opic'];
const AUDIO_TYPES = ['audio/webm', 'video/webm', 'audio/mp4', 'video/mp4', 'audio/x-m4a'];

// 요청을 검증하고 서비스가 쓸 AnalyzeInput으로 바꾼다. 실패하면 400.
export function parseRequest(req: Request): AnalyzeInput {
  const { mode, language, level, exam } = req.body as Record<string, string | undefined>;
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const audio = files?.audio ?? [];

  if (audio.length < 1 || audio.length > MAX_FILES) {
    throw new HttpError(400, `audio는 1~${MAX_FILES}개여야 합니다.`);
  }
  // mimetype은 "audio/webm;codecs=opus"처럼 올 수 있어서 앞부분만 비교한다.
  if (audio.some((f) => !AUDIO_TYPES.includes(f.mimetype.split(';')[0]))) {
    throw new HttpError(400, 'audio는 webm 또는 mp4만 허용합니다.');
  }

  if (mode === 'presentation') {
    if (language !== 'ko') throw new HttpError(400, '발표 모드의 language는 ko여야 합니다.');
    if (!LEVELS.includes(level as Level)) throw new HttpError(400, 'level이 올바르지 않습니다.');
    return { mode, language, level: level as Level, audio };
  }

  if (mode === 'speaking') {
    if (language !== 'en') throw new HttpError(400, '스피킹 모드의 language는 en이어야 합니다.');
    if (!EXAMS.includes(exam as Exam)) throw new HttpError(400, 'exam이 올바르지 않습니다.');
    const questions = parseQuestions(req.body.questions);
    if (questions.length !== audio.length) {
      throw new HttpError(400, 'questions와 audio의 개수가 같아야 합니다.');
    }
    return { mode, language, exam: exam as Exam, questions, audio };
  }

  throw new HttpError(400, 'mode가 올바르지 않습니다.');
}

function parseQuestions(raw: unknown): string[] {
  try {
    const value: unknown = JSON.parse(String(raw));
    if (Array.isArray(value) && value.every((q) => typeof q === 'string')) return value;
  } catch {
    // 아래에서 400으로 처리한다.
  }
  throw new HttpError(400, 'questions는 문자열 배열의 JSON이어야 합니다.');
}
