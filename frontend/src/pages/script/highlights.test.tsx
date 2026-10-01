/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Highlight, Part } from "../../types/api";
import FeedbackDetail from "./FeedbackDetail";
import { CATEGORY, countByCategory, lineRuns } from "./highlights";

const line = { start: 1, end: 3, offset: 0, words: ["I", "is", "very", "good"] };
const grammar: Highlight = { from: 1, to: 1, category: "grammar", fixed: "am", reason: "동사를 바꿔요" };
const expression: Highlight = { from: 2, to: 3, category: "expression", fixed: "confident" };
const panic: Highlight = { from: 1, to: 3, category: "panic", pauseSec: 2.5, reason: "연결 문장이 떠오르지 않아 막혔어요", fixed: "그래서 이렇게 이어 가요" };
const part: Part = { duration: 5, script: [line], highlight: [grammar, expression, panic], final: [] };

test("문법과 표현 개선을 같은 색·집계·연속 영역으로 표시하고 원본 응답은 보존한다", () => {
  assert.equal(CATEGORY.grammar.label, "표현 개선");
  assert.equal(CATEGORY.grammar.mark, CATEGORY.expression.mark);
  assert.deepEqual(countByCategory([part]), { panic: 1, filler: 0, repeat: 0, expression: 2 });
  const runs = lineRuns(line, [grammar, expression]);
  assert.equal(runs.length, 2);
  assert.equal(runs[1].text, "is very good");
  assert.deepEqual(runs[1].items, [grammar, expression]);
  assert.equal(grammar.category, "grammar");
});

test("패닉존은 막힌 이유와 이어 갈 말을 보여 주고, 겹친 표현 개선도 함께 보인다", () => {
  const only = renderToStaticMarkup(<FeedbackDetail part={part} items={[panic]} onClose={() => {}} />);
  assert.ok(only.includes("2.5초 멈춤"));
  assert.ok(only.includes("막힌 이유"));
  const html = renderToStaticMarkup(<FeedbackDetail part={part} items={part.highlight} onClose={() => {}} />);
  assert.ok(html.includes(panic.reason!));
  assert.ok(html.includes(panic.fixed!));
  assert.ok(!html.includes("문법"));
  assert.ok(html.includes("표현 개선"));
  assert.ok(html.includes("am confident"));
});

test("군말을 띄어쓰기까지 한 덩어리로 묶고 파트 단어 번호를 유지한다", () => {
  const offsetLine = { ...line, offset: 20, words: ["어", "그러니까", "식당이", "붐벼요"] };
  const fillers: Highlight[] = [
    { from: 20, to: 20, category: "filler", fixed: "" },
    { from: 21, to: 21, category: "filler", fixed: "" },
  ];
  const runs = lineRuns(offsetLine, fillers);
  assert.equal(runs[0].text, "어 그러니까");
  assert.equal(runs[0].first, 20);
  assert.equal(runs[1].first, 22);
});
