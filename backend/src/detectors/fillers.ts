import { AMBIGUOUS_FILLER_GAP } from '../config';
import { normalize } from '../text';
import type { Highlight, Language } from '../types/api';
import type { Word } from '../types/internal';
import { FILLERS } from './fillerDict';

const REASON = '군말(필러)입니다. 빼고 말해 보세요.';

// 사전(fillerDict.ts)으로 필러를 찾는다. 단어 번호는 words 순서 = 파트 전체 단어 번호.
// - certain / patterns: 항상 필러
// - ambiguous / phrases: 바로 뒤 간격이 AMBIGUOUS_FILLER_GAP 이상이거나 마지막 단어일 때만 필러 ("그… 저는")
export function findFillers(words: Word[], language: Language): Highlight[] {
  const dict = FILLERS[language];
  const tokens = words.map((w) => normalize(w.word));
  const highlights: Highlight[] = [];

  const pausesAfter = (to: number) =>
    to === words.length - 1 || words[to + 1].start - words[to].end >= AMBIGUOUS_FILLER_GAP;
  const add = (from: number, to: number) =>
    highlights.push({ from, to, category: 'filler', reason: REASON, fixed: '' });

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    const phrase = dict.phrases.find((p) => p.every((part, k) => tokens[i + k] === part));
    if (phrase && pausesAfter(i + phrase.length - 1)) {
      add(i, i + phrase.length - 1);
      i += phrase.length - 1;
      continue;
    }

    if (dict.certain.includes(token) || dict.patterns.some((re) => re.test(token))) {
      add(i, i);
    } else if (dict.ambiguous.includes(token) && pausesAfter(i)) {
      add(i, i);
    }
  }

  return highlights;
}
