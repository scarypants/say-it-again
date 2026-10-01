// 면접 모의 연습 (#76): 질문 5개는 백엔드가 지원 직무에 맞춰 만든다 (POST /api/questions, kind: "initial")
// 순서: Q1 자기소개 → Q2 지원 동기 → Q3 직무 → Q4 경험 → Q5 마무리 (docs/api.md 6절)
import type { InterviewQuestionType, Mode, Question } from "../../types/api";

// 질문 화면에 한 문항씩 띄우는 질문. 재도전·꼬리질문은 prompt(질문 문자열)를 그대로 다시 보낸다
export type ExamItem = {
  type: string;
  text: string;
  prompt?: string; // 없으면 interviewQuestionText로 만든다
  label?: string; // 유형 표시 (없으면 interviewTypeName)
  context?: string; // 토익 Part 3 상황
  goalSec?: number; // 권장 답변 시간 (없으면 ANSWER_GOAL_SEC)
  prepSec?: number; // 질문을 듣고 답하기 전 준비 시간 (토익 연습 문제)
};

// 결과 화면에서 받은 꼬리질문 → 질문 화면 문항. 토익은 실제 시험의 준비·답변 시간을 쓴다
export function practiceItem(q: Question, mode: Mode): ExamItem {
  const label = isPresentationQna(q.prompt)
    ? "예상 질문"
    : mode === "interview"
      ? "꼬리질문"
      : q.part
        ? `Part ${q.part}`
        : (q.topic?.label ?? "연습 질문");
  // 실제 시험 시간: Part 3 준비 3초·답변 30초, Part 5 준비 45초·답변 60초
  const goalSec = q.part === 3 ? 30 : q.part === 5 ? 60 : undefined;
  const prepSec = q.part === 3 ? 3 : q.part === 5 ? 45 : undefined;
  return {
    type: q.type,
    text: q.text,
    prompt: q.prompt,
    label,
    context: q.context,
    goalSec,
    prepSec,
  };
}

// 발표 결과에서 받은 예상 질문인지 (질문 문자열 머리말 "Presentation Q&A N")
export function isPresentationQna(prompt?: string) {
  return !!prompt?.startsWith("Presentation Q&A");
}

export const ANSWER_GOAL_SEC = 60; // 권장 답변 시간 (면접 답변은 1분 안팎)
export const ANSWER_MAX_SEC = 120; // 넘으면 자동으로 다음 질문. 서버 상한이 답변당 2분
export const JOB_MAX_LENGTH = 50; // 지원 직무 입력 길이 상한

const TYPE_NAME: Record<InterviewQuestionType, string> = {
  intro: "자기소개",
  motivation: "지원 동기",
  job: "직무",
  experience: "경험",
  closing: "마무리",
};

const TYPE_EN: Record<InterviewQuestionType, string> = {
  intro: "Self-introduction",
  motivation: "Motivation",
  job: "Job knowledge",
  experience: "Past experience (STAR)",
  closing: "Closing",
};

// 화면 표시용 유형 이름. 서버가 모르는 유형을 보내도 화면은 깨지지 않게
export function interviewTypeName(type: string) {
  if (type === "followUp") return "꼬리질문";
  return TYPE_NAME[type as InterviewQuestionType] ?? "질문";
}

// 재도전: interviewQuestionText로 만든 문자열에서 질문·직무를 되살린다
// 꼬리질문 연습의 문자열("Interview Follow-up 1 (about Q4)")이면 유형은 followUp
export function parseInterviewQuestion(s: string): {
  question: { type: string; text: string };
  job: string;
} {
  const head = s.match(/^Interview Q\d+ \((.+)\)$/m)?.[1];
  const type = /^Interview Follow-up \d+/.test(s)
    ? "followUp"
    : ((Object.keys(TYPE_EN) as InterviewQuestionType[]).find((k) => TYPE_EN[k] === head) ?? "job");
  return {
    question: { type, text: s.match(/^Question: (.*)$/m)?.[1] ?? s },
    job: s.match(/^Job: (.*)$/m)?.[1] ?? "",
  };
}

// 분석(LLM)에 넘길 질문 문장. 유형·직무를 같이 적어 답변이 질문 의도와 직무에 맞는지 판단할 수 있게
export function interviewQuestionText(
  q: { type: string; text: string },
  index: number,
  job: string,
) {
  const type = TYPE_EN[q.type as InterviewQuestionType] ?? q.type;
  return `Interview Q${index + 1} (${type})\nJob: ${job}\nQuestion: ${q.text}`;
}
