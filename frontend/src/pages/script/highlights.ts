import type { Highlight, HighlightCategory, Line, Part } from "../../types/api";

// 문법도 표현 개선으로 표시한다. 겹치면 빨강 > 노랑 > 보라 > 파랑 순으로 칠한다.
export const PRIORITY: Record<HighlightCategory, number> = {
  panic: 0,
  filler: 1,
  repeat: 2,
  expression: 3,
  grammar: 3,
};

export const displayCategory = (category: HighlightCategory) =>
  category === "grammar" ? "expression" : category;
export const DISPLAY_CATEGORIES = ["panic", "filler", "repeat", "expression"] as const;

// 색은 styles/index.css 의 --color-hl-* 토큰. Tailwind가 찾을 수 있게 클래스 이름을 통째로 적는다
export const CATEGORY: Record<
  HighlightCategory,
  { label: string; mark: string; dot: string; under: string; desc: string }
> = {
  panic: {
    label: "패닉존",
    mark: "bg-hl-panic-soft",
    dot: "bg-hl-panic",
    under: "decoration-hl-panic",
    desc: "오래 멈추기 바로 전에 한 말 (2초, 스피킹은 1.5초 이상). 첫마디가 3초 넘게 늦으면 처음 한 말",
  },
  filler: {
    label: "군말",
    mark: "bg-hl-filler-soft",
    dot: "bg-hl-filler",
    under: "decoration-hl-filler",
    desc: "빼도 뜻이 그대로인 말버릇",
  },
  repeat: {
    label: "반복",
    mark: "bg-hl-repeat-soft",
    dot: "bg-hl-repeat",
    under: "decoration-hl-repeat",
    desc: "가까이에서 되풀이한 말",
  },
  expression: {
    label: "표현 개선",
    mark: "bg-hl-expr-soft",
    dot: "bg-hl-expr",
    under: "decoration-hl-expr",
    desc: "더 분명하게 바꿀 수 있는 표현",
  },
  grammar: {
    label: "표현 개선",
    mark: "bg-hl-expr-soft",
    dot: "bg-hl-expr",
    under: "decoration-hl-expr",
    desc: "더 분명하게 바꿀 수 있는 표현",
  },
};

export const byPriority = (a: Highlight, b: Highlight) =>
  PRIORITY[a.category] - PRIORITY[b.category] || a.from - b.from;

const covers = (h: Highlight, word: number) => word >= h.from && word <= h.to;

// 한 줄을 칠할 조각으로 나눈다. 같은 하이라이트, 또는 같은 종류가 바로 붙어 있는 단어
// ("그러니까 그" 같은 연속 군말)는 한 조각이라 띄어쓰기까지 색이 이어지고 한 번에 열린다.
// 줄 끝에서 다음 줄로 이어지면 continues
// 단어마다 under: 배경색에 가려진 다른 종류의 하이라이트 (범위를 밑줄로 보여 준다)
export type RunWord = { text: string; under?: HighlightCategory };

export type Run = {
  first: number; // 조각 첫 단어의 파트 전체 번호
  text: string;
  words: RunWord[];
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
    const sameKind =
      !!prev?.top && !!top && displayCategory(prev.top.category) === displayCategory(top.category);
    const under =
      top &&
      items.find((h) => displayCategory(h.category) !== displayCategory(top.category))?.category;
    if (prev && (prev.top === top || sameKind)) {
      prev.text += " " + word;
      prev.words.push({ text: word, under });
      for (const h of items) if (!prev.items.includes(h)) prev.items.push(h);
      prev.continues = !!top && top.to > g;
      return;
    }
    runs.push({
      first: g,
      text: word,
      words: [{ text: word, under }],
      top,
      items,
      continues: !!top && top.to > g,
    });
  });
  return runs;
}

// 조각을 눌렀을 때 열 하이라이트: 보이는 색과 같은 종류 + 어디에서도 색으로 안 보이는(완전히 가려진) 것.
// 다른 색으로 보이는 하이라이트는 그 색을 눌러야 열린다 (겹쳐 있어도 섞이지 않게). 패닉존은 원인·대안을 연다
export function runSelection(run: Run, part: Part): Highlight[] {
  const top = run.top;
  if (!top) return [];
  const kind = displayCategory(top.category);
  const visible = new Set<Highlight>();
  for (const line of part.script) {
    if (line.pause) continue;
    for (const r of lineRuns(line, part.highlight)) {
      if (!r.top) continue;
      const k = displayCategory(r.top.category);
      for (const h of r.items) if (displayCategory(h.category) === k) visible.add(h);
    }
  }
  return run.items.filter((h) => displayCategory(h.category) === kind || !visible.has(h));
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
  const counts: Record<(typeof DISPLAY_CATEGORIES)[number], number> = {
    panic: 0,
    filler: 0,
    repeat: 0,
    expression: 0,
  };
  for (const p of parts) for (const h of p.highlight) counts[displayCategory(h.category)]++;
  return counts;
}
