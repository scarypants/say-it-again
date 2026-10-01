/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import type { AnalyzeResponse, TranscribeResponse } from "../types/api";
import { createChartData } from "../pages/summary/chartData";

const transcript: TranscribeResponse = JSON.parse(readFileSync(new URL("./transcribe.speaking.sample.json", import.meta.url), "utf8"));
const result: AnalyzeResponse = JSON.parse(readFileSync(new URL("./analyze.speaking.sample.json", import.meta.url), "utf8"));

test("스피킹 샘플은 두 영어 답변과 파트별 시간·단어 번호를 유지한다", () => {
  assert.equal(result.mode, "speaking");
  assert.equal(result.language, "en");
  assert.equal(result.parts.length, 2);
  assert.deepEqual(result.parts.map(({ duration, script }) => ({ duration, script })), transcript.parts);
  for (const part of result.parts) {
    let offset = 0;
    for (const line of part.script) {
      assert.equal(line.offset, offset);
      assert.ok(line.start >= 0 && line.end >= line.start && line.end <= part.duration);
      if (line.pause) assert.equal(line.words.length, 0);
      offset += line.words.length;
    }
    for (const h of part.highlight) assert.ok(h.from >= 0 && h.to >= h.from && h.to < offset);
  }
});

test("샘플 점수는 새 계약을 따르고 문법은 표현 개선 차트에 합산한다", () => {
  const ratio = result.charts.categoryRatio;
  assert.equal(Object.values(ratio).reduce((sum, value) => sum + value, 0), 100);
  assert.equal(result.analysis.score, 100 - ratio.panic - ratio.filler - ratio.repeat);
  assert.ok(ratio.grammar > 0);
  assert.equal(createChartData(result).find((item) => item.key === "expression")?.percent, ratio.expression + ratio.grammar);
  assert.ok(!JSON.stringify(result).includes("군말(필러)"));
});
