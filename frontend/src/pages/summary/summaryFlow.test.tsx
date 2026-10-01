/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { AnalysisContext, type Session } from "../../store/analysis";
import type { AnalyzeResponse } from "../../types/api";
import SummaryPage from "./index";
import { partTitle, totalDuration } from "../../components/common/scriptFormat";

const result: AnalyzeResponse = {
  mode: "presentation", language: "ko", level: "exam",
  parts: [{ duration: 10, script: [], highlight: [], final: [] }],
  charts: {
    categoryRatio: { panic: 10, filler: 5, repeat: 5, expression: 20, grammar: 0, normal: 60 },
    repeatTop: [], fillerTop: [],
  },
  analysis: {
    score: 80,
    stats: { wpm: 120, fillerCount: 1, panicCount: 1, panicTotalSec: 2, repeatCount: 1, expressionCount: 1, grammarCount: 0 },
    summary: { headline: "문장을 차분히 연결해 보세요", topPriorities: [], comment: "" },
  },
};

function render(source: AnalyzeResponse, questions?: string[]) {
  const session: Session = { audio: [], questions, transcript: { ...source, parts: source.parts } };
  const noop = () => {};
  return renderToStaticMarkup(
    <MemoryRouter>
      <AnalysisContext.Provider value={{
        settings: { mode: source.mode, language: source.language }, setSettings: noop,
        result: source, setResult: noop, previous: null, setPrevious: noop,
        session, setSession: noop,
      }}>
        <SummaryPage />
      </AnalysisContext.Provider>
    </MemoryRouter>,
  );
}

test("총평은 정상 비율 대신 서버 점수와 점수 기준을 표시한다", () => {
  const html = render(result);
  assert.match(html, /패닉존·군말·반복 기준/);
  assert.match(html, /text-4xl[^>]*>80<\/span>/);
  assert.match(html, /문장을 차분히 연결해 보세요/);
});

test("면접의 지난 질문이 있으면 같은 질문 재도전 버튼을 표시한다", () => {
  const html = render({ ...result, mode: "interview" }, ["자기소개를 해 주세요"]);
  assert.match(html, /<button[^>]*>다시, 말해<\/button>/);
  assert.ok(!html.includes('href="/record"'));
});

test("면접 질문이 없는 기록과 스피킹은 홈에서 새 연습을 시작한다", () => {
  for (const mode of ["interview", "speaking"] as const) {
    const html = render({ ...result, mode });
    assert.match(html, /href="\/"[^>]*>처음으로<\/a>/);
    assert.ok(!html.includes('href="/record"'));
  }
});

test("짧은 업로드 파일도 실제 누적 길이로 제목을 표시하며 파일 내부 시간은 유지한다", () => {
  const parts = [{ duration: 18.36 }, { duration: 18.06 }, { duration: 9 }];
  assert.equal(partTitle("presentation", 1, parts[1].duration, undefined, totalDuration(parts.slice(0, 1))), "00:18 – 00:36");
  assert.equal(partTitle("presentation", 2, parts[2].duration, undefined, totalDuration(parts.slice(0, 2))), "00:36 – 00:45");
  assert.equal(partTitle("presentation", 1, 300, undefined, 300), "05:00 – 10:00");
  assert.equal(partTitle("interview", 1, 18, "Q4 자기소개", 18), "질문 4");
});
