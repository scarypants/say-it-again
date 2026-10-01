import { GRACE_SEC, MAX_AUDIO_SEC } from '../config';
import { findFillers } from '../detectors/fillers';
import { findPanics } from '../detectors/panics';
import { findRepeats } from '../detectors/repeats';
import { HttpError } from '../errors';
import { analyzePart, summarize } from '../llm/requests';
import type { AnalyzeResponse, Part } from '../types/api';
import type { AnalyzeInput, Transcript } from '../types/internal';
import { splitLines } from './script';
import { buildCharts, buildStats } from './stats';
import { transcribe } from './stt';

// 분석 파이프라인: STT → 코드 분석 → 파트별 LLM → 총평 LLM → 합산
// LLM이 실패해도 코드가 만든 결과(대본, 패닉존, 필러, 통계)는 그대로 돌려준다.
export async function analyze(input: AnalyzeInput): Promise<AnalyzeResponse> {
  const warnings: string[] = [];
  const warn = (code: string) => {
    if (!warnings.includes(code)) warnings.push(code);
  };

  // 녹음마다 병렬 STT
  const transcripts = await Promise.all(input.audio.map((file, i) => transcribe(file, input.language, i)));
  checkDurations(input, transcripts);

  // 파트별 코드 분석 + 파트별 LLM (병렬)
  const parts: Part[] = await Promise.all(
    transcripts.map(async ({ words, duration, segmentEnds }, i) => {
      const script = splitLines(words, segmentEnds);
      const codeHighlight = [
        ...findPanics(script),
        ...findFillers(words, input.language),
        ...findRepeats(script),
      ];
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

// 녹음 길이는 whisper가 알려 준 duration으로 확인한다 (+GRACE_SEC 여유).
function checkDurations(input: AnalyzeInput, transcripts: Transcript[]): void {
  const limit = input.mode === 'speaking' && input.exam ? MAX_AUDIO_SEC[input.exam] : MAX_AUDIO_SEC.presentation;
  transcripts.forEach((t, i) => {
    if (t.duration > limit + GRACE_SEC) {
      throw new HttpError(400, `${i + 1}번째 녹음이 너무 깁니다 (최대 ${limit}초).`);
    }
  });
}
