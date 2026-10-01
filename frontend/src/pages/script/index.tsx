import { Link, useSearchParams } from "react-router";
import sample from "../../mocks/analyze.sample.json";
import { useAnalysis } from "../../store/analysis";
import type { AnalyzeResponse } from "../../types/api";
import FeedbackModal from "./components/FeedbackModal";
import { categories, panicFeedback, wordFeedback } from "./feedback";

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
  const lineParam = searchParams.get("line");
  const wordParam = searchParams.get("word");
  const selectedWord =
    wordParam !== null && /^\d+$/.test(wordParam) ? Number(wordParam) : undefined;
  const requestedIndex =
    lineParam !== null && /^\d+$/.test(lineParam) ? Number(lineParam) : undefined;
  const selectedIndex =
    requestedIndex !== undefined && result?.lines[requestedIndex] ? requestedIndex : undefined;
  const selectedLine = selectedIndex === undefined ? undefined : result?.lines[selectedIndex];
  const feedback =
    result && selectedIndex !== undefined
      ? selectedLine?.pause
        ? panicFeedback(result, selectedIndex)
        : selectedWord !== undefined
          ? wordFeedback(result, selectedIndex, selectedWord)
          : []
      : [];
  const hasScript = Boolean(result?.lines.length);
  const isSample = result === sampleResult;
  function selectFeedback(index: number, word?: number) {
    const next = new URLSearchParams(searchParams);
    next.set("line", String(index));
    if (word === undefined) next.delete("word");
    else next.set("word", String(word));
    setSearchParams(next, { replace: true });
  }

  function closeFeedback() {
    const next = new URLSearchParams(searchParams);
    next.delete("line");
    next.delete("word");
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
          색이 표시된 표현이나 정지 구간을 눌러보세요. 팝업에서 다시 말할 문장과 피드백을 확인할 수
          있어요.
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
              next.delete("word");
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
                {Object.entries(categories).map(([key, category]) => (
                  <span
                    key={key}
                    className={`rounded px-2 py-1 underline underline-offset-4 ${category.style}`}
                  >
                    {category.label}
                  </span>
                ))}
              </div>

              <ol className="mt-4 divide-y divide-base-300 border-y border-base-300">
                {result.lines.map((line, lineIndex) => {
                  const isSelected = selectedIndex === lineIndex;
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
                          aria-haspopup="dialog"
                          aria-controls="script-feedback"
                          aria-label={`${timestamp(line.start)}부터 ${silenceDuration(line.start, line.end)}초 정지, 대안 보기`}
                          onClick={() => selectFeedback(lineIndex)}
                        >
                          <span>{silenceDuration(line.start, line.end)}초 정지</span>
                          <span className="text-xs font-normal">대안 보기 →</span>
                        </button>
                      ) : (
                        <p className="font-script text-lg leading-loose wrap-anywhere">
                          {line.words.map((word, wordIndex) => {
                            const issues = wordFeedback(result, lineIndex, wordIndex);
                            const labels = [
                              ...new Set(issues.map((item) => categories[item.category].label)),
                            ].join(" · ");
                            return (
                              <span key={wordIndex}>
                                {issues.length ? (
                                  <button
                                    type="button"
                                    title={labels}
                                    aria-label={`${word}: ${labels} 피드백 보기`}
                                    aria-haspopup="dialog"
                                    aria-controls="script-feedback"
                                    onClick={() => selectFeedback(lineIndex, wordIndex)}
                                    className={`cursor-pointer rounded px-0.5 text-left underline underline-offset-4 hover:brightness-90 ${categories[issues[0].category].style}`}
                                  >
                                    {word}
                                  </button>
                                ) : (
                                  word
                                )}{" "}
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

            <Link to="/summary" className="btn btn-primary btn-lg btn-block">
              총평 보기
            </Link>
          </>
        )
      )}
      <FeedbackModal
        feedback={feedback}
        onClose={closeFeedback}
        time={
          selectedLine
            ? `${timestamp(selectedLine.start)} – ${timestamp(selectedLine.end)} 구간`
            : ""
        }
      />
    </div>
  );
}
