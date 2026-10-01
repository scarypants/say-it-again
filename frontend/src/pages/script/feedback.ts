import type { AnalyzeResponse } from "../../types/api";

export const categories = {
  panic: { label: "패닉존", style: "bg-hl-panic-soft decoration-hl-panic decoration-[3px]" },
  filler: { label: "군더더기", style: "bg-hl-filler-soft decoration-hl-filler decoration-2" },
  repeat: { label: "반복", style: "decoration-hl-repeat decoration-wavy decoration-2" },
  expression: { label: "표현 개선", style: "decoration-hl-expr decoration-dotted decoration-2" },
  grammar: { label: "문법", style: "decoration-[#efb1c7] decoration-double decoration-2" },
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
      reason: "군더더기를 빼고 문장을 이어 말해보세요.",
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
  for (const [start, end, reason, improved, type] of result.highlight[lineIndex] ?? []) {
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
        category: type === "grammar" ? "grammar" : "expression",
        original: line.words.slice(start, end + 1).join(" "),
        improved,
        reason,
      });
    }
  }
  return feedback;
}
