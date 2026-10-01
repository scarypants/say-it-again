import { REPEAT_MIN_COUNT, REPEAT_WINDOW_LINES } from '../config';
import { normalize, stem } from '../text';
import type { Highlight, Language, Line } from '../types/api';
import { FILLERS } from './fillerDict';

/** 원래 자주 쓰는 말이라 반복으로 보지 않는 단어 (정규화·어간 기준) */
const STOPWORDS: Record<Language, Set<string>> = {
  ko: new Set([
    '저', '제', '저희', '우리', '것', '수', '등', '때', '더', '잘', '안', '못', '또', '또한', '그리고', '이런', '그런',
    '있습니다', '합니다', '입니다', '됩니다', '했습니다', '있는', '하는', '되는', '같은', '같습니다', '겁니다',
    '것입니다', '있고', '하고', '해서', '하면', '있다', '한다', '이다', '그것', '이것',
  ]),
  en: new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'so', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'is', 'are', 'was', 'were',
    'be', 'been', 'i', 'you', 'it', 'its', "it's", 'that', 'this', 'my', 'we', 'our', 'they', 'he', 'she', 'do', 'does',
    'have', 'has', 'not', 'can', 'will', 'would', 'there', 'as', 'by', 'from', 'me', 'what', 'if', 'about', "i'm",
  ]),
};

/**
 * 중복 단어를 찾는다. 단어 번호는 파트 전체 번호(line.offset 기준)이고, script의 offset이 계산되어 있어야 한다.
 * 1) 바로 반복: 같은 말(1~3단어 묶음)이 연달아 나오면("하지만 하지만", "every day every day")
 *    반복된 범위를 묶고, fixed에 한 번만 쓴 표현을 넣는다.
 * 2) 잦은 반복: REPEAT_WINDOW_LINES 문장 안에서 같은 어간이 REPEAT_MIN_COUNT번 이상이면 각 단어를 표시한다.
 * 필러와 STOPWORDS는 제외한다.
 */
export function findRepeats(script: Line[], language: Language): Highlight[] {
  const fillers = new Set([...FILLERS[language].certain, ...FILLERS[language].ambiguous]);
  const stopwords = STOPWORDS[language];
  const sentences = script.filter((line) => !line.pause && line.words.length > 0);
  const highlights: Highlight[] = [];

  // 1) 바로 반복 (문장 안, 긴 묶음부터 확인)
  for (const line of sentences) {
    const tokens = line.words.map(normalize);
    for (let i = 0; i < tokens.length; i++) {
      const size = [3, 2, 1].find((n) => isRepeatedChunk(tokens, i, n, fillers));
      if (!size) continue;
      // "정말 정말 정말"처럼 세 번 이상이면 반복된 만큼 모두 묶는다
      let times = 2;
      while (isRepeatedChunk(tokens, i + size * (times - 1), size, fillers)) times++;
      highlights.push({
        from: line.offset + i,
        to: line.offset + i + size * times - 1,
        category: 'repeat',
        reason: '같은 말을 바로 반복했습니다. 한 번만 말해 보세요.',
        fixed: line.words.slice(i + size * (times - 1), i + size * times).join(' '),
      });
      i += size * times - 1;
    }
  }

  // 2) 잦은 반복 (문장 윈도우)
  const flagged = new Map<number, { key: string; count: number }>(); // 단어 번호 → 표시 정보
  for (let s = 0; s < sentences.length; s++) {
    const positions = new Map<string, { index: number; word: string }[]>();
    for (const line of sentences.slice(s, s + REPEAT_WINDOW_LINES)) {
      line.words.forEach((word, i) => {
        const key = stem(word);
        if (key.length < 2 || /^\d+$/.test(key) || fillers.has(normalize(word)) || stopwords.has(key)) return;
        if (stopwords.has(normalize(word))) return;
        const list = positions.get(key) ?? [];
        list.push({ index: line.offset + i, word });
        positions.set(key, list);
      });
    }
    for (const list of positions.values()) {
      if (list.length < REPEAT_MIN_COUNT) continue;
      for (const { index } of list) {
        const prev = flagged.get(index);
        if (!prev || prev.count < list.length) flagged.set(index, { key: stem(list[0].word), count: list.length });
      }
    }
  }

  for (const [index, { key, count }] of [...flagged.entries()].sort((a, b) => a[0] - b[0])) {
    highlights.push({
      from: index,
      to: index,
      category: 'repeat',
      reason: `반복: '${key}' (짧은 구간에서 ${count}번). 다른 표현으로 바꿔 보세요.`,
    });
  }

  return highlights;
}

/** tokens[i..i+n)과 바로 뒤 tokens[i+n..i+2n)이 같은지. 묶음이 전부 필러거나 빈 토큰이면 반복으로 보지 않는다. */
function isRepeatedChunk(tokens: string[], i: number, n: number, fillers: Set<string>): boolean {
  if (i + n * 2 > tokens.length) return false;
  const chunk = tokens.slice(i, i + n);
  if (chunk.some((t) => !t) || chunk.every((t) => fillers.has(t))) return false;
  return chunk.every((t, k) => t === tokens[i + n + k]);
}
