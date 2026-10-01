import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import PlayLineButton from "../../components/common/PlayLineButton";
import { mmss, partTitle, questionLine, totalDuration } from "../../components/common/scriptFormat";
import { useClipPlayer } from "../../components/common/useClipPlayer";
import { useAnalysis } from "../../store/analysis";
import type { AnalyzeResponse, Highlight, HighlightCategory } from "../../types/api";
import FeedbackSheet from "./FeedbackSheet";
import { byPriority, CATEGORY, countByCategory, lineRuns, PRIORITY } from "./highlights";

const canLoadSample = import.meta.env.DEV || import.meta.env.VITE_USE_MOCK === "true";

type Selected = { part: number; first: number; items: Highlight[] };

// 와이어프레임 스크립트 화면: 총 시간 + 하이라이트된 대본(문장마다 재생) → 누르면 아래에서 분석이 올라옴 → 총평
export default function ScriptPage() {
  const { result, setResult, session } = useAnalysis();
  const [params] = useSearchParams();
  const player = useClipPlayer();
  // 총평에서 "대본에서 보기"로 오면 (?part=0&word=12) 그 하이라이트를 열어 둔 채로 시작한다
  const linkPart = params.get("part");
  const linkWord = params.get("word");
  const [selected, setSelected] = useState<Selected | null>(() => {
    if (!result || linkPart === null || linkWord === null) return null;
    const pi = Number(linkPart);
    const w = Number(linkWord);
    const items = (result.parts[pi]?.highlight ?? [])
      .filter((h) => w >= h.from && w <= h.to)
      .sort(byPriority);
    return items.length ? { part: pi, first: w, items } : null;
  });
  useEffect(() => {
    if (linkPart === null || linkWord === null) return;
    document
      .querySelector(`[data-word="${linkPart}:${linkWord}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [linkPart, linkWord]);

  if (!result) return <NoResult onSample={canLoadSample ? setResult : undefined} />;

  const audio = session?.audio ?? [];
  const questions = session?.questions;
  const counts = countByCategory(result.parts);
  const legend = (Object.keys(PRIORITY) as HighlightCategory[]).filter(
    (c) => counts[c] > 0 || (c !== "grammar" && result.mode === "presentation"),
  );

  return (
    <div className="flex flex-1 flex-col">
      <section className="pt-2 pb-3">
        <h1 className="text-xl font-bold">대본</h1>
        <p className="mt-1 text-sm text-secondary tabular-nums">
          총 {mmss(totalDuration(result.parts))} · 색칠된 부분을 누르면 분석이 나와요
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs" aria-label="색 설명">
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
          <section key={pi} aria-label={partTitle(result.mode, pi, part.duration)}>
            {(result.parts.length > 1 || result.mode === "speaking") && (
              <header className="mb-2 border-b border-base-300 pb-2">
                <h2 className="text-sm font-semibold tabular-nums">
                  {partTitle(result.mode, pi, part.duration)}
                </h2>
                {questionLine(questions?.[pi]) && (
                  <p className="mt-0.5 text-sm text-secondary">{questionLine(questions?.[pi])}</p>
                )}
                {part.comment && <p className="mt-1 text-sm">{part.comment}</p>}
              </header>
            )}
            <ol className="flex flex-col">
              {part.script.map((line, li) => {
                const key = `${pi}:${li}`;
                if (line.pause)
                  return (
                    <li key={key} className="py-1 text-xs text-hl-panic tabular-nums">
                      {(line.end - line.start).toFixed(1)}초 멈춤
                    </li>
                  );
                return (
                  <li
                    key={key}
                    className={`flex items-start gap-1 rounded-field py-1 ${
                      player.playing === key ? "bg-base-200" : ""
                    }`}
                  >
                    <p className="min-w-0 flex-1 py-1 text-[1.0625rem] leading-8">
                      {lineRuns(line, part.highlight).map((run) => {
                        const isSelected =
                          selected?.part === pi &&
                          selected.items.some((h) => run.items.includes(h));
                        return run.top ? (
                          <span key={run.first}>
                            <button
                              type="button"
                              data-word={`${pi}:${run.first}`}
                              className={`box-decoration-clone rounded-[3px] border-b-2 px-0.5 text-left ${
                                CATEGORY[run.top.category].mark
                              } ${isSelected ? "outline-2 outline-offset-1 outline-base-content" : ""}`}
                              aria-label={`${run.text} — ${run.items
                                .map((h) => CATEGORY[h.category].label)
                                .join(", ")}`}
                              onClick={() =>
                                setSelected(
                                  isSelected
                                    ? null
                                    : { part: pi, first: run.first, items: run.items },
                                )
                              }
                            >
                              {run.text}
                            </button>{" "}
                          </span>
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
          예시 결과라 녹음이 없어서 문장 듣기는 꺼져 있어요.
        </p>
      )}

      {/* 분석 창이 올라와 있어도 마지막 문장까지 보이게 */}
      <div className={selected ? "h-[45svh]" : "h-0"} aria-hidden />

      <div className="sticky bottom-0 mt-auto bg-base-100 pt-4 pb-2">
        <Link to="/summary" className="btn btn-primary btn-lg btn-block">
          총평 보기
        </Link>
      </div>

      <FeedbackSheet
        part={selected ? result.parts[selected.part] : null}
        items={selected?.items ?? []}
        onClose={() => setSelected(null)}
      />
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
