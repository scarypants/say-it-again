import { PANIC_TAIL_WORDS } from '../config';
import type { Highlight, Line } from '../types/api';

// pause 줄마다 바로 앞 줄의 마지막 PANIC_TAIL_WORDS 단어를 panic 하이라이트로 만든다.
// reason / fixed는 LLM이 채운다 (LLM이 실패해도 패닉존 표시와 통계는 유지된다).
export function findPanics(script: Line[]): Highlight[] {
  const highlights: Highlight[] = [];
  let wordIndex = 0;
  let prev: { from: number; to: number } | undefined; // 앞 줄의 단어 번호 범위

  for (const line of script) {
    if (line.pause) {
      if (prev) {
        highlights.push({
          from: Math.max(prev.from, prev.to - PANIC_TAIL_WORDS + 1),
          to: prev.to,
          category: 'panic',
          pauseSec: Math.round((line.end - line.start) * 10) / 10,
        });
      }
      continue;
    }
    prev = { from: wordIndex, to: wordIndex + line.words.length - 1 };
    wordIndex += line.words.length;
  }

  return highlights;
}
