import type { AnalyzeResponse, CompareStats } from "../../types/api";
import { totalDuration } from "../../components/common/scriptFormat";
import { isInterview } from "../../store/analysis";

type ComparisonStats = CompareStats & {
  durationSec?: number;
  fillerPerMin?: number;
  panicPerMin?: number;
  repeatPerMin?: number;
};

export function comparisonValues(result: AnalyzeResponse, previous: AnalyzeResponse | null) {
  if (result.compare) return { before: result.compare.before, after: result.compare.after };
  if (!previous) return null;
  const fill = (source: AnalyzeResponse, stats?: ComparisonStats) => {
    const durationSec = stats?.durationSec ?? totalDuration(source.parts);
    const counts = { ...source.analysis.stats, ...stats };
    const rate = (value: number) => durationSec > 0 ? Math.round(value / durationSec * 600) / 10 : Number.NaN;
    const ratio = source.charts.categoryRatio;
    return {
      ...counts,
      score: stats?.score ?? ratio.normal + ratio.expression + ratio.grammar,
      durationSec,
      fillerPerMin: stats?.fillerPerMin ?? rate(counts.fillerCount),
      panicPerMin: stats?.panicPerMin ?? rate(counts.panicCount),
      repeatPerMin: stats?.repeatPerMin ?? rate(counts.repeatCount),
    };
  };
  return { before: fill(previous), after: fill(result) };
}

// retry의 final은 비어 있으므로 다음 재도전에도 기존 대안 대본을 유지한다.
export function retryReference(result: AnalyzeResponse, previous: AnalyzeResponse | null) {
  const baseline = comparablePrevious(result, previous);
  if (result.parts.some((part) => part.final.length) || !baseline) return result;
  if (isInterview(result)) {
    return { ...result, parts: result.parts.map((part, index) => ({
      ...part, final: baseline.parts[index]?.final ?? [],
    })) };
  }
  const final = baseline.parts.flatMap((part) => part.final);
  if (!final.length) return result;
  return { ...result, parts: result.parts.map((part, index) => ({ ...part, final: index === 0 ? final : [] })) };
}

export function comparablePrevious(result: AnalyzeResponse, previous: AnalyzeResponse | null) {
  if (!previous || previous.mode !== result.mode || previous.language !== result.language) return null;
  return isInterview(result) || (result.mode === "presentation" && previous.level === result.level)
    ? previous
    : null;
}
