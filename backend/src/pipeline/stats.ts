import type { Analysis, Charts, Part } from '../types/api';

// 모든 파트를 합쳐 차트 데이터를 만든다 (categoryRatio는 단어 기준, 우선순위로 하나만 센다).
export function buildCharts(_parts: Part[]): Charts {
  throw new Error('TODO: 차트 집계');
}

// score = categoryRatio.normal 반올림. wpm은 침묵을 뺀 발화 시간 기준.
export function buildStats(_parts: Part[], _charts: Charts): Pick<Analysis, 'score' | 'stats'> {
  throw new Error('TODO: 통계 계산');
}
