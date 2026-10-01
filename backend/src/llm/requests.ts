import type { Analysis, Line, Part } from '../types/api';
import type { AnalyzeInput, LlmPartResult } from '../types/internal';

// 파트 하나에 대해 panic / expression / grammar 하이라이트, 최종 대본, 코멘트를 받는다.
export async function analyzePart(
  _input: AnalyzeInput,
  _script: Line[],
  _partIndex: number,
): Promise<LlmPartResult> {
  throw new Error('TODO: 파트별 LLM 호출');
}

// 파트별 결과의 요약본으로 전체 총평(summary)을 받는다.
export async function summarize(_input: AnalyzeInput, _parts: Part[]): Promise<Analysis['summary']> {
  throw new Error('TODO: 총평 LLM 호출');
}
