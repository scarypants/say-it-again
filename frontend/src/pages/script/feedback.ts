import type { AnalyzeResponse } from "../../types/api";

export const categories = {
  panic: {
    label: "패닉존",
    style: "bg-hl-panic-soft",
    description: "2초 이상 말이 멈춘 구간과 그 직전의 표현이에요.",
  },
  filler: {
    label: "군말",
    style: "bg-hl-filler-soft",
    description: "'음', '어', '그러니까'처럼 빼도 뜻이 유지되는 말이에요.",
  },
  repeat: {
    label: "반복",
    style: "bg-[#eee5fb]",
    description: "같은 단어나 표현을 반복한 부분이에요.",
  },
  expression: {
    label: "표현 개선",
    style: "bg-[#e3ecfc]",
    description: "표현이나 문법을 다듬으면 더 명확하게 전달할 수 있는 부분이에요.",
  },
};

export type Feedback = {
  category: Exclude<keyof typeof categories, "panic">;
  original: string;
  improved: string;
  reason?: string;
};

export function wordFeedback(
  result: AnalyzeResponse,
  lineIndex: number,
  wordIndex: number,
): Feedback[] {
  const line = result.lines[lineIndex];
  const word = line?.words[wordIndex];
  if (!word || line.pause) return [];
  const feedback: Feedback[] = [];
  if (result.fillers[lineIndex]?.includes(wordIndex)) {
    feedback.push({
      category: "filler",
      original: word,
      improved: line.words
        .filter((_, index) => !result.fillers[lineIndex]?.includes(index))
        .join(" "),
      reason: "군말을 빼고 문장을 이어 말해보세요.",
    });
  }
  if (result.repeats[lineIndex]?.includes(wordIndex)) {
    feedback.push({
      category: "repeat",
      original: word,
      improved: line.words
        .filter(
          (word, index) =>
            !result.repeats[lineIndex]?.includes(index) || line.words.indexOf(word) === index,
        )
        .join(" "),
      reason: "반복된 단어를 줄여 같은 내용을 간결하게 전달해보세요.",
    });
  }
  for (const [start, end, reason, improved] of result.highlight[lineIndex] ?? []) {
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end >= line.words.length ||
      start > end
    )
      continue;
    if (wordIndex >= start && wordIndex <= end) {
      feedback.push({
        category: "expression",
        original: line.words.slice(start, end + 1).join(" "),
        improved,
        reason,
      });
    }
  }
  return feedback;
}
