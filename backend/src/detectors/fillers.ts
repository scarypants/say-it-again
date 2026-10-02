import { AMBIGUOUS_FILLER_GAP } from '../config';
import { normalize } from '../text';
import type { Highlight, Language } from '../types/api';
import type { Word } from '../types/internal';
import { FILLERS } from './fillerDict';

const REASON = '군말입니다. 빼고 말해 보세요.';

const endsSentence = (word: string) => /[.?!。？！]["')\]]*$/.test(word.trim());

/**
 * 사전(fillerDict.ts)으로 필러를 찾는다. 단어 번호는 words 순서 = 파트 전체 단어 번호.
 * - certain / patterns: 항상 필러
 * - ambiguous / phrases: 바로 뒤 간격이 AMBIGUOUS_FILLER_GAP 이상이거나 마지막 단어일 때,
 *   또는 바로 앞 단어가 필러일 때만 필러 ("그… 저는", "그러니까 그")
 * - ambiguous를 바로 되풀이하면 말 더듬기라 간격과 상관없이 필러 ("그 그 그 학교는")
 * - 단, 문장부호(. ? !)로 끝나는 ambiguous는 문장의 일부라 필러가 아니다 ("I think so.", "That's right.")
 */
export function findFillers(words: Word[], language: Language): Highlight[] {
  const dict = FILLERS[language];
  const tokens = words.map((w) => normalize(w.word));
  const highlights: Highlight[] = [];

  const pausesAfter = (to: number) =>
    to === words.length - 1 || words[to + 1].start - words[to].end >= AMBIGUOUS_FILLER_GAP;
  const afterFiller = (i: number) => highlights.at(-1)?.to === i - 1;
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
    } else if (
      dict.ambiguous.includes(token) &&
      !endsSentence(words[i].word) &&
      (pausesAfter(i) || afterFiller(i) || tokens[i + 1] === token)
    ) {
      add(i, i);
    }
  }

  return highlights;
}
