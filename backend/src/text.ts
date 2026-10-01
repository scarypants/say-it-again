// 단어 비교용 정규화: 소문자, 문장부호 제거
export function normalize(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
}

// 한국어 끝 조사 (긴 것부터 비교)
const KO_PARTICLE = /(에서는|에게서|으로는|이라고|에서|에게|한테|까지|부터|처럼|보다|으로|라고|이랑|은|는|이|가|을|를|에|의|도|로|와|과|랑)$/;

// 중복 비교용 어간: 정규화 후 한국어는 끝 조사를 뗀다 ("문제를", "문제는" → "문제").
// 조사를 떼고 한 글자만 남으면 원래 단어를 쓴다 ("말로"는 그대로).
export function stem(word: string): string {
  const w = normalize(word);
  if (!/[가-힣]$/.test(w)) return w;
  const s = w.replace(KO_PARTICLE, '');
  return s.length >= 2 ? s : w;
}
