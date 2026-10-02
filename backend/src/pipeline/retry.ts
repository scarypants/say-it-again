import { RETRY_MATCH_LOW } from '../config';
import { summarizeRetry } from '../llm/requests';
import { bigramCoverage } from '../text';
import type { Analysis, Compare, CompareStats, Part, RetryPrevious, RetryResponse } from '../types/api';
import type { RetryInput } from '../types/internal';
import { analyzeByCode } from './analyze';
import { flattenWords } from './script';
import { buildCharts, buildStats, habitScore } from './stats';
import { checkDurations } from './transcribe';

/**
 * 재도전("다시, 말해"): 다시 녹음한 대본 → 코드 분석(패닉존, 필러, 중복) → 전후 비교 → 재도전 총평 LLM 1회
 * 파트별 LLM은 부르지 않는다. LLM이 실패해도 코드 결과와 compare는 그대로 돌려준다.
 */
export async function retry(input: RetryInput): Promise<RetryResponse> {
  checkDurations(input, input.parts.map((p) => p.duration));

  const warnings: string[] = [];
  const parts: Part[] = input.parts.map(({ duration, script: edited }) => {
    const { script, codeHighlight } = analyzeByCode(edited, input.language);
    return { duration, script, highlight: codeHighlight, final: [] };
  });

  const charts = buildCharts(parts);
  const { score, stats } = buildStats(parts, charts);
  const durationSec = parts.reduce((sum, p) => sum + p.duration, 0);

  const scriptMatch = matchRate(input.previous.final, parts);
  const mismatch = scriptMatch !== null && scriptMatch < RETRY_MATCH_LOW;
  if (mismatch) warnings.push('script_mismatch');

  const compare: Compare = {
    scriptMatch,
    before: beforeStats(input.previous),
    after: compareStats(score, durationSec, stats),
  };

  let result: RetryResponse['retry'];
  try {
    result = await summarizeRetry(input, parts, charts, compare, mismatch);
  } catch (err) {
    console.error('[llm] 재도전 총평 실패', err);
    warnings.push('llm_failed');
  }

  return {
    mode: input.mode,
    level: input.level,
    exam: input.exam,
    language: input.language,
    parts,
    charts,
    analysis: {
      score,
      stats,
      // 기존 총평 컴포넌트가 깨지지 않도록 retry 내용으로 채운다
      summary: result
        ? { headline: result.comment, topPriorities: result.remaining, comment: '' }
        : { headline: '', topPriorities: [], comment: '' },
    },
    compare,
    ...(result && { retry: result }),
    ...(warnings.length > 0 && { warnings }),
  };
}

/**
 * 이전 결과의 수치. 점수는 previous.stats가 아니라 categoryRatio로 다시 계산한다:
 * 예전 기준(expression·grammar까지 감점)으로 저장된 기록이 와도 지금과 같은 기준으로 비교되도록.
 */
function beforeStats(previous: RetryPrevious): CompareStats {
  return compareStats(habitScore(previous.categoryRatio), previous.durationSec, previous.stats);
}

function compareStats(score: number, durationSec: number, stats: Analysis['stats']): CompareStats {
  const perMin = (count: number) => (durationSec > 0 ? round1((count / durationSec) * 60) : 0);
  return {
    score,
    durationSec: round1(durationSec),
    wpm: stats.wpm,
    fillerCount: stats.fillerCount,
    panicCount: stats.panicCount,
    panicTotalSec: stats.panicTotalSec,
    repeatCount: stats.repeatCount,
    fillerPerMin: perMin(stats.fillerCount),
    panicPerMin: perMin(stats.panicCount),
    repeatPerMin: perMin(stats.repeatCount),
  };
}

/** 대본 일치율(0~100): 이전 최종 대본 기준 bigram 일치율. 기준이 이전 대본이라 일부만 읽으면 낮게 나온다 */
function matchRate(final: RetryPrevious['final'], parts: Part[]): number | null {
  return bigramCoverage(
    final.flatMap((s) => s.words),
    parts.flatMap((p) => flattenWords(p.script)),
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
