import { CATEGORY_PRIORITY, TOP_N } from '../config';
import { normalize } from '../text';
import type { Analysis, Category, Charts, Part } from '../types/api';
import { flattenWords } from './script';

type RatioKey = Category | 'normal';

// 모든 파트를 합쳐 차트 데이터를 만든다.
// categoryRatio는 단어 기준이며, 한 단어가 여러 하이라이트에 걸리면 우선순위가 높은 하나만 센다.
export function buildCharts(parts: Part[]): Charts {
  const counts: Record<RatioKey, number> = { panic: 0, filler: 0, repeat: 0, expression: 0, grammar: 0, normal: 0 };
  const fillerWords = new Map<string, number>();
  const repeatWords = new Map<string, number>();
  let total = 0;

  for (const part of parts) {
    const words = flattenWords(part.script);
    const top: (Category | undefined)[] = new Array(words.length);
    total += words.length;

    for (const h of part.highlight) {
      const from = Math.max(0, h.from);
      const to = Math.min(words.length - 1, h.to);
      for (let i = from; i <= to; i++) {
        const current = top[i];
        if (!current || rank(h.category) < rank(current)) top[i] = h.category;
      }
      const text = normalize(words.slice(from, to + 1).join(' '));
      if (h.category === 'filler') increment(fillerWords, text);
      if (h.category === 'repeat') increment(repeatWords, text);
    }

    for (const category of top) counts[category ?? 'normal']++;
  }

  return {
    categoryRatio: toRatio(counts, total),
    repeatTop: topN(repeatWords),
    fillerTop: topN(fillerWords),
  };
}

// score = 정상 단어 비율. wpm은 pause 줄과 줄 사이 간격을 뺀 발화 시간 기준(필러 포함).
export function buildStats(parts: Part[], charts: Charts): Pick<Analysis, 'score' | 'stats'> {
  const highlights = parts.flatMap((p) => p.highlight);
  const count = (category: Category) => highlights.filter((h) => h.category === category).length;

  const totalWords = parts.reduce((sum, p) => sum + flattenWords(p.script).length, 0);
  const speakingSec = parts
    .flatMap((p) => p.script)
    .filter((line) => !line.pause)
    .reduce((sum, line) => sum + (line.end - line.start), 0);
  const panicTotalSec = highlights
    .filter((h) => h.category === 'panic')
    .reduce((sum, h) => sum + (h.pauseSec ?? 0), 0);

  return {
    score: charts.categoryRatio.normal,
    stats: {
      wpm: speakingSec > 0 ? Math.round(totalWords / (speakingSec / 60)) : 0,
      fillerCount: count('filler'),
      panicCount: count('panic'),
      panicTotalSec: Math.round(panicTotalSec * 10) / 10,
      repeatCount: count('repeat'),
      expressionCount: count('expression'),
      grammarCount: count('grammar'),
    },
  };
}

function rank(category: Category): number {
  return CATEGORY_PRIORITY.indexOf(category);
}

function increment(map: Map<string, number>, key: string): void {
  if (key) map.set(key, (map.get(key) ?? 0) + 1);
}

function topN(map: Map<string, number>): { word: string; count: number }[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([word, count]) => ({ word, count }));
}

// 정수 퍼센트로 바꾸고, 반올림 오차는 normal에서 맞춰 합이 100이 되게 한다.
function toRatio(counts: Record<RatioKey, number>, total: number): Charts['categoryRatio'] {
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const ratio = {
    panic: pct(counts.panic),
    filler: pct(counts.filler),
    repeat: pct(counts.repeat),
    expression: pct(counts.expression),
    grammar: pct(counts.grammar),
    normal: 0,
  };
  const used = ratio.panic + ratio.filler + ratio.repeat + ratio.expression + ratio.grammar;
  ratio.normal = Math.max(0, 100 - used);
  return ratio;
}
