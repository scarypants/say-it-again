import type { Line } from '../types/api';
import type { Word } from '../types/internal';

// 단어 목록을 줄로 나눈다 (LINE_GAP / PANIC_GAP / MAX_WORDS).
// PANIC_GAP 이상 쉬면 pause 줄을 넣고, 앞뒤 침묵은 무시한다.
export function splitLines(_words: Word[]): Line[] {
  throw new Error('TODO: 줄 분할');
}
