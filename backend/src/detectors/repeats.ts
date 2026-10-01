import type { Highlight, Line } from '../types/api';

// TODO(중복 단어 이슈): 5줄 윈도우에서 같은 어간이 3회 이상이면 repeat 하이라이트로 돌려준다.
// 아직 구현 전이라 빈 배열을 돌려준다.
export function findRepeats(_script: Line[]): Highlight[] {
  return [];
}
