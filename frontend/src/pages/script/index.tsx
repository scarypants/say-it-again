import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import sample from "../../mocks/analyze.sample.json";
import { useAnalysis } from "../../store/analysis";
import type { AnalyzeResponse } from "../../types/api";
import InlineFeedback from "./components/InlineFeedback";
import HighlightHint from "./components/HighlightHint";
import useSegmentAudio from "./components/useSegmentAudio";
import { categories } from "./feedback";
import { getScriptParts, getLineSegments } from "./scriptParts";
import { getRecordings } from "./recordings";

const sampleResult = sample as unknown as AnalyzeResponse;
const canLoadSample = import.meta.env.DEV || import.meta.env.VITE_USE_MOCK === "true";
function timestamp(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return `${Math.floor(safe / 60)}:${Math.floor(safe % 60)
    .toString()
    .padStart(2, "0")}`;
}
function indexParam(value: string | null) {
  return value !== null && /^\d+$/.test(value) ? Number(value) : undefined;
}

export default function ScriptPage() {
  const { result, setResult } = useAnalysis();
  const [searchParams, setSearchParams] = useSearchParams();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [attached, setAttached] = useState<{ result: object; blobs: Record<number, Blob> } | null>(
    null,
  );
  const {
    player: audioRef,
    playing: playingClip,
    error: audioError,
    play,
    stop,
    scheduleEnd,
    clearTimer,
  } = useSegmentAudio();
  const parts = getScriptParts(result);
  const requestedPart = indexParam(searchParams.get("part")) ?? 0;
  const partIndex = parts[requestedPart] ? requestedPart : 0;
  const part = parts[partIndex];
  const selectedLine = indexParam(searchParams.get("line"));
  const selectedWord = indexParam(searchParams.get("word"));
  const recordedBlob =
    attached?.result === result
      ? (attached.blobs[partIndex] ?? getRecordings(result)[partIndex])
      : getRecordings(result)[partIndex];
  function closeFeedback() {
    const next = new URLSearchParams(searchParams);
    next.delete("line");
    next.delete("word");
    setSearchParams(next, { replace: true });
    trigger.current?.focus({ preventScroll: true });
  }
  function selectFeedback(line: number, word: number, button: HTMLButtonElement) {
    trigger.current = button;
    if (selectedLine === line && selectedWord === word) {
      closeFeedback();
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set("part", String(partIndex));
    next.set("line", String(line));
    next.set("word", String(word));
    setSearchParams(next, { replace: true });
  }
  return (
    <div className="flex flex-1 flex-col gap-6 pt-6">
      <audio
        ref={audioRef}
        preload="metadata"
        onPlaying={scheduleEnd}
        onWaiting={clearTimer}
        onSeeked={scheduleEnd}
        onEnded={stop}
        onTimeUpdate={scheduleEnd}
        aria-hidden="true"
      />
      <header>
        <p className="text-xs font-semibold tracking-widest text-secondary">말하기 분석</p>
        <h1 className="mt-2 text-[1.75rem] leading-tight font-bold tracking-tight">
          내 말의 흐름을 살펴봐요
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-base-content/70">
          색이 표시된 표현을 누르면 문장 아래에 피드백이 펼쳐져요. 패닉존과 군말에 마우스를 올리면
          뜻을 볼 수 있어요.
        </p>
      </header>
      {canLoadSample && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-box bg-base-200 p-3">
          <span className="text-xs text-base-content/70">
            {result === sampleResult
              ? "샘플 분석 결과를 보고 있어요"
              : "녹음 없이 결과 화면을 확인해 보세요"}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              stop();
              setAttached(null);
              setSearchParams({}, { replace: true });
              setResult(sampleResult);
            }}
          >
            샘플 불러오기
          </button>
        </div>
      )}
      {!part?.lines.length ? (
        <section className="card card-border bg-base-100" aria-labelledby="empty-title">
          <div className="card-body items-start gap-4">
            <h2 id="empty-title" className="card-title text-lg">
              아직 분석할 대본이 없어요
            </h2>
            <p className="text-sm text-base-content/70">
              녹음한 말을 분석하면 이곳에 대본과 피드백이 나타나요.
            </p>
            <Link to="/record" className="btn btn-primary">
              녹음하러 가기
            </Link>
          </div>
        </section>
      ) : (
        <>
          {parts.length > 1 && (
            <nav aria-label="녹음 파일별 대본" className="flex flex-wrap gap-2">
              {parts.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className={`btn btn-sm ${index === partIndex ? "btn-primary" : "btn-outline"}`}
                  aria-pressed={index === partIndex}
                  onClick={() => {
                    stop();
                    setSearchParams({ part: String(index) }, { replace: true });
                  }}
                >
                  녹음 {index + 1}
                </button>
              ))}
            </nav>
          )}
          <section aria-labelledby="script-title">
            <div className="flex items-center justify-between gap-2">
              <h2 id="script-title" className="text-lg font-bold">
                {parts.length > 1 ? `녹음 ${partIndex + 1} 대본` : "말한 대본"}
              </h2>
              <span className="text-xs text-base-content/70">전체 {timestamp(part.duration)}</span>
            </div>
            {part.comment && <p className="mt-2 text-sm leading-relaxed">{part.comment}</p>}
            <div className="mt-3 flex flex-wrap gap-3 text-xs" aria-label="하이라이트 범례">
              {Object.entries(categories).map(([key, category]) => (
                <HighlightHint key={key} category={key as keyof typeof categories}>
                  <span
                    tabIndex={key === "panic" || key === "filler" ? 0 : undefined}
                    aria-label={`${category.label}: ${category.description}`}
                    className={`rounded px-2 py-1 ${category.style}`}
                  >
                    {category.label}
                  </span>
                </HighlightHint>
              ))}
            </div>
            {!recordedBlob && (
              <div className="mt-4 rounded-box bg-base-200 p-3">
                <label className="flex flex-col gap-2 text-xs text-base-content/70">
                  이 녹음의 원본 파일을 연결하면 문장별로 들을 수 있어요.
                  <input
                    key={partIndex}
                    type="file"
                    accept="audio/*,.webm,.mp4,.wav,.mp3,.m4a,.ogg"
                    aria-label={`녹음 ${partIndex + 1} 원본 파일 연결`}
                    className="file-input file-input-bordered file-input-sm w-full"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file && result) {
                        stop();
                        setAttached((previous) => ({
                          result,
                          blobs: {
                            ...(previous?.result === result ? previous.blobs : {}),
                            [partIndex]: file,
                          },
                        }));
                      }
                    }}
                  />
                </label>
              </div>
            )}
            {audioError && (
              <p role="alert" className="mt-3 text-sm text-error">
                {audioError}
              </p>
            )}
            <ol className="mt-4 divide-y divide-base-300 border-y border-base-300">
              {part.lines.map((line, lineIndex) => {
                const segments = getLineSegments(part, lineIndex);
                const selected =
                  selectedLine === lineIndex && selectedWord !== undefined
                    ? segments.find(
                        (segment) =>
                          selectedWord >= segment.start &&
                          selectedWord <= segment.end &&
                          segment.mark?.category !== "panic",
                      )
                    : undefined;
                const feedback = selected?.feedback ?? [];
                const expanded = feedback.length > 0;
                const id = `script-feedback-${partIndex}-${lineIndex}`;
                const playing = playingClip?.part === partIndex && playingClip.line === lineIndex;
                return (
                  <li
                    key={`${partIndex}-${lineIndex}`}
                    className="py-4"
                    onKeyDown={(event) => {
                      if (expanded && event.key === "Escape") {
                        event.preventDefault();
                        closeFeedback();
                      }
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs tabular-nums text-base-content/65">
                        <span className="sr-only">구간 </span>
                        {timestamp(line.start)} – {timestamp(line.end)}
                      </p>
                      {!line.pause && (
                        <button
                          type="button"
                          className="btn btn-circle btn-ghost btn-sm shrink-0"
                          disabled={!recordedBlob || line.end <= line.start}
                          aria-label={`녹음 ${partIndex + 1}, ${timestamp(line.start)}부터 ${timestamp(line.end)}까지 ${playing ? "재생 중지" : "재생"}`}
                          aria-pressed={playing}
                          onClick={() => {
                            if (recordedBlob)
                              void play(recordedBlob, {
                                part: partIndex,
                                line: lineIndex,
                                start: line.start,
                                end: line.end,
                              });
                          }}
                        >
                          <span aria-hidden="true">{playing ? "■" : "▶"}</span>
                        </button>
                      )}
                    </div>
                    {line.pause ? (
                      <HighlightHint category="panic">
                        <div
                          tabIndex={0}
                          aria-label={categories.panic.description}
                          className="flex min-h-11 items-center justify-between gap-2 rounded-box bg-hl-panic-soft px-3 py-3 text-sm"
                        >
                          <span>{Math.max(0, line.end - line.start).toFixed(1)}초 정지</span>
                          <span className="text-xs text-base-content/65">패닉존</span>
                        </div>
                      </HighlightHint>
                    ) : (
                      <p
                        className={`font-script text-lg leading-loose wrap-anywhere transition-transform duration-300 motion-reduce:transition-none motion-reduce:transform-none ${expanded ? "-translate-y-1" : "translate-y-0"}`}
                      >
                        {segments.map((segment) => (
                          <span key={segment.start}>
                            {segment.mark ? (
                              <HighlightHint category={segment.mark.category}>
                                {segment.mark.category === "panic" ? (
                                  <span
                                    tabIndex={0}
                                    aria-label={`${segment.text}: ${categories.panic.description}`}
                                    className={`rounded px-1 py-0.5 ${categories.panic.style}`}
                                  >
                                    {segment.text}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    aria-label={`${segment.text}: ${categories[segment.mark.category].label} 피드백 보기`}
                                    aria-expanded={expanded && selected === segment}
                                    aria-controls={expanded ? id : undefined}
                                    onClick={(event) =>
                                      selectFeedback(lineIndex, segment.start, event.currentTarget)
                                    }
                                    className={`inline cursor-pointer rounded px-1 py-0.5 text-left hover:brightness-95 ${categories[segment.mark.category].style}`}
                                  >
                                    {segment.text}
                                  </button>
                                )}
                              </HighlightHint>
                            ) : (
                              segment.text
                            )}{" "}
                          </span>
                        ))}
                      </p>
                    )}
                    {expanded && (
                      <InlineFeedback
                        key={selected?.start}
                        id={id}
                        feedback={feedback}
                        onClose={closeFeedback}
                      />
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
      )}
    </div>
  );
}
