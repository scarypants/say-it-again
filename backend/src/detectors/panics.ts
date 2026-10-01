import { PANIC_TAIL_WORDS } from '../config';
import type { Highlight, Line } from '../types/api';

export type PanicSpot = {
  line: number; // pause 줄 번호 (LLM이 이 번호로 원인·대안을 돌려준다)
  highlight: Highlight;
};

/**
 * pause 줄마다 바로 앞 문장의 마지막 PANIC_TAIL_WORDS 단어를 panic 하이라이트로 만든다.
 * 앞 문장이 없는 pause 줄(첫마디 전 침묵)은 바로 뒤 문장의 처음 PANIC_TAIL_WORDS 단어를 표시한다.
 * reason / fixed는 LLM이 채운다 (LLM이 실패해도 패닉존 표시와 통계는 유지된다).
 * script의 offset은 withOffsets로 계산되어 있어야 한다.
 */
export function findPanics(script: Line[]): PanicSpot[] {
  const spots: PanicSpot[] = [];
  let prev: Line | undefined; // 단어가 있는 바로 앞 문장

  script.forEach((line, i) => {
    if (!line.pause) {
      if (line.words.length > 0) prev = line;
      return;
    }
    const pauseSec = Math.round((line.end - line.start) * 10) / 10;
    if (prev) {
      const to = prev.offset + prev.words.length - 1;
      spots.push({
        line: i,
        highlight: {
          from: Math.max(prev.offset, to - PANIC_TAIL_WORDS + 1),
          to,
          category: 'panic',
          pauseSec,
        },
      });
      return;
    }
    const next = script.slice(i + 1).find((l) => !l.pause && l.words.length > 0);
    if (!next) return;
    const to = next.offset + Math.min(next.words.length, PANIC_TAIL_WORDS) - 1;
    spots.push({ line: i, highlight: { from: next.offset, to, category: 'panic', pauseSec } });
  });

  return spots;
}
