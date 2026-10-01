import type { Highlight, Language, Line } from '../types/api';

// 사전(dict/fillers.ts)으로 필러를 찾아 filler 하이라이트로 돌려준다.
// reason은 "군말입니다", fixed는 "" (삭제 권장)로 채운다.
export function findFillers(_script: Line[], _language: Language): Highlight[] {
  throw new Error('TODO: 필러 탐지');
}
