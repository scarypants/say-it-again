import type { Highlight, Line } from '../types/api';

// 5줄 윈도우에서 같은 어간이 3회 이상이면 repeat 하이라이트로 돌려준다.
export function findRepeats(_script: Line[]): Highlight[] {
  throw new Error('TODO: 중복 단어 탐지');
}
