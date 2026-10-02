import { RETRY_MATCH_LOW } from '../config';
import { requestAccuracy, summarizeRetry } from '../llm/requests';
import { accuracyWeight } from '../modes';
import { bigramCoverage } from '../text';
import type { Analysis, Compare, CompareStats, Part, RetryPrevious, RetryResponse } from '../types/api';
import type { RetryInput } from '../types/internal';
import { analyzeByCode, averageAccuracy, readAloudAccuracy } from './analyze';
import { flattenWords } from './script';
import { buildCharts, buildStats, combinedScore, habitScore } from './stats';
import { checkDurations } from './transcribe';

/**
 * 재도전("다시, 말해"): 다시 녹음한 대본 → 코드 분석(패닉존, 필러, 중복) → (정확성 채점) → 전후 비교 → 재도전 총평 LLM 1회
 * 파트별 전체 분석 LLM은 부르지 않는다. previous.accuracy가 오면(스피킹·면접·발표 질의응답) 파트마다 정확성만 가볍게 다시 매겨
 * analyze와 같은 공식의 총점으로 비교한다. LLM이 실패해도 코드 결과와 compare(습관 점수 비교)는 그대로 돌려준다.
 */
export async function retry(input: RetryInput): Promise<RetryResponse> {
  checkDurations(input, input.parts.map((p) => p.duration));

  const warnings: string[] = [];
  const warn = (code: string) => {
    if (!warnings.includes(code)) warnings.push(code);
  };
  const parts: Part[] = input.parts.map(({ duration, script: edited }) => {
    const { script, codeHighlight } = analyzeByCode(edited, input.language);
    return { duration, script, highlight: codeHighlight, final: [] };
  });

  // 정확성: 이전 정확성을 받았을 때만 다시 매긴다 (없으면 양쪽 모두 습관 점수로 비교해야 공정하다)
  const weight = accuracyWeight(input);
  const previousAccuracy = input.previous.accuracy;
  if (weight !== undefined && previousAccuracy !== undefined) {
    await Promise.all(
      parts.map(async (part, i) => {
        try {
          part.accuracy = readAloudAccuracy(input, part.script, i) ?? (await requestAccuracy(input, part.script, i));
        } catch (err) {
          console.error(`[llm] ${i + 1}번째 파트 정확성 채점 실패`, err);
          warn('llm_failed');
        }
      }),
    );
  }

  const charts = buildCharts(parts);
  const { score: habit, stats } = buildStats(parts, charts);
  const durationSec = parts.reduce((sum, p) => sum + p.duration, 0);

  const accuracy = averageAccuracy(parts);
  const scoreDetail =
    weight !== undefined && previousAccuracy !== undefined && accuracy !== undefined
      ? { habit, accuracy, accuracyWeight: weight }
      : undefined;

  const scriptMatch = matchRate(input.previous.final, parts);
  const mismatch = scriptMatch !== null && scriptMatch < RETRY_MATCH_LOW;
  if (mismatch) warn('script_mismatch');

  const before = beforeStats(input.previous);
  const after = compareStats(habit, durationSec, stats);
  if (scoreDetail && previousAccuracy !== undefined) {
    Object.assign(before, withAccuracy(before.score, previousAccuracy, scoreDetail.accuracyWeight));
    Object.assign(after, withAccuracy(habit, scoreDetail.accuracy, scoreDetail.accuracyWeight));
  }
  const compare: Compare = { scriptMatch, before, after };

  let result: RetryResponse['retry'];
  try {
    result = await summarizeRetry(input, parts, charts, compare, mismatch);
  } catch (err) {
    console.error('[llm] 재도전 총평 실패', err);
    warn('llm_failed');
  }

  return {
    mode: input.mode,
    level: input.level,
    exam: input.exam,
    language: input.language,
    parts,
    charts,
    analysis: {
      score: after.score,
      ...(scoreDetail && { scoreDetail }),
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

/** 정확성까지 비교할 때: 습관 점수 + 정확성 → analyze와 같은 공식의 총점 */
function withAccuracy(habit: number, accuracy: number, weight: number): Pick<CompareStats, 'score' | 'habit' | 'accuracy'> {
  return { score: combinedScore(habit, accuracy, weight), habit, accuracy };
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
