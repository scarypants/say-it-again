// 단어 비교용 정규화: 소문자, 문장부호 제거
export function normalize(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
}
