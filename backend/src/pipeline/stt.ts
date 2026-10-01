import type { Language } from '../types/api';
import type { Word } from '../types/internal';

// whisper로 전사해 단어별 타임스탬프와 녹음 길이(초)를 돌려준다.
// 단어가 거의 없으면 422, API 실패는 1회 재시도 후 502.
export async function transcribe(
  _file: Express.Multer.File,
  _language: Language,
): Promise<{ words: Word[]; duration: number }> {
  throw new Error('TODO: whisper 호출');
}
