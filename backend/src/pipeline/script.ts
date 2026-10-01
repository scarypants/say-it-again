import { LINE_GAP, MAX_WORDS, PANIC_GAP } from '../config';
import type { Line } from '../types/api';
import type { Word } from '../types/internal';

// 단어 목록을 줄로 나눈다.
// - 간격 < LINE_GAP: 같은 줄 / LINE_GAP 이상: 줄바꿈 / PANIC_GAP 이상: 줄바꿈 + pause 줄
// - 문장부호(. ? !) 뒤, whisper segment 끝, 한 줄 MAX_WORDS 초과 시에도 줄바꿈
// - 녹음 맨 앞·뒤 침묵은 단어가 없으므로 자연히 무시된다
export function splitLines(words: Word[], segmentEnds: number[] = []): Line[] {
  const lines: Line[] = [];
  const segmentEndSet = new Set(segmentEnds.map((t) => t.toFixed(2)));
  let current: Word[] = [];

  const flush = () => {
    if (current.length === 0) return;
    lines.push({
      start: current[0].start,
      end: current[current.length - 1].end,
      words: current.map((w) => w.word),
    });
    current = [];
  };

  words.forEach((word, i) => {
    const prev = words[i - 1];
    if (prev) {
      const gap = word.start - prev.end;
      if (gap >= PANIC_GAP) {
        flush();
        lines.push({ start: prev.end, end: word.start, words: [], pause: true });
      } else if (gap >= LINE_GAP || endsSentence(prev, segmentEndSet) || current.length >= MAX_WORDS) {
        flush();
      }
    }
    current.push(word);
  });
  flush();

  return lines;
}

function endsSentence(word: Word, segmentEnds: Set<string>): boolean {
  return /[.?!。？！]$/.test(word.word) || segmentEnds.has(word.end.toFixed(2));
}

// script의 단어를 파트 전체 단어 번호 순서로 펼친다 (pause 줄은 단어가 없어 건너뛴다)
export function flattenWords(script: Line[]): string[] {
  return script.flatMap((line) => line.words);
}
