// 면접 모의 연습: 질문 은행에서 5문제를 만든다 (#76)
// 순서: Q1 자기소개 → Q2~4 공통 질문(지원 동기·경험·강점 등) 중 3개 → Q5 마무리
import type { Lang } from "../../types/api";

export type InterviewQuestionType =
  | "intro"
  | "motivation"
  | "experience"
  | "personality"
  | "closing";

export type InterviewItem = {
  type: InterviewQuestionType;
  name: string; // 화면 표시용 유형 이름
  text: string; // 화면에 보여 주는 질문 (답변 언어로)
};

export const PREP_SEC = 15; // 질문을 보고 생각할 시간. 지나면 신호음과 함께 녹음
export const ANSWER_GOAL_SEC = 60; // 권장 답변 시간 (면접 답변은 1분 안팎)
export const ANSWER_MAX_SEC = 120; // 넘으면 자동으로 다음 질문. 서버 상한이 답변당 2분

const TYPE_NAME: Record<InterviewQuestionType, string> = {
  intro: "자기소개",
  motivation: "지원 동기",
  experience: "경험",
  personality: "인성",
  closing: "마무리",
};

const TYPE_EN: Record<InterviewQuestionType, string> = {
  intro: "Self-introduction",
  motivation: "Motivation",
  experience: "Past experience (STAR)",
  personality: "Personality",
  closing: "Closing",
};

type Bank = Record<InterviewQuestionType, string[]>;

const BANK: Record<Lang, Bank> = {
  ko: {
    intro: ["1분 동안 자기소개를 해 주세요.", "간단하게 본인을 소개해 주세요."],
    motivation: [
      "우리 회사에 지원한 동기가 무엇인가요?",
      "이 직무를 선택한 이유는 무엇인가요?",
      "입사 후 5년 뒤 어떤 모습이 되고 싶나요?",
    ],
    experience: [
      "팀 프로젝트에서 갈등이 생겼을 때 어떻게 해결했는지 말해 주세요.",
      "가장 크게 실패했던 경험과 그 경험에서 배운 점을 말해 주세요.",
      "어려운 목표를 끝까지 해낸 경험이 있다면 말해 주세요.",
      "다른 사람을 설득해 본 경험을 말해 주세요.",
    ],
    personality: [
      "본인의 장점과 단점을 하나씩 말해 주세요.",
      "스트레스를 받을 때 어떻게 관리하나요?",
      "주변 사람들은 당신을 어떤 사람이라고 말하나요?",
    ],
    closing: ["마지막으로 하고 싶은 말이 있나요?", "저희에게 궁금한 점이 있나요?"],
  },
  en: {
    intro: ["Please introduce yourself in about one minute.", "Tell me about yourself."],
    motivation: [
      "Why did you apply for this position?",
      "Why do you want to work for our company?",
      "Where do you see yourself in five years?",
    ],
    experience: [
      "Tell me about a time you had a conflict with a teammate and how you resolved it.",
      "Describe your biggest failure and what you learned from it.",
      "Tell me about a time you achieved a difficult goal.",
      "Tell me about a time you persuaded someone to see things your way.",
    ],
    personality: [
      "What are your greatest strength and weakness?",
      "How do you handle stress and pressure?",
      "How would your friends describe you?",
    ],
    closing: [
      "Is there anything else you would like to tell us?",
      "Do you have any questions for us?",
    ],
  },
};

function pick<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const item = (type: InterviewQuestionType, text: string): InterviewItem => ({
  type,
  name: TYPE_NAME[type],
  text,
});

export function buildInterview(language: Lang): InterviewItem[] {
  const bank = BANK[language];
  // 가운데 세 문제: 지원 동기 1 + 경험 1 + (경험·인성 중 하나) 를 섞어서
  const experience = shuffle(bank.experience);
  const middle = shuffle([
    item("motivation", pick(bank.motivation)),
    item("experience", experience[0]),
    Math.random() < 0.5
      ? item("experience", experience[1])
      : item("personality", pick(bank.personality)),
  ]);
  return [item("intro", pick(bank.intro)), ...middle, item("closing", pick(bank.closing))];
}

// 백엔드(LLM)에 넘길 질문 문장. 유형을 같이 적어 답변이 질문 의도에 맞는지 판단할 수 있게
export function interviewQuestionText(it: InterviewItem, index: number) {
  return `Interview Q${index + 1} (${TYPE_EN[it.type]})\nQuestion: ${it.text}`;
}
