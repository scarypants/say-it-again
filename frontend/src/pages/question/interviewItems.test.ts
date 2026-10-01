/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import type { InterviewQuestionType } from "../../types/api";
import { interviewQuestionText, parseInterviewQuestion } from "./interviewItems";

// 면접 재도전은 기록에 남은 질문 문자열에서 질문·직무를 되살린다
test("질문 문자열을 만들고 다시 읽으면 유형·질문·직무가 그대로", () => {
  const types: InterviewQuestionType[] = ["intro", "motivation", "job", "experience", "closing"];
  types.forEach((type, i) => {
    const q = { type, text: "팀 갈등을 어떻게 해결했나요?" };
    const parsed = parseInterviewQuestion(interviewQuestionText(q, i, "백엔드 개발자"));
    assert.deepEqual(parsed, { question: q, job: "백엔드 개발자" });
  });
});
