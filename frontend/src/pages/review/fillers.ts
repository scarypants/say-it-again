// 고치면 안 되는 말버릇. 백엔드가 "확실한 군말"로 보는 것과 같다 (docs/api.md 4절 규칙)
const FILLERS = new Set(["어", "음", "엄", "um", "uh", "umm", "uhm", "er", "erm", "hmm"]);

export function isFillerWord(word: string) {
  return FILLERS.has(word.toLowerCase().replace(/[.,!?…~]+$/u, ""));
}
