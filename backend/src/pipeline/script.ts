import { MAX_WORD_SEC, MAX_WORDS, PANIC_GAP } from '../config';
import type { Line } from '../types/api';
import type { Word } from '../types/internal';

/**
 * 단어 목록을 문장 단위 줄로 나눈다.
 * - 문장 끝(whisper segment 끝, 문장부호 . ? !)에서 끊는다
 * - rule.gap초(기본 PANIC_GAP) 이상 멈추면 문장 중간이라도 끊고 pause 줄을 넣는다
 * - rule.lead가 있으면 첫 단어 전 침묵이 그 이상일 때 맨 앞에 pause 줄을 넣는다 (질문을 듣고 말문이 막힌 것)
 * - 한 문장이 MAX_WORDS를 넘으면 끊는다
 * - 녹음 맨 뒤 침묵은 무시한다
 * - 멈춤을 재기 전에 MAX_WORD_SEC보다 긴 단어를 자른다 (clipLongWords)
 */
export function splitSentences(
  rawWords: Word[],
  segmentEnds: number[] = [],
  rule: { gap: number; lead?: number } = { gap: PANIC_GAP },
): Line[] {
  const lines: Line[] = [];
  const segmentEndSet = new Set(segmentEnds.map((t) => t.toFixed(2)));
  const sentenceEnds = rawWords.map((w) => endsSentence(w, segmentEndSet)); // 자르기 전 시간으로 판단
  const words = clipLongWords(rawWords, sentenceEnds);
  let current: Word[] = [];

  if (rule.lead !== undefined && words.length > 0 && words[0].start >= rule.lead) {
    lines.push({ start: 0, end: words[0].start, offset: 0, words: [], pause: true });
  }

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
      if (word.start - prev.end >= rule.gap) {
        flush();
        lines.push({ start: prev.end, end: word.start, offset: 0, words: [], pause: true });
      } else if (sentenceEnds[i - 1] || current.length >= MAX_WORDS) {
        flush();
      }
    }
    current.push(word);
  });
  flush();

  return withOffsets(lines);
}

/**
 * MAX_WORD_SEC보다 긴 단어를 그 길이로 자른다. 침묵이 어느 쪽에 붙었는지는 위치로 짐작한다:
 * 녹음 첫 단어이거나 앞 단어가 문장 끝이면 앞쪽 침묵(시작을 늦춘다), 아니면 뒤쪽 침묵(끝을 당긴다).
 */
function clipLongWords(words: Word[], sentenceEnds: boolean[]): Word[] {
  return words.map((w, i) => {
    if (w.end - w.start <= MAX_WORD_SEC) return w;
    return i === 0 || sentenceEnds[i - 1]
      ? { ...w, start: w.end - MAX_WORD_SEC }
      : { ...w, end: w.start + MAX_WORD_SEC };
  });
}

function endsSentence(word: Word, segmentEnds: Set<string>): boolean {
  return /[.?!。？！]$/.test(word.word) || segmentEnds.has(word.end.toFixed(2));
}

/**
 * 각 줄의 offset(첫 단어의 파트 전체 단어 번호)을 다시 계산한다.
 * 사용자가 단어를 고치면 단어 수가 바뀔 수 있어서 analyze에서도 다시 계산한다.
 */
export function withOffsets(script: Line[]): Line[] {
  let offset = 0;
  return script.map((line) => {
    const next = { ...line, offset };
    offset += line.words.length;
    return next;
  });
}

/**
 * 대본을 단어별 시간이 있는 목록으로 펼친다.
 * wordTimes가 단어 수와 맞으면 그대로 쓰고, 고친 문장처럼 맞지 않으면 줄 시간을 단어 수로 균등하게 나눠 추정한다.
 */
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

/** script의 단어를 파트 전체 단어 번호 순서로 펼친다 (pause 줄은 단어가 없어 건너뛴다) */
export function flattenWords(script: Line[]): string[] {
  return script.flatMap((line) => line.words);
}
