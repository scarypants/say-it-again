/// <reference types="node" />
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Session } from "../../store/analysis";
import type { AnalyzeResponse } from "../../types/api";
import { partTitle, totalDuration } from "../../components/common/scriptFormat";
import { isFollowUpSummary } from "./followUp";

// #112: tsconfig.json의 references는 tsx에 JSX 설정을 전달하지 않는다.
// 실행 위치·CLI 옵션과 관계없이 앱과 같은 react-jsx로 화면과 하위 컴포넌트를 읽는다.
const loader = register({
  namespace: "summary-flow-test",
  tsconfig: fileURLToPath(new URL("../../../tsconfig.app.json", import.meta.url)),
});
const { default: SummaryPage } = await loader.import("./index.tsx", import.meta.url) as typeof import("./index");
const { AnalysisContext } = await loader.import("../../store/analysis.ts", import.meta.url) as typeof import("../../store/analysis");
const { MemoryRouter } = await loader.import("react-router", import.meta.url) as typeof import("react-router");
after(loader.unregister);

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

function render(source: AnalyzeResponse, questions?: string[], previous: AnalyzeResponse | null = null) {
  const session: Session = { audio: [], questions, transcript: { ...source, parts: source.parts } };
  const noop = () => {};
  return renderToStaticMarkup(
    createElement(MemoryRouter, null,
      createElement(AnalysisContext.Provider, { value: {
        settings: { mode: source.mode, language: source.language }, setSettings: noop,
        result: source, setResult: noop, previous, setPrevious: noop,
        session, setSession: noop,
      } }, createElement(SummaryPage)),
    ),
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

test("꼬리질문 답변 총평은 질문·개별 코멘트·모범 답안을 표시한다", () => {
  const source = { ...result, mode: "interview" as const, parts: [{
    ...result.parts[0], comment: "개인 역할과 결과를 구체적으로 밝혔어요.",
    final: [{ words: ["저는", "API", "구현을", "담당했습니다."] }],
  }] };
  const html = render(source, ["Interview Follow-up 1 (about Q4)\nJob: 개발자\nQuestion: 본인의 역할은 무엇이었나요?"]);
  assert.match(html, /꼬리질문 답변의 한 줄 요약/);
  assert.match(html, /꼬리질문 답변 점수/);
  assert.match(html, /본인의 역할은 무엇이었나요/);
  assert.match(html, /개인 역할과 결과를 구체적으로 밝혔어요/);
  assert.match(html, /모범 답안 보기/);
  assert.match(html, /저는 API 구현을 담당했습니다/);
  assert.match(html, /href="\/script\?part=0"/);
});

test("토익은 질문 개수만으로 꼬리질문이라 판단하지 않고 실제 연습 질문과 대조한다", () => {
  const prompts = ["TOEIC Speaking Part 3\nQuestion: What changed?"];
  assert.equal(isFollowUpSummary(prompts), false);
  assert.equal(isFollowUpSummary(prompts, { practice: [{ prompt: prompts[0] }] }), true);
  assert.equal(isFollowUpSummary(prompts, { practice: [{ prompt: "Other question" }] }), false);
  assert.equal(isFollowUpSummary(prompts, { practice: [null] }), false);
  assert.equal(isFollowUpSummary([], { practice: [] }), false);
});

test("꼬리질문 개별 코멘트가 없으면 서버 피드백을 임의로 만들지 않는다", () => {
  const html = render({ ...result, mode: "speaking" }, ["OPIc Follow-up 1 (topic: cafe)\nQuestion: How has it changed?"]);
  assert.match(html, /개별 코멘트가 제공되지 않았어요/);
  assert.ok(!html.includes("모범 답안 보기"));
});

test("다른 질문의 결과를 이전 면접과 재도전 점수로 비교하지 않는다", () => {
  const interview = { ...result, mode: "interview" as const };
  const html = render(interview, ["Interview Follow-up 1\nQuestion: 무엇을 바꾸겠어요?"], interview);
  assert.ok(!html.includes("재도전 점수"));
  assert.ok(!html.includes("다시 말한 결과"));
  assert.match(html, /꼬리질문 답변 점수/);
});

test("스피킹 파트별 서버 코멘트는 질문 순서와 원래 파트 번호에 맞춰 표시한다", () => {
  const source: AnalyzeResponse = {
    ...result, mode: "speaking", exam: "TOEIC-Speaking",
    parts: [
      { ...result.parts[0], comment: "구체적인 선호 이유를 제시했어요." },
      { ...result.parts[0], comment: "반대 의견과 근거를 연결해 보세요." },
    ],
  };
  const html = render(source, [
    "TOEIC Speaking Part 3\nQuestion: Why do you visit this cafe?",
    "TOEIC Speaking Part 5\nQuestion: Do you agree with online classes?",
  ]);
  assert.match(html, /파트별 코멘트/);
  assert.ok(html.indexOf("Part 3") < html.indexOf(source.parts[0].comment!));
  assert.ok(html.indexOf(source.parts[0].comment!) < html.indexOf("Part 5"));
  assert.ok(html.includes("Why do you visit this cafe?"));
  assert.ok(html.includes(source.parts[1].comment!));
  assert.match(html, /aria-label="Part 5 대본 보기"[^>]*href="\/script\?part=1"/);
});

test("면접 질문별 코멘트는 건너뛴 질문 번호를 유지하고 누락된 코멘트를 명시한다", () => {
  const source: AnalyzeResponse = {
    ...result, mode: "interview",
    parts: [
      { ...result.parts[0], comment: "팀에서 본인의 역할을 구체적으로 밝혔어요." },
      { ...result.parts[0], comment: "   " },
    ],
  };
  const html = render(source, [
    "Interview Q2 (Motivation)\nJob: 개발자\nQuestion: 지원한 이유는 무엇인가요?",
    "Interview Q4 (Experience)\nJob: 개발자\nQuestion: 갈등을 어떻게 해결했나요?",
  ]);
  assert.match(html, /질문별 코멘트/);
  assert.match(html, /질문 4/);
  assert.match(html, /갈등을 어떻게 해결했나요/);
  assert.match(html, /이 답변의 코멘트가 제공되지 않았어요/);
  const missingQuestions = render(source, ["연결되지 않은 질문"]);
  assert.ok(!missingQuestions.includes("연결되지 않은 질문"));
  assert.ok(missingQuestions.includes(source.parts[0].comment!));
});

test("발표와 꼬리질문 총평에는 일반 질문 코멘트 영역을 중복 표시하지 않는다", () => {
  assert.ok(!render(result).includes('id="answer-comments-title"'));
  const html = render({ ...result, mode: "interview" }, ["Interview Follow-up 1\nQuestion: 역할은 무엇인가요?"]);
  assert.match(html, /꼬리질문별 피드백/);
  assert.ok(!html.includes('id="answer-comments-title"'));
});
