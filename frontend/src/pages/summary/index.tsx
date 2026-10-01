import { lazy, Suspense, useEffect } from "react";
import { Link } from "react-router";
import sample from "../../mocks/analyze.sample.json";
import { useAnalysis } from "../../store/analysis";
import type { AnalyzeResponse } from "../../types/api";
const ResultCharts = lazy(() => import("./components/ResultCharts"));

const sampleResult = sample as unknown as AnalyzeResponse;
const canLoadSample = import.meta.env.DEV || import.meta.env.VITE_USE_MOCK === "true";
const modeNames = { lecture: "발표", language: "어학 스피킹", interview: "면접" };

function timestamp(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(safe / 60)}:${Math.floor(safe % 60)
    .toString()
    .padStart(2, "0")}`;
}

// 김왁수 담당. 스크립트와 동일한 공용 분석 결과를 사용한다.
export default function SummaryPage() {
  const { result, setResult, settings } = useAnalysis();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const pauses =
    result?.lines.flatMap((line, index) => (line.pause ? [{ ...line, index }] : [])) ?? [];
  const highlights = Object.values(result?.highlight ?? {}).flat();
  const expressionCount = highlights.filter((item) => item[4] !== "grammar").length;
  const grammarCount = highlights.length - expressionCount;
  const repeatCount = Object.values(result?.repeats ?? {}).reduce(
    (count, words) => count + new Set(words).size,
    0,
  );
  const alternatives = pauses
    .filter((line) => result?.panic[line.index]?.altScript?.trim())
    .sort((a, b) => b.end - b.start - (a.end - a.start))
    .slice(0, 2);
  const score =
    result && Number.isFinite(result.stats.score)
      ? Math.min(100, Math.max(0, result.stats.score))
      : null;
  const metrics = result
    ? [
        { label: "말하기 속도", value: `${result.stats.wpm}`, unit: "단어/분" },
        { label: "군더더기", value: `${result.stats.fillerCount}`, unit: "회" },
        {
          label: "정지 구간",
          value: `${result.stats.panicCount}`,
          unit: "회",
          detail: `총 ${result.stats.panicTotalSec.toFixed(1)}초`,
        },
        { label: "표현 개선", value: `${expressionCount}`, unit: "곳" },
      ]
    : [];
  const categories = [
    { name: "막힌 지점", value: result?.stats.panicCount ?? 0, fill: "var(--color-hl-panic)" },
    { name: "군더더기", value: result?.stats.fillerCount ?? 0, fill: "var(--color-hl-filler)" },
    { name: "반복", value: repeatCount, fill: "var(--color-hl-repeat)" },
    { name: "표현 개선", value: expressionCount, fill: "var(--color-hl-expr)" },
    { name: "문법", value: grammarCount, fill: "var(--color-hl-grammar)" },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 pt-6">
      <header>
        <p className="text-xs font-semibold tracking-widest text-secondary">말하기 분석</p>
        <h1 className="mt-2 text-[1.75rem] leading-tight font-bold tracking-tight">
          이번 말하기를 돌아봐요
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-base-content/70">
          잘한 점을 확인하고, 다음 연습에서 바꿀 한 가지를 찾아보세요.
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
            onClick={() => setResult(sampleResult)}
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

          <dl className="grid grid-cols-2 gap-3" aria-label="말하기 핵심 지표">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="stat min-w-0 rounded-box border border-base-300 p-4"
              >
                <dt className="stat-title whitespace-normal text-xs text-base-content/70">
                  {metric.label}
                </dt>
                <dd className="stat-value mt-2 text-2xl tabular-nums">
                  {metric.value}
                  <span className="ml-1 text-xs font-normal">{metric.unit}</span>
                </dd>
                {metric.detail && (
                  <dd className="stat-desc mt-1 text-base-content/70">{metric.detail}</dd>
                )}
              </div>
            ))}
          </dl>

          <Suspense
            fallback={
              <p role="status" className="text-sm text-base-content/70">
                그래프를 준비하고 있어요.
              </p>
            }
          >
            <ResultCharts fillers={result.fillerTop} categories={categories} />
          </Suspense>

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

          <section aria-labelledby="timeline-title">
            <h2 id="timeline-title" className="text-lg font-bold">
              말이 멈춘 순간
            </h2>
            <p className="mt-2 text-sm text-base-content/70">
              구간을 누르면 대본의 대안 문장을 팝업으로 볼 수 있어요.
            </p>
            {pauses.length ? (
              <ol className="mt-3 flex flex-col gap-2">
                {pauses.map((line) => (
                  <li key={line.index}>
                    <Link
                      to={`/script?line=${line.index}`}
                      className="btn h-auto min-h-11 w-full justify-between whitespace-normal border-hl-panic/40 bg-hl-panic-soft px-3 py-3 text-base-content hover:border-hl-panic hover:bg-hl-panic-soft"
                      aria-label={`${timestamp(line.start)} 정지 구간의 대본 보기`}
                    >
                      <span className="text-sm tabular-nums">
                        {timestamp(line.start)} – {timestamp(line.end)}
                      </span>
                      <span className="text-xs">
                        {Math.max(0, line.end - line.start).toFixed(1)}초 정지 →
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-base-content/70">2초 이상 멈춘 구간이 없어요.</p>
            )}
          </section>

          <section aria-labelledby="retry-title">
            <h2 id="retry-title" className="text-lg font-bold">
              이 문장부터 다시 말해봐요
            </h2>
            {alternatives.length ? (
              alternatives.map((line) => (
                <article key={line.index} className="mt-3 rounded-box bg-base-200 p-4">
                  <Link
                    to={`/script?line=${line.index}`}
                    className="link text-xs text-base-content/70"
                  >
                    {timestamp(line.start)} 구간의 대안 보기
                  </Link>
                  <p className="mt-2 font-script text-lg leading-relaxed whitespace-pre-wrap wrap-anywhere">
                    {result.panic[line.index].altScript}
                  </p>
                </article>
              ))
            ) : (
              <p className="mt-3 text-sm text-base-content/70">
                대안 대본이 준비되면 여기에 표시할게요.
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
