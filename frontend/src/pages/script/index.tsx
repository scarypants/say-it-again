import PageHeader from "../../components/common/PageHeader";
import { Fragment, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import Collapse from "../../components/common/Collapse";
import PlayLineButton from "../../components/common/PlayLineButton";
import { mmss, partTitle, questionLine, totalDuration } from "../../components/common/scriptFormat";
import { useClipPlayer } from "../../components/common/useClipPlayer";
import { DESKTOP_QUERY, useMediaQuery } from "../../components/common/useMediaQuery";
import { useAnalysis } from "../../store/analysis";
import type { AnalyzeResponse, Highlight } from "../../types/api";
import FeedbackDetail from "./FeedbackDetail";
import {
  byPriority,
  CATEGORY,
  countByCategory,
  DISPLAY_CATEGORIES,
  displayCategory,
  lineOfWord,
  lineRuns,
  runSelection,
} from "./highlights";

const canLoadSample = import.meta.env.DEV || import.meta.env.VITE_USE_MOCK === "true";

// line: 분석을 펼칠 줄 (폰에서는 이 줄 바로 아래에 뜬다)
type Selected = { part: number; line: number; first: number; items: Highlight[] };

// 와이어프레임 스크립트 화면: 총 시간 + 하이라이트된 대본(문장마다 재생) → 누르면 분석 → 총평.
// 폰은 누른 줄 아래에 분석이 펼쳐지고, PC는 대본 오른쪽 칸에 뜬다
export default function ScriptPage() {
  const { result, setResult, session } = useAnalysis();
  const [params, setParams] = useSearchParams();
  // ?view=final: 고쳐진 완성 대본 (총평 "전체 대본 보기"에서 바로 열 수 있다)
  const showFinal = params.get("view") === "final";
  const player = useClipPlayer();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  // 총평에서 "대본에서 보기"로 오면 (?part=0&word=12) 그 하이라이트를 열어 둔 채로 시작한다
  const linkPart = params.get("part");
  const linkWord = params.get("word");
  const [selected, setSelected] = useState<Selected | null>(() => {
    if (!result || linkPart === null || linkWord === null) return null;
    const pi = Number(linkPart);
    const w = Number(linkWord);
    const part = result.parts[pi];
    if (!part) return null;
    // 총평은 하이라이트 시작 단어(from)로 연결한다. 겹친 다른 하이라이트는 섞지 않는다
    const covering = part.highlight
      .filter((h) => h.category !== "panic" && w >= h.from && w <= h.to)
      .sort(byPriority);
    const items = (
      covering.filter((h) => h.from === w).length ? covering.filter((h) => h.from === w) : covering
    ).slice(0, 1);
    return items.length ? { part: pi, line: lineOfWord(part, w), first: w, items } : null;
  });
  useEffect(() => {
    if (linkPart === null || linkWord === null) return;
    document.querySelector(`[data-word="${linkPart}:${linkWord}"]`)?.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [linkPart, linkWord]);
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  if (!result) return <NoResult onSample={canLoadSample ? setResult : undefined} />;

  const audio = session?.audio ?? [];
  const questions = session?.questions;
  const counts = countByCategory(result.parts);
  // 발표·면접은 0개여도 색 설명을 다 보여 준다 (스피킹은 나온 것만)
  const legend = DISPLAY_CATEGORIES.filter((c) => counts[c] > 0 || result.mode !== "speaking");
  const close = () => {
    if (selected) {
      document
        .querySelector<HTMLButtonElement>(`button[data-word="${selected.part}:${selected.first}"]`)
        ?.focus({ preventScroll: true });
    }
    setSelected(null);
  };
  const hasFinal = result.parts.some((p) => p.final.length > 0);
  const setView = (final: boolean) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (final) next.set("view", "final");
        else next.delete("view");
        return next;
      },
      { replace: true },
    );
  const summaryButton = (
    <Link to="/summary" className="btn btn-primary btn-lg btn-block">
      총평 보기
    </Link>
  );

  return (
    <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-10">
      <div className="flex flex-1 flex-col lg:min-h-full">
        <PageHeader
          title="대본"
          description={`총 ${mmss(totalDuration(result.parts))} · ${showFinal && hasFinal ? "군말과 막힌 곳을 고친 대본이에요. 보면서 다시 말해 보세요" : "색칠된 부분을 누르면 원인과 고칠 말이 나와요"}`}
        />
        {hasFinal && (
          <div role="tablist" aria-label="대본 보기" className="tabs-box tabs mb-3 w-fit">
            <button
              type="button"
              role="tab"
              aria-selected={!showFinal}
              className={`tab ${!showFinal ? "tab-active" : ""}`}
              onClick={() => setView(false)}
            >
              내가 말한 대본
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showFinal}
              className={`tab ${showFinal ? "tab-active" : ""}`}
              onClick={() => setView(true)}
            >
              고친 완성 대본
            </button>
          </div>
        )}

        {showFinal && hasFinal ? (
          <FinalScript result={result} questions={questions} />
        ) : (
          <>
            <section className="pb-3">
              <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="색 설명">
                {legend.map((c) => (
                  <li key={c} className="flex items-center gap-1.5" title={CATEGORY[c].desc}>
                    <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY[c].dot}`} aria-hidden />
                    {CATEGORY[c].label}
                    <span className="text-secondary tabular-nums">{counts[c]}</span>
                  </li>
                ))}
              </ul>
            </section>

            {result.warnings?.includes("llm_failed") && (
              <div role="alert" className="alert alert-warning alert-soft mb-3 text-sm">
                AI 분석 일부를 불러오지 못했어요. 군말·반복·멈춤 표시는 그대로 볼 수 있어요.
              </div>
            )}

            <div className="flex flex-col gap-6">
              {result.parts.map((part, pi) => (
                <section
                  key={pi}
                  aria-label={partTitle(
                    result.mode,
                    pi,
                    part.duration,
                    questions?.[pi],
                    totalDuration(result.parts.slice(0, pi)),
                  )}
                >
                  {(result.parts.length > 1 || result.mode !== "presentation") && (
                    <header className="mb-2 border-b border-base-300 pb-2">
                      <h2 className="text-sm font-semibold tabular-nums">
                        {partTitle(
                          result.mode,
                          pi,
                          part.duration,
                          questions?.[pi],
                          totalDuration(result.parts.slice(0, pi)),
                        )}
                      </h2>
                      {questionLine(questions?.[pi]) && (
                        <p className="mt-0.5 text-sm text-secondary">
                          {questionLine(questions?.[pi])}
                        </p>
                      )}
                      {part.comment && (
                        <p className="mt-2 rounded-field bg-base-200 px-3 py-2 text-sm leading-relaxed">
                          {part.comment}
                        </p>
                      )}
                    </header>
                  )}
                  <ol className="flex flex-col divide-y divide-base-200">
                    {part.script.map((line, li) => {
                      const key = `${pi}:${li}`;
                      if (line.pause)
                        return (
                          <li
                            key={key}
                            className="flex items-center gap-2 py-1.5 text-xs font-medium text-hl-panic tabular-nums"
                          >
                            <span className="h-px flex-1 border-t border-dashed border-current opacity-40" />
                            {(line.end - line.start).toFixed(1)}초 멈춤
                            <span className="h-px flex-1 border-t border-dashed border-current opacity-40" />
                          </li>
                        );
                      const openHere =
                        !desktop && selected?.part === pi && selected.line === li ? selected : null;
                      return (
                        <li key={key}>
                          <div
                            className={`flex items-start gap-1 rounded-field py-1.5 transition-colors ${
                              player.playing === key ? "bg-base-200" : ""
                            }`}
                          >
                            <p className="min-w-0 flex-1 py-1 text-[1.0625rem] leading-10 break-keep lg:text-lg lg:leading-[2.75rem]">
                              {lineRuns(line, part.highlight).map((run) => {
                                const items = runSelection(run, part);
                                const hint =
                                  run.top && ["panic", "filler"].includes(run.top.category)
                                    ? CATEGORY[run.top.category].desc
                                    : undefined;
                                // 선택한 하이라이트가 이 조각의 보이는 색일 때만 테두리
                                const isSelected =
                                  selected?.part === pi &&
                                  !!run.top &&
                                  selected.items.some(
                                    (h) =>
                                      run.items.includes(h) &&
                                      displayCategory(h.category) ===
                                        displayCategory(run.top!.category),
                                  );
                                // 말풍선(tooltip)은 inline-block이라 안에 띄어쓰기를 두면 사라지고 긴 조각이 줄바꿈되지 않는다.
                                // inline으로 두고 띄어쓰기는 바깥에 둔다
                                return run.top ? (
                                  <Fragment key={run.first}>
                                    <span
                                      className={hint ? "tooltip tooltip-bottom inline" : undefined}
                                      data-tip={hint}
                                    >
                                      <button
                                        type="button"
                                        data-word={`${pi}:${run.first}`}
                                        aria-expanded={isSelected}
                                        className={`box-decoration-clone rounded-[4px] px-1 py-0.5 leading-snug text-left outline-2 outline-offset-0 transition-[outline-color] duration-200 ease-soft focus-visible:outline-accent ${
                                          CATEGORY[run.top.category].mark
                                        } ${isSelected ? "outline-base-content" : "outline-transparent"}`}
                                        aria-label={`${run.text} — ${[
                                          ...new Set(items.map((h) => CATEGORY[h.category].label)),
                                        ].join(", ")}`}
                                        onClick={() =>
                                          setSelected(
                                            isSelected
                                              ? null
                                              : {
                                                  part: pi,
                                                  line: li,
                                                  first: run.first,
                                                  items,
                                                },
                                          )
                                        }
                                      >
                                        {run.words.map((w, wi) => (
                                          <span key={wi}>
                                            {wi > 0 && " "}
                                            <span
                                              className={
                                                w.under
                                                  ? `underline decoration-2 underline-offset-[5px] ${CATEGORY[w.under].under}`
                                                  : undefined
                                              }
                                            >
                                              {w.text}
                                            </span>
                                          </span>
                                        ))}
                                      </button>
                                    </span>{" "}
                                  </Fragment>
                                ) : (
                                  <span key={run.first} data-word={`${pi}:${run.first}`}>
                                    {run.text}{" "}
                                  </span>
                                );
                              })}
                            </p>
                            <PlayLineButton
                              playing={player.playing === key}
                              disabled={!audio[pi]}
                              label={`${li + 1}번째 문장`}
                              onClick={() => void player.play(key, audio[pi], line.start, line.end)}
                            />
                          </div>
                          <Collapse open={!!openHere}>
                            {openHere && (
                              <FeedbackDetail
                                inline
                                part={part}
                                items={openHere.items}
                                onClose={close}
                              />
                            )}
                          </Collapse>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>

            {player.error && (
              <div role="alert" className="alert alert-error alert-soft mt-3 text-sm">
                {player.error}
              </div>
            )}
            {!audio.length && (
              <p className="mt-3 text-xs text-secondary">
                연결된 녹음 파일이 없어 문장 듣기를 사용할 수 없어요.
              </p>
            )}
          </>
        )}

        <div className="sticky bottom-0 mt-auto bg-base-100 pt-4 pb-2 lg:hidden">
          {summaryButton}
        </div>
      </div>

      {/* PC: 대본을 내려도 분석과 총평 버튼이 옆에 붙어 있다 */}
      {desktop && (
        <aside className="sticky top-4 flex max-h-[calc(100svh-7rem)] flex-col gap-4 pt-2">
          <div className="min-h-0 flex-1 overflow-y-auto rounded-box border border-base-300 p-5">
            {selected ? (
              <FeedbackDetail
                key={`${selected.part}:${selected.first}`}
                part={result.parts[selected.part]}
                items={selected.items}
                onClose={close}
              />
            ) : (
              <p className="animate-fade py-10 text-center text-sm text-secondary">
                대본에서 색칠된 부분을 누르면
                <br />
                여기에 원인과 고칠 말이 나와요.
              </p>
            )}
          </div>
          {summaryButton}
        </aside>
      )}
    </div>
  );
}

// 각 파트의 final(LLM이 다듬은 대본)을 문장마다 한 줄로 보여 준다
function FinalScript({ result, questions }: { result: AnalyzeResponse; questions?: string[] }) {
  return (
    <div className="flex flex-col gap-6">
      {result.parts.map((part, pi) => (
        <section key={pi}>
          {(result.parts.length > 1 || result.mode !== "presentation") && (
            <header className="mb-2 border-b border-base-300 pb-2">
              <h2 className="text-sm font-semibold tabular-nums">
                {partTitle(
                  result.mode,
                  pi,
                  part.duration,
                  questions?.[pi],
                  totalDuration(result.parts.slice(0, pi)),
                )}
              </h2>
              {questionLine(questions?.[pi]) && (
                <p className="mt-0.5 text-sm text-secondary">{questionLine(questions?.[pi])}</p>
              )}
            </header>
          )}
          {part.final.length > 0 ? (
            <div className="flex flex-col gap-2.5 text-[1.0625rem] leading-8 lg:text-lg lg:leading-9">
              {part.final.map((f, i) => (
                <p key={i}>{f.words.join(" ")}</p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-secondary">이 답변은 고친 대본이 없어요.</p>
          )}
        </section>
      ))}
    </div>
  );
}

function NoResult({ onSample }: { onSample?: (r: AnalyzeResponse) => void }) {
  async function loadSample() {
    const sample = (await import("../../mocks/analyze.sample.json")).default;
    onSample?.(sample as AnalyzeResponse);
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <p className="text-lg font-semibold">아직 분석한 대본이 없어요</p>
      <p className="text-sm text-secondary">녹음하고 대본을 확인한 뒤 분석해 주세요.</p>
      <div className="flex gap-2">
        <Link to="/" className="btn btn-primary">
          처음으로
        </Link>
        {onSample && (
          <button type="button" className="btn btn-ghost" onClick={() => void loadSample()}>
            예시 결과 보기
          </button>
        )}
      </div>
    </div>
  );
}
