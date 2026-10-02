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
  if (habit === null || accuracy === null) return null;
  // 정확성 비중 (스피킹 0.5, 면접 0.7). 옛 응답에는 없어서 0.5로 본다
  const w = "accuracyWeight" in detail ? detail.accuracyWeight : undefined;
  const accuracyWeight = typeof w === "number" && w > 0 && w < 1 ? w : 0.5;
  return { habit, accuracy, accuracyWeight };
}

export function partAccuracy(part: unknown) {
  return part && typeof part === "object" && "accuracy" in part ? accuracyScore(part.accuracy) : null;
}
