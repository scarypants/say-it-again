import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router";
import sample from "../../mocks/analyze.sample.json";
import { useAnalysis } from "../../store/analysis";
import type { AnalyzeResponse } from "../../types/api";
import { createChartData } from "./chartData";
import { wordFeedback } from "../script/feedback";
const FeedbackChart = lazy(() => import("./components/FeedbackChart"));

const sampleResult = sample as unknown as AnalyzeResponse;
const canLoadSample = import.meta.env.DEV || import.meta.env.VITE_USE_MOCK === "true";
const modeNames = { lecture: "발표", language: "어학 스피킹", interview: "면접" };
function timestamp(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(safe / 60)}:${Math.floor(safe % 60)
    .toString()
    .padStart(2, "0")}`;
}

export default function SummaryPage() {
  const { result, setResult, settings } = useAnalysis();
  const [selection, setSelection] = useState<{
    result: AnalyzeResponse;
    category: "filler" | "repeat";
  } | null>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const selected = selection?.result === result ? selection.category : null;
  const chart = result ? createChartData(result) : [];
  const improvements =
    result && selected
      ? result.lines.flatMap((line, lineIndex) => {
          const words =
            selected === "filler" ? result.fillers[lineIndex] : result.repeats[lineIndex];
          const word = words?.find(
            (index) => Number.isInteger(index) && index >= 0 && index < line.words.length,
          );
          if (word === undefined || line.pause) return [];
          const feedback = wordFeedback(result, lineIndex, word).find(
            (item) => item.category === selected,
          );
          return feedback
            ? [
                {
                  ...feedback,
                  original: line.words.join(" "),
                  lineIndex,
                  start: line.start,
                  end: line.end,
                  word,
                },
              ]
            : [];
        })
      : [];
  const score =
    result && Number.isFinite(result.stats.score)
      ? Math.min(100, Math.max(0, result.stats.score))
      : null;

  return (
    <div className="flex flex-1 flex-col gap-6 pt-6">
      <header>
        <p className="text-xs font-semibold tracking-widest text-secondary">말하기 분석</p>
        <h1 className="mt-2 text-[1.75rem] leading-tight font-bold tracking-tight">
          이번 말하기를 돌아봐요
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-base-content/70">
          전체 흐름을 확인하고, 다음 연습에서 바꿀 한 가지를 찾아보세요.
        </p>
      </header>
      {canLoadSample && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-box bg-base-200 p-3">
          <span className="text-xs text-base-content/70">
            {result === sampleResult
              ? "샘플 분석 결과를 보고 있어요"
              : "녹음 없이 총평 화면을 확인해 보세요"}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setSelection(null);
              setResult(sampleResult);
            }}
          >
            샘플 불러오기
          </button>
        </div>
      )}
      {!result?.lines.length ? (
        <section className="card card-border bg-base-100" aria-labelledby="summary-empty">
          <div className="card-body items-start gap-4">
            <h2 id="summary-empty" className="card-title text-lg">
              아직 돌아볼 말하기가 없어요
            </h2>
            <p className="text-sm text-base-content/70">
              녹음한 말을 분석하면 점수와 개선점을 확인할 수 있어요.
            </p>
            <Link to="/record" className="btn btn-primary">
              녹음하러 가기
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="card card-border bg-base-100" aria-labelledby="score-title">
            <div className="card-body gap-4">
              <div className="flex items-center justify-between gap-3">
                <h2 id="score-title" className="card-title text-lg">
                  이번 말하기
                </h2>
                <span className="badge badge-outline">
                  {result === sampleResult ? "발표" : modeNames[settings.mode]} ·{" "}
                  {timestamp(result.duration)}
                </span>
              </div>
              <p className="tabular-nums">
                <span className="text-5xl font-bold">{score ?? "—"}</span>
                <span className="ml-2 text-sm text-base-content/70">/ 100점</span>
              </p>
              <p className="text-base leading-relaxed font-semibold wrap-anywhere">
                {result.summary.headline || "한 줄 총평을 준비하고 있어요."}
              </p>
            </div>
          </section>
          <Suspense
            fallback={
              <p role="status" className="text-sm text-base-content/70">
                그래프를 준비하고 있어요.
              </p>
            }
          >
            <FeedbackChart
              categories={chart}
              selected={selected}
              onSelect={(category) =>
                setSelection(selected === category ? null : { result, category })
              }
            />
          </Suspense>
          <section
            aria-labelledby="improvements-title"
            className="rounded-box border border-base-300 bg-base-200 p-4"
          >
            <h2 id="improvements-title" className="text-lg font-bold">
              {selected
                ? `${selected === "filler" ? "군더더기" : "반복"} 표현 개선안`
                : "색상을 눌러 개선안을 확인하세요"}
            </h2>
            {selected ? (
              <div className="mt-4 flex flex-col gap-4" aria-live="polite">
                {improvements.length ? (
                  improvements.map((item, index) => (
                    <article
                      key={item.lineIndex}
                      className={index ? "border-t border-base-300 pt-4" : ""}
                    >
                      <p className="text-xs tabular-nums text-base-content/65">
                        {timestamp(item.start)} – {timestamp(item.end)}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-base-content/65">말한 문장</p>
                      <p className="mt-1 font-script text-base leading-relaxed wrap-anywhere">
                        {item.original}
                      </p>
                      <p className="mt-3 text-xs font-semibold text-base-content/65">개선한 문장</p>
                      <p className="mt-1 font-script text-lg leading-relaxed wrap-anywhere">
                        {item.improved || "이 표현은 생략하고 다음 문장으로 이어 말해보세요."}
                      </p>
                      <Link
                        to={`/script?line=${item.lineIndex}&word=${item.word}`}
                        className="link mt-3 inline-block text-xs"
                      >
                        대본에서 보기 →
                      </Link>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-base-content/70">이 항목의 개선안이 없어요.</p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-base-content/70">
                원형 차트의 보라색 반복 또는 노란색 군더더기를 선택해 주세요.
              </p>
            )}
          </section>
          <section aria-labelledby="priorities-title">
            <h2 id="priorities-title" className="text-lg font-bold">
              먼저 고칠 3가지
            </h2>
            {result.summary.topPriorities.length ? (
              <ol className="mt-3 divide-y divide-base-300 border-y border-base-300">
                {result.summary.topPriorities.slice(0, 3).map((priority, index) => (
                  <li key={index} className="flex gap-3 py-4">
                    <span className="badge badge-primary mt-0.5 shrink-0">{index + 1}</span>
                    <p className="min-w-0 text-sm leading-relaxed wrap-anywhere">{priority}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-base-content/70">추천 개선점을 준비하고 있어요.</p>
            )}
            {result.summary.modeComment && (
              <p className="mt-4 rounded-box bg-base-200 p-4 text-sm leading-relaxed wrap-anywhere">
                {result.summary.modeComment}
              </p>
            )}
          </section>
          <div className="flex flex-col gap-3">
            <Link to="/record" className="btn btn-primary btn-lg btn-block">
              다시 말해보기
            </Link>
            <Link to="/script" className="btn btn-outline btn-block">
              전체 대본 보기
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
