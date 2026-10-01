import type { Line } from '../types/api';
import type { AnalyzeInput } from '../types/internal';

// LLM 프롬프트를 만드는 곳. 모드·level·시험별 지시문은 여기서만 바꾼다.

// 번호 붙은 스크립트 입력. 예) "[0] 0:오늘은 1:음 2:캠퍼스" / "[1] (침묵 3.2초)"
export function numberedScript(script: Line[]): string {
  return script
    .map((line, i) =>
      line.pause
        ? `[${i}] (침묵 ${(line.end - line.start).toFixed(1)}초)`
        : `[${i}] ${line.words.map((w, j) => `${j}:${w}`).join(' ')}`,
    )
    .join('\n');
}

export function buildPartPrompt(_input: AnalyzeInput, _script: Line[], _partIndex: number): string {
  throw new Error('TODO: 파트 분석 프롬프트');
}

export function buildSummaryPrompt(_input: AnalyzeInput): string {
  throw new Error('TODO: 총평 프롬프트');
}
