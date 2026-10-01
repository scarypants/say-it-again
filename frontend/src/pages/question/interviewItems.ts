// 면접 모의 연습 (#76): 질문 5개는 백엔드가 지원 직무에 맞춰 만든다 (POST /api/interview/questions)
// 순서: Q1 자기소개 → Q2~4 지원 동기·직무·경험·인성 → Q5 마무리
import type { InterviewQuestion, InterviewQuestionType } from "../../types/api";

export const ANSWER_GOAL_SEC = 60; // 권장 답변 시간 (면접 답변은 1분 안팎)
export const ANSWER_MAX_SEC = 120; // 넘으면 자동으로 다음 질문. 서버 상한이 답변당 2분
export const JOB_MAX_LENGTH = 50; // 지원 직무 입력 길이 상한

const TYPE_NAME: Record<InterviewQuestionType, string> = {
  intro: "자기소개",
  motivation: "지원 동기",
  job: "직무",
  experience: "경험",
  personality: "인성",
  closing: "마무리",
};

const TYPE_EN: Record<InterviewQuestionType, string> = {
  intro: "Self-introduction",
  motivation: "Motivation",
  job: "Job knowledge",
  experience: "Past experience (STAR)",
  personality: "Personality",
  closing: "Closing",
};

// 화면 표시용 유형 이름. 서버가 모르는 유형을 보내도 화면은 깨지지 않게
export function interviewTypeName(type: string) {
  return TYPE_NAME[type as InterviewQuestionType] ?? "질문";
}

// 분석(LLM)에 넘길 질문 문장. 유형·직무를 같이 적어 답변이 질문 의도와 직무에 맞는지 판단할 수 있게
export function interviewQuestionText(q: InterviewQuestion, index: number, job: string) {
  const type = TYPE_EN[q.type as InterviewQuestionType] ?? q.type;
  return `Interview Q${index + 1} (${type})\nJob: ${job}\nQuestion: ${q.text}`;
}
