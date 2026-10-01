import type { AnalyzeResponse } from "../../types/api";

export function feedbackRows(result: AnalyzeResponse, category: "filler" | "repeat") {
  return result.parts.flatMap((part, partIndex) =>
    part.script.flatMap((line) => {
      if (line.pause || !line.words.length) return [];
      const marks = part.highlight
        .filter(
          (mark) =>
            mark.category === category &&
            mark.from >= line.offset &&
            mark.from < line.offset + line.words.length &&
            mark.to >= mark.from,
        )
        .sort((a, b) => a.from - b.from);
      if (!marks.length) return [];
      const segments: { text: string; highlighted: boolean }[] = [];
      line.words.forEach((word, index) => {
        const highlighted = marks.some(
          (mark) => index + line.offset >= mark.from && index + line.offset <= mark.to,
        );
        const previous = segments.at(-1);
        if (previous?.highlighted === highlighted) previous.text += ` ${word}`;
        else segments.push({ text: word, highlighted });
      });
      const improved = [...line.words];
      // 원문 단어 번호가 바뀌지 않도록 뒤의 구절부터 대체한다.
      for (const mark of [...marks].reverse()) {
        if (mark.fixed === undefined) continue;
        improved.splice(
          mark.from - line.offset,
          Math.min(mark.to - line.offset + 1, line.words.length) - (mark.from - line.offset),
          ...mark.fixed.split(/\s+/).filter(Boolean),
        );
      }
      return [
        {
          key: `${partIndex}-${line.offset}`,
          partIndex,
          start: line.start,
          end: line.end,
          word: marks[0].from,
          segments,
          improved: marks.every((mark) => mark.fixed !== undefined)
            ? improved.join(" ")
            : undefined,
        },
      ];
    }),
  );
}
