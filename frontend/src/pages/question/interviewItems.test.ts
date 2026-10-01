/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import type { InterviewQuestionType } from "../../types/api";
import { partTitle, questionLine } from "../../components/common/scriptFormat";
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

// 건너뛴 뒤에도 검토·대본 화면의 질문 번호는 원래 번호 그대로
test("파트 제목은 질문 문자열의 원래 번호를 쓴다", () => {
  const q4 = interviewQuestionText(
    { type: "experience", text: "경험을 말해 주세요." },
    3,
    "마케터",
  );
  assert.equal(partTitle("interview", 1, 30, q4), "질문 4");
  assert.equal(partTitle("speaking", 0, 30, "TOEIC Speaking Part 1 (지문 읽기)"), "질문 1");
  assert.equal(partTitle("presentation", 1, 14), "05:00 – 05:14");
});

test("꼬리질문 연습 문자열: 제목·유형·질문 한 줄", () => {
  const q = "Interview Follow-up 2 (about Q4)\nJob: 백엔드 개발자\nQuestion: 그때 무엇을 직접 했나요?";
  assert.equal(partTitle("interview", 0, 30, q), "꼬리질문 2");
  assert.equal(questionLine(q), "그때 무엇을 직접 했나요?");
  assert.deepEqual(parseInterviewQuestion(q), {
    question: { type: "followUp", text: "그때 무엇을 직접 했나요?" },
    job: "백엔드 개발자",
  });
  assert.equal(questionLine("OPIc Follow-up 1 (topic: 사는 곳)\nWhat changed?"), "What changed?");
  assert.equal(questionLine("TOEIC Speaking Part 1 (지문 읽기)\nText to read aloud: Hi"), "TOEIC Speaking Part 1 (지문 읽기)");
});
