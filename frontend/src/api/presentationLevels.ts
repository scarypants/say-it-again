import type { PresentationLevel } from "../types/api";

// 발표 수준: 홈에서 고르고, 백엔드(LLM)가 이 기준에 맞춰 진단한다
export const PRESENTATION_LEVELS: { value: PresentationLevel; label: string }[] = [
  { value: "assignment", label: "과제 발표" },
  { value: "exam", label: "시험 발표" },
  { value: "keynote", label: "큰 강연" },
];

export const LEVEL_LABEL = Object.fromEntries(
  PRESENTATION_LEVELS.map((l) => [l.value, l.label]),
) as Record<PresentationLevel, string>;
