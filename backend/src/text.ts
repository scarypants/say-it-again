/** 단어 비교용 정규화: 소문자, 문장부호 제거 */
export function normalize(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
}

/** 한국어 끝 조사 (긴 것부터 비교) */
const KO_PARTICLE = /(에서는|에게서|으로는|이라고|에서|에게|한테|까지|부터|처럼|보다|으로|라고|이랑|은|는|이|가|을|를|에|의|도|로|와|과|랑)$/;

/**
 * 중복 비교용 어간: 정규화 후 한국어는 끝 조사를 뗀다 ("문제를", "문제는" → "문제").
 * 조사를 떼고 한 글자만 남으면 원래 단어를 쓴다 ("말로"는 그대로).
 */
export function stem(word: string): string {
  const w = normalize(word);
  if (!/[가-힣]$/.test(w)) return w;
  const s = w.replace(KO_PARTICLE, '');
  return s.length >= 2 ? s : w;
}

/** "필러" 뒤 조사 → "군말"(받침 있음)에 맞는 조사 */
const FILLER_PARTICLE: Record<string, string> = {
  가: '이',
  를: '을',
  는: '은',
  와: '과',
  랑: '이랑',
  라고: '이라고',
  라는: '이라는',
  라면: '이라면',
  라서: '이라서',
  예요: '이에요',
  였어요: '이었어요',
  였: '이었',
  야: '이야',
};

/**
 * LLM이 쓴 설명 글의 "필러"·"filler"를 화면 용어 "군말"로 바꾼다 (조사도 받침에 맞게: 필러가 → 군말이).
 * 프롬프트로도 지시하지만 LLM이 가끔 어기므로 코드에서 한 번 더 맞춘다. 대본(final, fixed)에는 쓰지 않는다.
 */
export function toScreenTerms(text: string): string {
  return text
    .replace(/필러(였어요|라고|라는|라면|라서|예요|가|를|는|와|랑|였|야)?/g, (_, p?: string) => `군말${p ? FILLER_PARTICLE[p] : ''}`)
    .replace(/\bfiller words?\b|\bfillers?\b/gi, '군말');
}
