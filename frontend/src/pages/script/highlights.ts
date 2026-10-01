import type { Highlight, HighlightCategory, Line, Part } from "../../types/api";

// 겹치면 위에 있는 것 하나만 배경색으로 칠한다 (docs/api.md: 빨강 > 노랑 > 보라 > 파랑 > 핑크)
export const PRIORITY: Record<HighlightCategory, number> = {
  panic: 0,
  filler: 1,
  repeat: 2,
  expression: 3,
  grammar: 4,
};

// 색은 styles/index.css 의 --color-hl-* 토큰. Tailwind가 찾을 수 있게 클래스 이름을 통째로 적는다
export const CATEGORY: Record<
  HighlightCategory,
  { label: string; mark: string; dot: string; desc: string }
> = {
  panic: {
    label: "패닉존",
    mark: "bg-hl-panic-soft border-hl-panic",
    dot: "bg-hl-panic",
    desc: "2초 넘게 말이 멈추기 직전의 말",
  },
  filler: {
    label: "군말",
    mark: "bg-hl-filler-soft border-hl-filler",
    dot: "bg-hl-filler",
    desc: "빼도 뜻이 그대로인 말버릇",
  },
  repeat: {
    label: "반복",
    mark: "bg-hl-repeat-soft border-hl-repeat",
    dot: "bg-hl-repeat",
    desc: "가까이에서 되풀이한 말",
  },
  expression: {
    label: "표현 개선",
    mark: "bg-hl-expr-soft border-hl-expr",
    dot: "bg-hl-expr",
    desc: "더 분명하게 바꿀 수 있는 표현",
  },
  grammar: {
    label: "문법",
    mark: "bg-hl-grammar-soft border-hl-grammar",
    dot: "bg-hl-grammar",
    desc: "문법이 틀린 부분",
  },
};

export const byPriority = (a: Highlight, b: Highlight) =>
  PRIORITY[a.category] - PRIORITY[b.category] || a.from - b.from;

const covers = (h: Highlight, word: number) => word >= h.from && word <= h.to;

// 한 줄을 칠할 조각으로 나눈다. 같은 하이라이트가 이어지는 단어는 한 조각이라
// 단어 사이 띄어쓰기까지 색이 이어진다. 줄 끝에서 다음 줄로 이어지면 continues
export type Run = {
  first: number; // 조각 첫 단어의 파트 전체 번호
  text: string;
  top?: Highlight; // 배경색을 정하는 하이라이트
  items: Highlight[]; // 이 조각에 걸린 하이라이트 전부 (우선순위 순)
  continues: boolean;
};

export function lineRuns(line: Line, highlights: Highlight[]): Run[] {
  const runs: Run[] = [];
  line.words.forEach((word, i) => {
    const g = line.offset + i;
    const items = highlights.filter((h) => covers(h, g)).sort(byPriority);
    const top = items[0];
    const prev = runs.at(-1);
    if (prev && prev.top === top) {
      prev.text += " " + word;
      for (const h of items) if (!prev.items.includes(h)) prev.items.push(h);
      prev.continues = !!top && top.to > g;
      return;
    }
    runs.push({ first: g, text: word, top, items, continues: !!top && top.to > g });
  });
  return runs;
}

// 하이라이트가 가리키는 말 (줄을 넘어가도 이어서)
export function highlightText(part: Part, h: Highlight) {
  return part.script
    .flatMap((l) => l.words)
    .slice(h.from, h.to + 1)
    .join(" ");
}

// 단어가 들어 있는 줄 (문장 재생·스크롤용)
export function lineOfWord(part: Part, word: number) {
  return part.script.findIndex(
    (l) => !l.pause && word >= l.offset && word < l.offset + l.words.length,
  );
}

export function countByCategory(parts: Part[]) {
  const counts: Record<HighlightCategory, number> = {
    panic: 0,
    filler: 0,
    repeat: 0,
    expression: 0,
    grammar: 0,
  };
  for (const p of parts) for (const h of p.highlight) counts[h.category]++;
  return counts;
}
