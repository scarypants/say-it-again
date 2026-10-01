import { findFillers } from '../detectors/fillers';
import { findPanics } from '../detectors/panics';
import { findRepeats } from '../detectors/repeats';
import { analyzePart, summarize } from '../llm/requests';
import type { AnalyzeResponse, Part } from '../types/api';
import type { AnalyzeInput } from '../types/internal';
import { toWords, withOffsets } from './script';
import { buildCharts, buildStats } from './stats';
import { checkDurations } from './transcribe';

/**
 * 2단계: 사용자가 고친 대본 → 코드 분석 → 파트별 LLM → 총평 LLM → 합산
 * LLM이 실패해도 코드가 만든 결과(대본, 패닉존, 필러, 통계)는 그대로 돌려준다.
 */
export async function analyze(input: AnalyzeInput): Promise<AnalyzeResponse> {
  checkDurations(input, input.parts.map((p) => p.duration));

  const warnings: string[] = [];
  const warn = (code: string) => {
    if (!warnings.includes(code)) warnings.push(code);
  };

  // 파트별 코드 분석 + 파트별 LLM (병렬)
  const parts: Part[] = await Promise.all(
    input.parts.map(async ({ duration, script: edited }, i) => {
      const script = withOffsets(edited); // 단어를 고쳤으면 단어 수가 바뀌므로 offset을 다시 계산
      const words = toWords(script);
      const panics = findPanics(script);
      const codeHighlight = [
        ...panics.map((p) => p.highlight),
        ...findFillers(words, input.language),
        ...findRepeats(script, input.language),
      ];
      try {
        const llm = await analyzePart(input, script, i);
        // 코드가 만든 panic 하이라이트에 LLM의 원인·대안을 채운다 (pause 줄 번호로 매칭)
        for (const panic of panics) {
          const note = llm.panicNotes.get(panic.line);
          if (note) Object.assign(panic.highlight, note);
        }
        return {
          comment: input.mode === 'speaking' ? llm.comment : undefined,
          duration,
          script,
          highlight: [...codeHighlight, ...llm.highlight],
          final: llm.final,
        };
      } catch (err) {
        console.error(`[llm] ${i + 1}번째 파트 분석 실패`, err);
        warn('llm_failed');
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
    console.error('[llm] 총평 실패', err);
    warn('llm_failed');
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
