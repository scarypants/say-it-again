import type { AnalyzeResponse } from "../../types/api";

export const chartCategories = [
  { key: "panic", name: "패닉존", fill: "var(--color-hl-panic)" },
  { key: "filler", name: "군말", fill: "var(--color-hl-filler)" },
  { key: "repeat", name: "반복", fill: "var(--color-hl-repeat)" },
  { key: "expression", name: "표현 개선", fill: "var(--color-hl-expr)" },
  { key: "normal", name: "정상", fill: "var(--color-hl-normal)" },
] as const;
export type ChartKey = (typeof chartCategories)[number]["key"];
export type ChartItem = (typeof chartCategories)[number] & { value: number; percent: number };

// 카테고리 비율은 서버가 단어 기준으로 계산해 준다 (charts.categoryRatio, 합 100)
export function createChartData(result: AnalyzeResponse): ChartItem[] {
  const ratio = result.charts.categoryRatio;
  return chartCategories.map((item) => {
    const value = ratio[item.key] + (item.key === "expression" ? ratio.grammar : 0);
    return { ...item, value, percent: value };
  });
}
