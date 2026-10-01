import { MAX_WORDS, PANIC_GAP } from '../config';
import type { Line } from '../types/api';
import type { Word } from '../types/internal';

// 단어 목록을 문장 단위 줄로 나눈다.
// - 문장 끝(whisper segment 끝, 문장부호 . ? !)에서 끊는다
// - PANIC_GAP초 이상 멈추면 문장 중간이라도 끊고 pause 줄을 넣는다
// - 한 문장이 MAX_WORDS를 넘으면 끊는다
// - 녹음 맨 앞·뒤 침묵은 단어가 없으므로 자연히 무시된다
export function splitSentences(words: Word[], segmentEnds: number[] = []): Line[] {
  const lines: Line[] = [];
  const segmentEndSet = new Set(segmentEnds.map((t) => t.toFixed(2)));
  let current: Word[] = [];

  const flush = () => {
    if (current.length === 0) return;
    lines.push({
      start: current[0].start,
      end: current[current.length - 1].end,
      offset: 0,
      words: current.map((w) => w.word),
      wordTimes: current.map((w) => [w.start, w.end]),
    });
    current = [];
  };

  words.forEach((word, i) => {
    const prev = words[i - 1];
    if (prev) {
      if (word.start - prev.end >= PANIC_GAP) {
        flush();
        lines.push({ start: prev.end, end: word.start, offset: 0, words: [], pause: true });
      } else if (endsSentence(prev, segmentEndSet) || current.length >= MAX_WORDS) {
        flush();
      }
    }
    current.push(word);
  });
  flush();

  return withOffsets(lines);
}

function endsSentence(word: Word, segmentEnds: Set<string>): boolean {
  return /[.?!。？！]$/.test(word.word) || segmentEnds.has(word.end.toFixed(2));
}

// 각 줄의 offset(첫 단어의 파트 전체 단어 번호)을 다시 계산한다.
// 사용자가 단어를 고치면 단어 수가 바뀔 수 있어서 analyze에서도 다시 계산한다.
export function withOffsets(script: Line[]): Line[] {
  let offset = 0;
  return script.map((line) => {
    const next = { ...line, offset };
    offset += line.words.length;
    return next;
  });
}

// 대본을 단어별 시간이 있는 목록으로 펼친다.
// wordTimes가 단어 수와 맞으면 그대로 쓰고, 고친 문장처럼 맞지 않으면 줄 시간을 단어 수로 균등하게 나눠 추정한다.
export function toWords(script: Line[]): Word[] {
  return script.flatMap((line) => {
    const { words, wordTimes, start, end } = line;
    if (wordTimes && wordTimes.length === words.length) {
      return words.map((word, i) => ({ word, start: wordTimes[i][0], end: wordTimes[i][1] }));
    }
    const step = words.length > 0 ? (end - start) / words.length : 0;
    return words.map((word, i) => ({ word, start: start + step * i, end: start + step * (i + 1) }));
  });
}

// script의 단어를 파트 전체 단어 번호 순서로 펼친다 (pause 줄은 단어가 없어 건너뛴다)
export function flattenWords(script: Line[]): string[] {
  return script.flatMap((line) => line.words);
}
