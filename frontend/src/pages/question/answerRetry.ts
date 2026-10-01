// 서버 422 문구("2번째 녹음에서 음성이 감지되지 않았습니다.")의 순번은 보낸 답변 중 몇 번째인지다.
// 건너뛴 문항은 보내지 않으므로, 녹음이 있는 문항만 세어 원래 문항 번호(0부터)로 바꾼다
export function failedAnswerIndex(error: string | null, answers: unknown[]): number | null {
  const n = Number(error?.match(/(\d+)번째 녹음/)?.[1]);
  if (!n) return null;
  let seen = 0;
  for (let i = 0; i < answers.length; i++) {
    if (answers[i] && ++seen === n) return i;
  }
  return null;
}
