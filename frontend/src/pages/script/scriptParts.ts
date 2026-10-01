import type { AnalyzeResponse, Line } from "../../types/api";
import type { Feedback } from "./feedback";

type Mark = {
  from: number;
  to: number;
  category: Feedback["category"] | "panic";
  reason?: string;
  fixed?: string;
};
export type ScriptPart = { duration: number; lines: Line[]; marks: Mark[]; comment?: string };
type PartsResponse = {
  parts: {
    duration: number;
    script: Line[];
    highlight: (Omit<Mark, "category"> & { category: Mark["category"] | "grammar" })[];
    comment?: string;
  }[];
};

export function getScriptParts(value: unknown): ScriptPart[] {
  if (!value || typeof value !== "object") return [];
  if ("parts" in value && Array.isArray(value.parts)) {
    return (value as PartsResponse).parts.map((part) => ({
      duration: part.duration,
      lines: part.script ?? [],
      comment: part.comment,
      marks: (part.highlight ?? []).map((mark) => ({
        ...mark,
        category: mark.category === "grammar" ? "expression" : mark.category,
      })),
    }));
  }
  const old = value as AnalyzeResponse;
  if (!Array.isArray(old.lines)) return [];
  const marks: Mark[] = [];
  let offset = 0;
  for (const [index, line] of old.lines.entries()) {
    for (const category of ["filler", "repeat"] as const) {
      const indices = [
        ...new Set((category === "filler" ? old.fillers[index] : old.repeats[index]) ?? []),
      ]
        .filter((word) => Number.isInteger(word) && word >= 0 && word < line.words.length)
        .sort((a, b) => a - b);
      for (let i = 0; i < indices.length; i++) {
        const from = indices[i];
        let to = from;
        while (indices[i + 1] === to + 1) to = indices[++i];
        marks.push({
          from: offset + from,
          to: offset + to,
          category,
          reason:
            category === "filler"
              ? "군말을 빼고 문장을 이어 말해보세요."
              : "반복된 표현을 줄여 간결하게 전달해보세요.",
          fixed: line.words
            .filter(
              (word, w) =>
                !indices.includes(w) || (category === "repeat" && line.words.indexOf(word) === w),
            )
            .join(" "),
        });
      }
    }
    for (const [from, to, reason, fixed] of old.highlight[index] ?? []) {
      if (
        Number.isInteger(from) &&
        Number.isInteger(to) &&
        from >= 0 &&
        to >= from &&
        to < line.words.length
      )
        marks.push({ from: offset + from, to: offset + to, category: "expression", reason, fixed });
    }
    if (old.lines[index + 1]?.pause && line.words.length)
      marks.push({
        from: offset + Math.max(0, line.words.length - 3),
        to: offset + line.words.length - 1,
        category: "panic",
      });
    offset += line.words.length;
  }
  return [{ duration: old.duration, lines: old.lines, marks }];
}

export function getLineSegments(part: ScriptPart, lineIndex: number) {
  const line = part.lines[lineIndex];
  const offset = part.lines.slice(0, lineIndex).reduce((sum, row) => sum + row.words.length, 0);
  const allWords = part.lines.flatMap((row) => row.words);
  const priority = { panic: 0, filler: 1, repeat: 2, expression: 3 };
  const marks = part.marks
    .filter(
      (mark) =>
        Number.isInteger(mark.from) &&
        Number.isInteger(mark.to) &&
        mark.from >= 0 &&
        mark.to >= mark.from &&
        mark.to < allWords.length,
    )
    .sort((a, b) => priority[a.category] - priority[b.category]);
  const runs: { start: number; end: number; mark?: Mark; feedback: Feedback[] }[] = [];
  for (let word = 0; word < line.words.length; word++) {
    const applicable = marks.filter(
      (mark) => word + offset >= mark.from && word + offset <= mark.to,
    );
    const mark = applicable[0];
    const previous = runs.at(-1);
    if (previous && previous.mark === mark) {
      previous.end = word;
      continue;
    }
    runs.push({
      start: word,
      end: word,
      mark,
      feedback: applicable
        .filter((item) => item.category !== "panic")
        .map((item) => ({
          category: item.category as Feedback["category"],
          original: allWords.slice(item.from, item.to + 1).join(" "),
          improved: item.fixed ?? "개선된 표현이 아직 준비되지 않았어요.",
          reason: item.reason,
        })),
    });
  }
  return runs.map((run) => ({ ...run, text: line.words.slice(run.start, run.end + 1).join(" ") }));
}
