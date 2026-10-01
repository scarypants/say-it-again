import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { canRetry, useAnalysis, useStartRetry } from "../../store/analysis";
import type { AnalyzeResponse } from "../../types/api";
import { createChartData } from "./chartData";
import { feedbackRows } from "./feedbackRows";
import WordFrequency from "./components/WordFrequency";
import RetryComparison from "./components/RetryComparison";
import { comparablePrevious, retryReference } from "./retryComparison";
import { totalDuration } from "../../components/common/scriptFormat";
import FollowUpSummary from "./components/FollowUpSummary";
import { isFollowUpSummary } from "./followUp";
const FeedbackChart = lazy(() => import("./components/FeedbackChart"));
const FollowUpQuestions = lazy(() => import("../../components/common/FollowUpQuestions"));

const modeNames = { presentation: "발표", speaking: "어학 스피킹", interview: "면접" };
function timestamp(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(safe / 60)}:${Math.floor(safe % 60)
    .toString()
    .padStart(2, "0")}`;
}

export default function SummaryPage() {
  const { result, previous, setPrevious, session, settings } = useAnalysis();
  const startRetry = useStartRetry();
  const feedbackRef = useRef<HTMLElement>(null);
  const [selection, setSelection] = useState<{
    result: AnalyzeResponse;
    category: "filler" | "repeat";
  } | null>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const selected = selection?.result === result ? selection.category : null;
  useEffect(() => {
    if (selected && !window.matchMedia("(min-width: 1024px)").matches) {
      feedbackRef.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      });
    }
  }, [selected]);
  const chart = result ? createChartData(result) : [];
  const improvements = result && selected ? feedbackRows(result, selected) : [];
  const isFollowUp = Boolean(
    result && session?.questions?.length === result.parts.length &&
    isFollowUpSummary(session.questions, settings),
  );
  const comparison = result && !isFollowUp ? comparablePrevious(result, previous) : null;
  const isRetry = Boolean(result?.compare || comparison);
  const score =
    result && Number.isFinite(result.analysis.score)
      ? Math.min(100, Math.max(0, result.analysis.score))
      : null;

  return (
    <div className="flex flex-1 flex-col gap-6 pt-8 font-sans sm:gap-8">
      <header>
        <p className="text-sm font-semibold text-secondary">
          {result ? isFollowUp ? "꼬리질문 답변의 한 줄 요약" : "이 녹음의 한 줄 요약" : "말하기 분석"}
        </p>
        <h1 className="mt-3 max-w-[28ch] text-[1.75rem] leading-snug font-bold tracking-tight text-balance break-keep sm:text-4xl lg:max-w-[36ch]">
          {result?.analysis.summary.headline || "이번 말하기를 돌아봐요"}
        </h1>
      </header>
      {!result?.parts.length ? (
        <section className="card card-border min-h-72 max-w-none bg-base-200/60" aria-labelledby="summary-empty">
          <div className="card-body justify-center p-7 sm:p-10">
            <div className="flex max-w-2xl flex-col items-start gap-4">
              <h2 id="summary-empty" className="card-title text-xl">
                아직 돌아볼 말하기가 없어요
              </h2>
              <p className="max-w-prose text-base leading-relaxed text-base-content/70">
                녹음한 말을 분석하면 점수와 개선점을 확인할 수 있어요.
              </p>
              <Link to="/record" className="btn btn-primary">
                녹음하러 가기
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <div className="grid min-w-0 gap-7 lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-start lg:gap-10">
          <div className="flex min-w-0 flex-col gap-7">
            <section className="rounded-box bg-base-200" aria-labelledby="score-title">
              <div className="flex items-center justify-between gap-3 p-5 sm:p-6">
                <div className="flex flex-col items-start gap-2">
                  <h2 id="score-title" className="text-lg font-bold sm:text-xl">
                    {isRetry ? "재도전 점수" : isFollowUp ? "꼬리질문 답변 점수" : "말하기 점수"}
                  </h2>
                  <p className="text-sm leading-relaxed text-secondary">
                    패닉존·군말·반복 기준
                  </p>
                  <span className="badge badge-outline">
                    {modeNames[result.mode]} · {timestamp(totalDuration(result.parts))}
                  </span>
                </div>
                <p className="shrink-0 tabular-nums">
                  <span className="text-4xl font-bold sm:text-5xl">{score ?? "—"}</span>
                  <span className="ml-1 text-sm text-base-content/70">/ 100점</span>
                </p>
              </div>
            </section>
            <Suspense
              fallback={
                <div role="status" className="min-h-[32rem]">
                  <p className="text-sm text-secondary">그래프를 준비하고 있어요.</p>
                  <div aria-hidden="true" className="skeleton mx-auto mt-4 aspect-square w-full max-w-72 rounded-full" />
                  <div aria-hidden="true" className="skeleton mt-4 h-36 w-full rounded-box" />
                </div>
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
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            {isRetry && <RetryComparison previous={comparison} result={result} />}
            {selected && (
              <section
                key={selected}
                ref={feedbackRef}
                id="summary-improvements"
                aria-labelledby="improvements-title"
                className="animate-reveal scroll-mt-5 rounded-box border border-base-300 bg-base-100 p-5 sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 id="improvements-title" className="text-xl font-bold">
                    {selected === "filler" ? "군말" : "반복"} 표현 개선안
                  </h2>
                  <button
                    type="button"
                    className="btn btn-circle btn-ghost btn-sm shrink-0"
                    aria-label="피드백 닫기"
                    onClick={() => {
                      document.getElementById(`category-${selected}`)?.focus({ preventScroll: true });
                      setSelection(null);
                    }}
                  >
                    <span aria-hidden="true" className="text-xl leading-none">×</span>
                  </button>
                </div>
                {selected && (
                  <WordFrequency
                    category={selected}
                    rows={selected === "filler" ? result.charts.fillerTop : result.charts.repeatTop}
                  />
                )}
                {selected ? (
                  <div className="mt-4 flex flex-col gap-4" aria-live="polite">
                    {improvements.length ? (
                      improvements.map((item, index) => (
                        <article
                          key={item.key}
                          className={index ? "border-t border-base-300 pt-4" : ""}
                        >
                          <p className="text-sm tabular-nums text-base-content/75">
                            녹음 {item.partIndex + 1} · {timestamp(item.start)} –{" "}
                            {timestamp(item.end)}
                          </p>
                          <p className="mt-3 text-sm font-semibold text-base-content/65">
                            말한 문장
                          </p>
                          <p className="mt-2 max-w-prose text-lg leading-[1.9] wrap-anywhere">
                            {item.segments.map((segment, index) => (
                              <span key={index}>
                                {segment.highlighted ? (
                                  <mark
                                    className={`box-decoration-clone rounded px-1 py-0.5 font-semibold text-base-content ${selected === "filler" ? "bg-hl-filler-soft" : "bg-hl-repeat-soft"}`}
                                  >
                                    {segment.text}
                                  </mark>
                                ) : (
                                  segment.text
                                )}{" "}
                              </span>
                            ))}
                          </p>
                          <p className="mt-4 text-sm font-semibold text-base-content/65">
                            개선한 문장
                          </p>
                          <p className="mt-2 max-w-prose text-lg leading-[1.9] wrap-anywhere">
                            {item.improved === ""
                              ? "이 표현은 생략하고 문장을 이어 말해보세요."
                              : (item.improved ?? "이 구간에는 개선안이 제공되지 않았어요.")}
                          </p>
                          <Link
                            to={`/script?part=${item.partIndex}&word=${item.word}`}
                            className="btn btn-ghost mt-3 min-h-10 text-sm text-accent"
                          >
                            대본에서 보기
                          </Link>
                        </article>
                      ))
                    ) : (
                      <p className="text-sm text-base-content/70">이 항목의 개선안이 없어요.</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-sm leading-relaxed text-base-content/70">
                    원형 차트의 보라색 반복 또는 노란색 군말을 선택해 주세요.
                  </p>
                )}
              </section>
            )}
            {!isRetry && <section aria-labelledby="priorities-title">
              <h2 id="priorities-title" className="text-xl font-bold">
                먼저 고칠 3가지
              </h2>
              {result.analysis.summary.topPriorities.length ? (
                <ol className="mt-3 divide-y divide-base-300 border-y border-base-300">
                  {result.analysis.summary.topPriorities.slice(0, 3).map((priority, index) => (
                    <li key={index} className="flex gap-3 py-4">
                      <span className="badge badge-primary mt-0.5 shrink-0">{index + 1}</span>
                      <p className="min-w-0 text-base leading-relaxed wrap-anywhere">{priority}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm text-base-content/70">추천 개선점을 준비하고 있어요.</p>
              )}
              {result.analysis.summary.comment && (
                <p className="mt-3 rounded-box bg-base-200 p-4 text-base leading-relaxed wrap-anywhere">
                  {result.analysis.summary.comment}
                </p>
              )}
            </section>}
            {isFollowUp && <FollowUpSummary result={result} questions={session?.questions} />}
            <div className="flex flex-col gap-2 xl:flex-row">
              {canRetry(result, session?.questions) ? (
                <button type="button" onClick={() => {
                  const reference = retryReference(result, previous);
                  startRetry();
                  setPrevious(reference);
                }} className="btn btn-primary btn-lg btn-block xl:flex-1">
                  다시, 말해
                </button>
              ) : (
                <Link to="/" className="btn btn-primary btn-lg btn-block xl:flex-1">
                  처음으로
                </Link>
              )}
              <Link to="/script" className="btn btn-outline btn-lg btn-block border-base-300 xl:flex-1">
                전체 대본 보기
              </Link>
            </div>
            {!result.compare && (
              <Suspense fallback={<p role="status" className="text-sm text-secondary">추가 질문 기능을 불러오고 있어요.</p>}>
                <FollowUpQuestions result={result} questions={session?.questions} />
              </Suspense>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
