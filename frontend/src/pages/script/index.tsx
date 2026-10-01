import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router";
import sample from "../../mocks/analyze.sample.json";
import { useAnalysis } from "../../store/analysis";
import type { AnalyzeResponse } from "../../types/api";

const sampleResult = sample as unknown as AnalyzeResponse;
const canLoadSample = import.meta.env.DEV || import.meta.env.VITE_USE_MOCK === "true";

function timestamp(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(safe / 60)}:${Math.floor(safe % 60)
    .toString()
    .padStart(2, "0")}`;
}

function silenceDuration(start: number, end: number) {
  return Math.max(0, end - start).toFixed(1);
}

// 김왁수 담당. 공용 Layout, dasi 테마, API 타입과 상태를 그대로 사용한다.
export default function ScriptPage() {
  const { result, setResult } = useAnalysis();
  const [searchParams, setSearchParams] = useSearchParams();
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const lineParam = searchParams.get("line");
  const requestedIndex =
    lineParam !== null && /^\d+$/.test(lineParam) ? Number(lineParam) : undefined;
  const selectedIndex =
    requestedIndex !== undefined && result?.lines[requestedIndex]?.pause
      ? requestedIndex
      : undefined;
  const selectedLine = selectedIndex === undefined ? undefined : result?.lines[selectedIndex];
  const selectedPanic = selectedIndex === undefined ? undefined : result?.panic[selectedIndex];
  const hasScript = Boolean(result?.lines.length);
  const isSample = result === sampleResult;
  const pauseCount = result?.lines.filter((line) => line.pause).length ?? 0;

  useEffect(() => {
    if (selectedIndex === undefined) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    detailHeading.current?.focus({ preventScroll: true });
    detailHeading.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [selectedIndex, result]);

  function selectPanic(index: number) {
    if (index === selectedIndex) {
      detailHeading.current?.focus({ preventScroll: true });
      detailHeading.current?.scrollIntoView({ behavior: "instant", block: "start" });
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set("line", String(index));
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pt-6">
      <header>
        <p className="text-xs font-semibold tracking-widest text-secondary">말하기 분석</p>
        <h1 className="mt-2 text-[1.75rem] leading-tight font-bold tracking-tight">
          내 말의 흐름을 살펴봐요
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-base-content/70">
          노란 밑줄은 군더더기예요. 정지 구간을 누르면 막힌 이유와 다시 말할 문장을 볼 수 있어요.
        </p>
      </header>

      {canLoadSample && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-box bg-base-200 p-3">
          <span className="text-xs text-base-content/70">
            {isSample ? "샘플 분석 결과를 보고 있어요" : "녹음 없이 결과 화면을 확인해 보세요"}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete("line");
              setSearchParams(next, { replace: true });
              setResult(sampleResult);
            }}
          >
            샘플 불러오기
          </button>
        </div>
      )}

      {!hasScript ? (
        <section className="card card-border bg-base-100" aria-labelledby="empty-title">
          <div className="card-body items-start gap-4">
            <h2 id="empty-title" className="card-title text-lg">
              아직 분석할 대본이 없어요
            </h2>
            <p className="text-sm leading-relaxed text-base-content/70">
              녹음한 말을 분석하면 이곳에 대본과 피드백이 나타나요.
            </p>
            <Link to="/record" className="btn btn-primary">
              녹음하러 가기
            </Link>
          </div>
        </section>
      ) : (
        result && (
          <>
            <section aria-labelledby="script-title">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="script-title" className="text-lg font-bold">
                  말한 대본
                </h2>
                <span className="text-xs text-base-content/70">
                  전체 {timestamp(result.duration)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs" aria-label="하이라이트 범례">
                <span className="rounded bg-hl-filler-soft px-2 py-1 underline decoration-hl-filler decoration-2 underline-offset-4">
                  군더더기
                </span>
                <span className="rounded bg-hl-panic-soft px-2 py-1 underline decoration-hl-panic decoration-[3px] underline-offset-4">
                  막힌 지점
                </span>
              </div>

              <ol className="mt-4 divide-y divide-base-300 border-y border-base-300">
                {result.lines.map((line, lineIndex) => {
                  const isSelected = selectedIndex === lineIndex;
                  const followedByPause = Boolean(result.lines[lineIndex + 1]?.pause);
                  return (
                    <li key={lineIndex} className="py-4">
                      <p className="mb-2 text-xs tabular-nums text-base-content/65">
                        <span className="sr-only">구간 </span>
                        {timestamp(line.start)} – {timestamp(line.end)}
                      </p>
                      {line.pause ? (
                        <button
                          type="button"
                          className={`btn h-auto min-h-11 w-full justify-between gap-2 whitespace-normal border-hl-panic/40 bg-hl-panic-soft px-3 py-3 text-base-content hover:border-hl-panic hover:bg-hl-panic-soft ${isSelected ? "ring-2 ring-hl-panic ring-offset-2" : ""}`}
                          aria-expanded={isSelected}
                          aria-controls="panic-detail"
                          aria-label={`${timestamp(line.start)}부터 ${silenceDuration(line.start, line.end)}초 정지, 원인과 대안 보기`}
                          onClick={() => selectPanic(lineIndex)}
                        >
                          <span>{silenceDuration(line.start, line.end)}초 정지</span>
                          <span className="text-xs font-normal">원인과 대안 보기 →</span>
                        </button>
                      ) : (
                        <p className="font-script text-lg leading-loose wrap-anywhere">
                          {line.words.map((word, wordIndex) => {
                            const filler = result.fillers[lineIndex]?.includes(wordIndex);
                            const panic =
                              followedByPause && wordIndex >= Math.max(0, line.words.length - 3);
                            return (
                              <span key={wordIndex}>
                                <span
                                  title={
                                    [filler && "군더더기", panic && "정지 직전 구간"]
                                      .filter(Boolean)
                                      .join(" · ") || undefined
                                  }
                                  className={
                                    panic
                                      ? "rounded bg-hl-panic-soft px-0.5 underline decoration-hl-panic decoration-[3px] underline-offset-4"
                                      : filler
                                        ? "rounded bg-hl-filler-soft px-0.5 underline decoration-hl-filler decoration-2 underline-offset-4"
                                        : undefined
                                  }
                                >
                                  {word}
                                </span>{" "}
                              </span>
                            );
                          })}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>

            <section
              id="panic-detail"
              className="card card-border bg-base-100"
              aria-labelledby="panic-title"
            >
              <div className="card-body gap-4">
                <h2
                  id="panic-title"
                  ref={detailHeading}
                  tabIndex={-1}
                  className="card-title text-lg"
                >
                  {selectedLine
                    ? `${silenceDuration(selectedLine.start, selectedLine.end)}초, 왜 막혔을까요?`
                    : "막힌 구간 살펴보기"}
                </h2>
                {selectedLine ? (
                  <>
                    <p className="text-xs tabular-nums text-base-content/65">
                      {timestamp(selectedLine.start)} – {timestamp(selectedLine.end)} 구간
                    </p>
                    <div aria-live="polite" className="flex flex-col gap-4">
                      <div>
                        <h3 className="text-sm font-semibold">막힌 이유</h3>
                        <p className="mt-2 text-sm leading-relaxed wrap-anywhere">
                          {selectedPanic?.reason || "이 구간의 원인 분석이 아직 도착하지 않았어요."}
                        </p>
                      </div>
                      <div className="rounded-box bg-base-200 p-4">
                        <h3 className="text-sm font-semibold">이렇게 다시 말해보세요</h3>
                        <p className="mt-2 font-script text-lg leading-relaxed whitespace-pre-wrap wrap-anywhere">
                          {selectedPanic?.altScript || "대안 문장이 준비되면 여기에 표시할게요."}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm leading-relaxed text-base-content/70">
                    {pauseCount
                      ? "위 대본에서 정지 구간을 선택해 주세요."
                      : "2초 이상 멈춘 구간이 없어요. 자연스럽게 말을 이어갔어요."}
                  </p>
                )}
              </div>
            </section>

            <Link to="/summary" className="btn btn-primary btn-lg btn-block">
              총평 보기
            </Link>
          </>
        )
      )}
    </div>
  );
}
