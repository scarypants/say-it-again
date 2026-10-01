// 스피킹 처음 질문을 서버(LLM)에서 받는다 (docs/api.md 6절). 실패·빈 목록·시간 초과면 null → 화면이 가진 문항 데이터로 낸다
import { initialQuestions } from "../../api/client";
import type { InitialQuestionsRequest, Question } from "../../types/api";

export const QUESTION_WAIT_MS = 15000; // 이보다 오래 걸리면 기다리지 않고 문항 데이터로

export async function speakingQuestions(
  req: Extract<InitialQuestionsRequest, { mode: "speaking" }>,
  count: number,
): Promise<Question[] | null> {
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), QUESTION_WAIT_MS));
  const res = await Promise.race([initialQuestions(req).catch(() => null), timeout]);
  return res && res.questions.length === count ? res.questions : null;
}
