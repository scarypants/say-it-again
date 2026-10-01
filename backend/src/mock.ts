import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Language } from './types/api';

/** mock 모드에서 쓰는 저장된 응답 (backend/fixtures). src/와 dist/ 어디서 실행해도 같은 폴더를 가리킨다. */
const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures');

/** 언어별 whisper 응답 샘플 */
export const MOCK_WHISPER: Record<Language, string> = {
  ko: 'whisper-presentation-ko.json',
  en: 'whisper-speaking-en.json',
};

export async function readFixture<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(FIXTURES_DIR, file), 'utf8')) as T;
}

/** 실제 호출처럼 화면에 로딩이 보이도록 잠깐 기다린다 */
export function mockDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
