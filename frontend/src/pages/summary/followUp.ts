// #102: 면접·오픽은 prompt, 토익은 settings.practice와 현재 질문의 일치로 구분한다.
export function isFollowUpSummary(questions?: string[], settings?: unknown) {
  if (!questions?.length) return false;
  if (questions.every((q) => /^(Interview Follow-up|OPIc Follow-up)\b/.test(q))) return true;
  if (
    typeof settings !== "object" || settings === null ||
    !("practice" in settings) || !Array.isArray(settings.practice)
  ) return false;
  const practice: unknown[] = settings.practice;
  return practice.length === questions.length && practice.every((q, index) => (
    typeof q === "object" && q !== null && "prompt" in q && q.prompt === questions[index]
  ));
}
