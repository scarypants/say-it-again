import { RETRY_MATCH_LOW } from '../config';
import { summarizeRetry } from '../llm/requests';
import { normalize } from '../text';
import type { Analysis, Compare, CompareStats, Part, RetryPrevious, RetryResponse } from '../types/api';
import type { RetryInput } from '../types/internal';
import { analyzeByCode } from './analyze';
import { flattenWords } from './script';
import { buildCharts, buildStats } from './stats';
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
 * 이전 결과를 같은 기준으로 다시 계산한다.
 * 이전 점수는 expression·grammar까지 감점된 값이다. 우선순위상 panic·filler·repeat 비율은 그대로이므로
 * expression·grammar 비율을 normal에 돌려 더하면 패닉·필러·중복만 반영한 점수가 된다.
 */
function beforeStats(previous: RetryPrevious): CompareStats {
  const { normal, expression, grammar } = previous.categoryRatio;
  const score = Math.min(100, Math.max(0, normal + expression + grammar));
  return compareStats(score, previous.durationSec, previous.stats);
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

/**
 * 대본 일치율(0~100): 이전 최종 대본의 두 글자 묶음(bigram) 중 새 녹음에도 있는 것의 비율.
 * 공백·문장부호를 지우고 이어 붙여 비교하므로 띄어쓰기·조사 차이에 덜 민감하다.
 * 같은 bigram은 새 녹음에 나온 횟수만큼만 센다. 기준이 이전 대본이라 일부만 읽으면 낮게 나온다.
 */
function matchRate(final: RetryPrevious['final'], parts: Part[]): number | null {
  const target = bigrams(final.flatMap((s) => s.words));
  if (target.length === 0) return null;

  const spoken = new Map<string, number>();
  for (const b of bigrams(parts.flatMap((p) => flattenWords(p.script)))) {
    spoken.set(b, (spoken.get(b) ?? 0) + 1);
  }
  let matched = 0;
  for (const b of target) {
    const left = spoken.get(b) ?? 0;
    if (left > 0) {
      matched++;
      spoken.set(b, left - 1);
    }
  }
  return Math.round((matched / target.length) * 100);
}

function bigrams(words: string[]): string[] {
  const chars = [...words.map(normalize).join('')];
  return chars.slice(1).map((c, i) => chars[i] + c);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
