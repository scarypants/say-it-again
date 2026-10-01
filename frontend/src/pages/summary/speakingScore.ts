// 정확성은 선택 필드다. 이전 기록·LLM 실패·잘못된 값에서는 점수를 만들지 않는다.
export function accuracyScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;
}

export function speakingScoreDetail(analysis: unknown) {
  if (!analysis || typeof analysis !== "object" || !("scoreDetail" in analysis)) return null;
  const detail = analysis.scoreDetail;
  if (!detail || typeof detail !== "object" || !("habit" in detail) || !("accuracy" in detail)) return null;
  const habit = accuracyScore(detail.habit);
  const accuracy = accuracyScore(detail.accuracy);
  return habit === null || accuracy === null ? null : { habit, accuracy };
}

export function partAccuracy(part: unknown) {
  return part && typeof part === "object" && "accuracy" in part ? accuracyScore(part.accuracy) : null;
}
