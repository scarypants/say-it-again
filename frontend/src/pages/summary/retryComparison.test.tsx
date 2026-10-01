/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { AnalyzeResponse } from "../../types/api";
import RetryComparison from "./components/RetryComparison";
import { comparablePrevious, retryReference } from "./retryComparison";

const before: AnalyzeResponse = {
  mode: "presentation",
  level: "exam",
  language: "ko",
  parts: [{ duration: 47.1, script: [], highlight: [], final: [{ words: ["도입"] }] }],
  charts: {
    categoryRatio: { panic: 0, filler: 0, repeat: 0, expression: 0, grammar: 0, normal: 100 },
    repeatTop: [],
    fillerTop: [],
  },
  analysis: {
    score: 75,
    stats: { wpm: 118, fillerCount: 6, panicCount: 2, panicTotalSec: 5.8, repeatCount: 1, expressionCount: 0, grammarCount: 0 },
    summary: { headline: "이전 총평", topPriorities: [], comment: "" },
  },
};
const after: AnalyzeResponse = {
  ...before,
  parts: [{ duration: 26, script: [], highlight: [], final: [] }],
  analysis: {
    score: 88,
    stats: { wpm: 118, fillerCount: 2, panicCount: 1, panicTotalSec: 2.6, repeatCount: 0, expressionCount: 0, grammarCount: 0 },
    summary: { headline: "군말이 줄었어요", topPriorities: [], comment: "" },
  },
  compare: {
    scriptMatch: 40,
    before: { score: 75, durationSec: 47.1, wpm: 118, fillerCount: 6, panicCount: 2, panicTotalSec: 5.8, repeatCount: 1, fillerPerMin: 7.6, panicPerMin: 2.5, repeatPerMin: 1.3 },
    after: { score: 88, durationSec: 26, wpm: 118, fillerCount: 2, panicCount: 1, panicTotalSec: 2.6, repeatCount: 0, fillerPerMin: 4.6, panicPerMin: 2.3, repeatPerMin: 0 },
  },
  retry: {
    improved: ["말이 멈춘 시간이 5.8초에서 2.6초로 줄었어요", "군말이 분당 7.6회에서 4.6회로 줄었어요"],
    remaining: ["두 번째 문장 앞 '음' 없애기"],
    comment: "군말이 줄었어요",
  },
};
const render = (result: AnalyzeResponse) => renderToStaticMarkup(<RetryComparison previous={before} result={result} />);

test("이전·이번 수치의 방향과 소수점을 정확히 비교하고 서버 피드백을 표시한다", () => {
  const html = render(after);
  for (const value of ["+13점", "−3회", "−0.2회", "−3.2초", "−1.3회", "40%"]) assert.ok(html.includes(value), value);
  assert.equal(after.retry!.comment, after.analysis.summary.headline);
  for (const text of [...after.retry!.improved, ...after.retry!.remaining])
    assert.ok(html.includes(renderToStaticMarkup(<>{text}</>)), text);
});

test("재도전 AI 응답 누락·실패 시에도 숫자 비교를 유지한다", () => {
  const result = { ...after, retry: undefined, warnings: ["llm_failed"] };
  const html = render(result);
  assert.ok(html.includes("+13점"));
  assert.ok(html.includes("전후 수치만 표시"));
  assert.ok(!html.includes(after.retry!.comment));
});

test("수치 악화·동률·잘못된 수치는 개선으로 잘못 표시하지 않는다", () => {
  const same = render(before);
  assert.equal((same.match(/변화 없음/g) ?? []).length, 5);
  const worse = structuredClone(after);
  worse.compare!.after.score = 50;
  worse.compare!.after.fillerPerMin = 9.6;
  worse.compare!.after.panicTotalSec = Number.NaN;
  const html = render(worse);
  assert.ok(html.includes("악화 </span>−25점"));
  assert.ok(html.includes("악화 </span>+2회"));
  assert.ok(!html.includes("NaN"));
});

test("반복 재도전에서도 최신 수치와 기존 대안 대본을 함께 유지한다", () => {
  const reference = retryReference(after, before);
  assert.equal(reference.analysis, after.analysis);
  assert.deepEqual(reference.parts.flatMap((part) => part.final), before.parts.flatMap((part) => part.final));
  assert.ok(after.parts.every((part) => part.final.length === 0));
});

test("기록에서 재도전 결과를 열어도 서버가 보낸 전후 비교를 표시한다", () => {
  const html = renderToStaticMarkup(<RetryComparison previous={null} result={after} />);
  assert.ok(html.includes("+13점"));
  assert.ok(html.includes("40%"));
  assert.equal(renderToStaticMarkup(<RetryComparison previous={null} result={before} />), "");
});

test("대본 내용이 다르면 안내하고 일치율이 없으면 0%로 오인하지 않는다", () => {
  const result = structuredClone(after);
  result.warnings = ["script_mismatch"];
  result.compare!.scriptMatch = null;
  const html = render(result);
  assert.ok(html.includes("비교는 참고용"));
  assert.ok(!html.includes("일치한 비율"));
});

test("첫 분석·스피킹·다른 설정의 이전 결과를 재도전 비교로 오인하지 않는다", () => {
  assert.equal(comparablePrevious(after, before), before);
  assert.equal(comparablePrevious(after, null), null);
  assert.equal(comparablePrevious({ ...after, mode: "speaking", language: "en", exam: "opic" }, before), null);
  assert.equal(comparablePrevious({ ...after, level: "assignment" }, before), null);
});
