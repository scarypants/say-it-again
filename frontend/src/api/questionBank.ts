import type { Exam } from "../types/api";

// 서버 질문 생성이 안 될 때 쓰는 기본 질문 (시험별 5개)
export const QUESTION_BANK: Record<Exam, string[]> = {
  toss: [
    "Describe your favorite place on campus and explain why you like it.",
    "What is the best way for university students to manage stress? Give specific reasons.",
    "Some students prefer studying alone, while others prefer studying in groups. Which do you prefer and why?",
    "A new student asks you for advice about the school cafeteria. What would you tell them?",
    "Should universities offer more online classes? Why or why not?",
  ],
  opic: [
    "Please introduce yourself in as much detail as possible.",
    "Tell me about the place where you live. What does it look like, and what do you like about it?",
    "Describe a typical day at your school, from morning to evening.",
    "Tell me about a memorable trip you took. Where did you go, and what happened?",
    "What do you usually do in your free time? How did you first get interested in it?",
  ],
};

// 시험별 답변 제한 시간(초). 토스는 문항당 최대 60초, 오픽은 2분 안팎을 권장
export const ANSWER_SEC: Record<Exam, number> = { toss: 60, opic: 120 };
