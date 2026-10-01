// 오픽 모의시험: data/opic/*.json(문항 데이터)으로 문제 5개를 만든다.
// 실제 시험 순서를 줄인 것: Q1 자기소개 → Q2~4 서베이 주제 콤보(묘사 → 루틴 → 과거 경험) → Q5 롤플레이
import intro from "./data/opic/intro.json";
import rolePlays from "./data/opic/rolePlays.json";
import selfAssessment from "./data/opic/selfAssessment.json";
import survey from "./data/opic/survey.json";
import type { Question } from "../../types/api";

export type SurveyTopic = {
  id: string;
  label: string; // 화면 표시용 한글 이름
  group: string;
  description: string[];
  routine: string[];
  experience: string[];
};

export type RolePlay = {
  id: string;
  label: string;
  ask: string; // 실제 11번: 상대에게 질문 3~4개
  solve: string; // 실제 12번: 문제 상황 설명 + 대안 제시
  experience: string; // 실제 13번: 비슷한 경험
};

export type OpicQuestionType =
  "intro" | "description" | "routine" | "experience" | "rolePlayAsk" | "rolePlaySolve";

export type OpicItem = {
  type: OpicQuestionType;
  name: string; // 화면 표시용 유형 이름
  topic?: { id: string; label: string };
  text: string; // Ava가 읽어 주는 질문
  prompt?: string; // 서버가 만든 질문 문자열. 있으면 분석에 그대로 보낸다
};

// JSON 형식이 타입과 다르면 여기서 빌드가 깨진다
export const SURVEY_TOPICS: SurveyTopic[] = survey.topics;
export const ROLE_PLAYS: RolePlay[] = rolePlays.situations;
export const SELF_LEVELS: { level: number; desc: string }[] = selfAssessment.levels;
const INTRO_QUESTIONS: string[] = intro.questions;

export const ANSWER_GOAL_SEC = 90; // 권장 답변 시간 (실제 시험은 2분 안팎)
export const ANSWER_MAX_SEC = 120; // 넘으면 자동으로 다음 문제. 서버 상한이 답변당 2분 (docs/api.md)
export const REPLAY_WINDOW_SEC = 5; // 처음 들은 뒤 이 시간 안에 한 번 더 들을 수 있다
export const HARD_LEVEL = 5; // 이 단계 이상이면 롤플레이가 문제 해결형

const TYPE_EN: Record<OpicQuestionType, string> = {
  intro: "Self-introduction",
  description: "Description",
  routine: "Routine",
  experience: "Past experience",
  rolePlayAsk: "Role-play: ask the interviewer 3-4 questions",
  rolePlaySolve: "Role-play: explain the problem and suggest alternatives",
};

function pick<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

// topicIds: 서베이에서 고른 주제. 그중 하나를 골라 콤보 3문항을 같은 주제로 묻는다
export function buildOpicExam(topicIds: string[], level: number): OpicItem[] {
  const chosen = SURVEY_TOPICS.filter((t) => topicIds.includes(t.id));
  const topic = pick(chosen.length ? chosen : SURVEY_TOPICS);
  const t = { id: topic.id, label: topic.label };
  const rp = pick(ROLE_PLAYS);
  const rpTopic = { id: rp.id, label: rp.label };

  return [
    { type: "intro", name: "자기소개", text: pick(INTRO_QUESTIONS) },
    { type: "description", name: "묘사", topic: t, text: pick(topic.description) },
    { type: "routine", name: "루틴", topic: t, text: pick(topic.routine) },
    { type: "experience", name: "과거 경험", topic: t, text: pick(topic.experience) },
    level >= HARD_LEVEL
      ? { type: "rolePlaySolve", name: "롤플레이 (문제 해결)", topic: rpTopic, text: rp.solve }
      : { type: "rolePlayAsk", name: "롤플레이 (질문하기)", topic: rpTopic, text: rp.ask },
  ];
}

const TYPE_NAME: Record<OpicQuestionType, string> = {
  intro: "자기소개",
  description: "묘사",
  routine: "루틴",
  experience: "과거 경험",
  rolePlayAsk: "롤플레이 (질문하기)",
  rolePlaySolve: "롤플레이 (문제 해결)",
};

// 서버가 만든 질문(POST /api/questions) → 시험 문항
export function opicItemFromServer(q: Question): OpicItem {
  const type = (q.type in TYPE_NAME ? q.type : "description") as OpicQuestionType;
  return { type, name: TYPE_NAME[type], topic: q.topic, text: q.text, prompt: q.prompt };
}

// 백엔드(LLM)에 넘길 질문 문장. 유형과 난이도를 같이 적어 답변이 질문에 맞는지 판단할 수 있게
export function opicQuestionText(item: OpicItem, index: number, level: number) {
  if (item.prompt) return item.prompt;
  const head = `OPIc Q${index + 1} (${TYPE_EN[item.type]}${item.topic ? `, topic: ${item.topic.id}` : ""})`;
  return `${head}\nSelf-assessment level: ${level}\nQuestion: ${item.text}`;
}
