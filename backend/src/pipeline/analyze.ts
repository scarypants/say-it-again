import type { AnalyzeResponse, Part } from '../types/api';
import type { AnalyzeInput } from '../types/internal';
import { findFillers } from '../detectors/fillers';
import { analyzePart, summarize } from '../llm/requests';
import { findRepeats } from '../detectors/repeats';
import { splitLines } from './script';
import { buildCharts, buildStats } from './stats';
import { transcribe } from './stt';

// 분석 파이프라인: STT → 코드 분석 → 파트별 LLM → 총평 LLM → 합산
export async function analyze(input: AnalyzeInput): Promise<AnalyzeResponse> {
  const warnings: string[] = [];

  // 녹음마다 병렬 STT
  const transcripts = await Promise.all(input.audio.map((file) => transcribe(file, input.language)));

  // 파트별 코드 분석 + 파트별 LLM (병렬)
  const parts: Part[] = await Promise.all(
    transcripts.map(async ({ words, duration }, i) => {
      const script = splitLines(words);
      const codeHighlight = [...findFillers(script, input.language), ...findRepeats(script)];
      try {
        const llm = await analyzePart(input, script, i);
        return {
          comment: input.mode === 'speaking' ? llm.comment : undefined,
          duration,
          script,
          highlight: [...codeHighlight, ...llm.highlight],
          final: llm.final,
        };
      } catch (err) {
        console.error(err);
        if (!warnings.includes('llm_failed')) warnings.push('llm_failed');
        return { duration, script, highlight: codeHighlight, final: [] };
      }
    }),
  );

  const charts = buildCharts(parts);
  const { score, stats } = buildStats(parts, charts);

  let summary = { headline: '', topPriorities: [] as string[], comment: '' };
  try {
    summary = await summarize(input, parts);
  } catch (err) {
    console.error(err);
    if (!warnings.includes('llm_failed')) warnings.push('llm_failed');
  }

  return {
    mode: input.mode,
    level: input.level,
    exam: input.exam,
    language: input.language,
    parts,
    charts,
    analysis: { score, stats, summary },
    ...(warnings.length > 0 && { warnings }),
  };
}
