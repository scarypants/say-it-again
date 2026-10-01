import type { AnalyzeResponse } from "../../types/api";
import { wordFeedback } from "../script/feedback";

export const chartCategories = [
  { key: "panic", name: "패닉존", fill: "var(--color-hl-panic)" },
  { key: "filler", name: "군더더기", fill: "var(--color-hl-filler)" },
  { key: "repeat", name: "반복", fill: "var(--color-hl-repeat)" },
  { key: "expression", name: "표현 개선", fill: "var(--color-hl-expr)" },
  { key: "grammar", name: "문법", fill: "#efb1c7" },
  { key: "normal", name: "정상", fill: "var(--color-success)" },
] as const;
export type ChartKey = (typeof chartCategories)[number]["key"];
export type ChartItem = (typeof chartCategories)[number] & { value: number; percent: number };

// 단어 타임스탬프가 없는 현재 계약에서는 각 문장의 시간을 단어 수로 나눈다.
// 겹친 항목은 패닉존 → 군더더기 → 반복 → 문법 → 표현 개선 순서로 한 번만 센다.
export function createChartData(result: AnalyzeResponse): ChartItem[] {
  const seconds: Record<ChartKey, number> = {
    panic: 0,
    filler: 0,
    repeat: 0,
    expression: 0,
    grammar: 0,
    normal: 0,
  };
  let coveredUntil = 0;
  for (const [index, line] of result.lines.entries()) {
    if (!Number.isFinite(line.start) || !Number.isFinite(line.end)) continue;
    const start = Math.max(0, line.start, coveredUntil);
    const end =
      Number.isFinite(result.duration) && result.duration > 0
        ? Math.min(line.end, result.duration)
        : line.end;
    const duration = Math.max(0, end - start);
    coveredUntil = Math.max(coveredUntil, end);
    if (line.pause) {
      seconds.panic += duration;
      continue;
    }
    if (!line.words.length) continue;
    for (let word = 0; word < line.words.length; word++) {
      const issues = wordFeedback(result, index, word).map((item) => item.category);
      const beforePause =
        result.lines[index + 1]?.pause && word >= Math.max(0, line.words.length - 3);
      const category: ChartKey = beforePause
        ? "panic"
        : issues.includes("filler")
          ? "filler"
          : issues.includes("repeat")
            ? "repeat"
            : issues.includes("grammar")
              ? "grammar"
              : issues.includes("expression")
                ? "expression"
                : "normal";
      seconds[category] += duration / line.words.length;
    }
  }
  const total = Object.values(seconds).reduce((sum, value) => sum + value, 0);
  const rows = chartCategories.map((item) => ({
    ...item,
    value: seconds[item.key],
    percent: total ? (seconds[item.key] / total) * 100 : 0,
  }));
  const rounded = rows.map((item) => Math.floor(item.percent));
  const remaining = total ? 100 - rounded.reduce((sum, value) => sum + value, 0) : 0;
  const order = rows
    .map((item, index) => ({ index, fraction: item.percent - rounded[index] }))
    .sort((a, b) => b.fraction - a.fraction);
  for (const item of order.slice(0, remaining)) rounded[item.index]++;
  return rows.map((item, index) => ({ ...item, percent: rounded[index] }));
}
