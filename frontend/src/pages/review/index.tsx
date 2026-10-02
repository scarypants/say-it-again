import PageHeader from "../../components/common/PageHeader";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { analyze, retry } from "../../api/client";
import AnalyzingView from "../../components/common/AnalyzingView";
import Collapse from "../../components/common/Collapse";
import PlayLineButton from "../../components/common/PlayLineButton";
import { mmss, partTitle, questionLine, totalDuration } from "../../components/common/scriptFormat";
import { useClipPlayer } from "../../components/common/useClipPlayer";
import { useLeaveGuard } from "../../components/common/useLeaveGuard";
import { retryPrevious, useAnalysis } from "../../store/analysis";
import { saveRecord } from "../../store/history";
import type { AnalyzeResponse, ScriptPart, TranscribeResponse } from "../../types/api";
import EditableWord from "./EditableWord";
import { isFillerWord } from "./fillers";

const canLoadSample = import.meta.env.DEV || import.meta.env.VITE_USE_MOCK === "true";

const clone = (parts: ScriptPart[]) =>
  parts.map((p) => ({ ...p, script: p.script.map((l) => ({ ...l, words: [...l.words] })) }));

// 녹음 → [1] 전사 → 이 화면(전사 오류만 고치기) → [2] 분석 → /script
export default function ReviewPage() {
  const { session, setSession, setResult, previous } = useAnalysis();

  if (!session) return <NoSession onSample={canLoadSample ? setSession : undefined} />;
  // 세션이 바뀌면 편집 상태를 새로 시작한다
  return (
    <Review
      key={session.transcript.parts.length + ":" + session.audio.length}
      transcript={session.transcript}
      audio={session.audio}
      questions={session.questions}
      setResult={setResult}
      previous={previous?.mode === session.transcript.mode ? previous : null}
    />
  );
}

type ReviewProps = {
  transcript: TranscribeResponse;
  audio: Blob[];
  questions?: string[];
  setResult: ReturnType<typeof useAnalysis>["setResult"];
  previous: AnalyzeResponse | null; // 재도전이면 이전 결과
};

function Review({ transcript, audio, questions, setResult, previous }: ReviewProps) {
  const navigate = useNavigate();
  const player = useClipPlayer();
  const [parts, setParts] = useState(() => clone(transcript.parts));
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leaveGuard = useLeaveGuard(true, "녹음과 대본이 모두 사라져요.");

  const original = transcript.parts;
  const editedCount = parts.reduce(
    (n, p, pi) =>
      n +
      p.script.filter((l, li) => l.words.join(" ") !== original[pi].script[li].words.join(" "))
        .length,
    0,
  );
  // 원본에 있던 말버릇이 지금 대본에서 빠졌으면 경고한다. 되돌리면 저절로 사라진다
  const fillerWarning = removedFiller(original, parts);

  // 한 칸을 고친다. 비우면 그 단어를 지운다 (문장이 통째로 비면 되돌린다)
  function editWord(pi: number, li: number, wi: number, value: string) {
    const before = parts[pi].script[li].words[wi];
    const nextWord = value.trim();
    if (nextWord === before) return;
    setParts((prev) => {
      const next = clone(prev);
      const words = next[pi].script[li].words;
      if (nextWord) words[wi] = nextWord;
      else words.splice(wi, 1);
      if (words.length === 0) next[pi].script[li].words = [...prev[pi].script[li].words];
      return next;
    });
  }

  function resetLine(pi: number, li: number) {
    setParts((prev) => {
      const next = clone(prev);
      next[pi].script[li].words = [...original[pi].script[li].words];
      return next;
    });
  }

  async function runAnalyze() {
    player.stop();
    setAnalyzing(true);
    setError(null);
    try {
      const req = {
        mode: transcript.mode,
        level: transcript.level,
        exam: transcript.exam,
        language: transcript.language,
        questions,
        parts,
      };
      // 재도전이면 이전 결과 요약을 같이 보내 전후 비교·개선된 점을 받는다
      const result = previous
        ? await retry({
            ...req,
            previous: retryPrevious(previous),
          })
        : await analyze(req);
      setResult(result);
      void saveRecord(audio, questions, result); // 기록에 남긴다 (실패해도 계속)
      navigate("/script");
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 요청에 실패했어요.");
      setAnalyzing(false);
    }
  }

  if (analyzing)
    return (
      <>
        <AnalyzingView step="analyze" />
        {leaveGuard}
      </>
    );

  const fillerNote = (
    <div role="note" className="alert alert-warning alert-soft text-sm">
      <span>
        <b className="font-semibold">음, 어, 그, um, uh 같은 말버릇은 고치거나 지우지 마세요.</b>
        <br />
        말한 그대로 남아 있어야 군말·막힌 구간을 찾을 수 있어요. 단어를 누르면 고칠 수 있고, 칸을
        비우면 그 단어가 지워져요.
      </span>
    </div>
  );

  // PC: 대본은 왼쪽, 안내와 분석 버튼은 오른쪽에 붙어 따라온다. 폰: 버튼이 아래에 붙는다
  return (
    <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
      <div className="flex flex-col">
        {leaveGuard}
        <PageHeader
          title="대본 확인"
          description={`총 ${mmss(totalDuration(parts))} · 문장을 눌러 들어 보고, 잘못 들린 단어만 고쳐 주세요.`}
        />

        <div className="mb-4 lg:hidden">{fillerNote}</div>

        <div className="flex flex-col gap-6">
          {parts.map((part, pi) => (
            <section key={pi} aria-labelledby={`part-${pi}`}>
              {parts.length > 1 || transcript.mode !== "presentation" ? (
                <header className="mb-2 border-b border-base-300 pb-2">
                  <h2 id={`part-${pi}`} className="text-sm font-semibold tabular-nums">
                    {partTitle(
                      transcript.mode,
                      pi,
                      part.duration,
                      questions?.[pi],
                      totalDuration(parts.slice(0, pi)),
                    )}
                  </h2>
                  {questionLine(questions?.[pi]) && (
                    <p className="mt-0.5 text-sm text-secondary">{questionLine(questions?.[pi])}</p>
                  )}
                </header>
              ) : (
                <h2 id={`part-${pi}`} className="sr-only">
                  대본
                </h2>
              )}
              <ol className="flex flex-col">
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
                  const changed = line.words.join(" ") !== original[pi].script[li].words.join(" ");
                  return (
                    <li
                      key={key}
                      className={`flex items-start gap-1 rounded-field py-1 pl-1 ${
                        player.playing === key ? "bg-base-200" : ""
                      }`}
                    >
                      <p className="min-w-0 flex-1 py-1 text-[1.0625rem] leading-8">
                        {line.words.map((w, wi) => (
                          <EditableWord
                            key={wi}
                            word={w}
                            edited={w !== original[pi].script[li].words[wi]}
                            onCommit={(v) => editWord(pi, li, wi, v)}
                          />
                        ))}
                      </p>
                      {changed && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs mt-1.5 shrink-0"
                          onClick={() => resetLine(pi, li)}
                        >
                          되돌리기
                        </button>
                      )}
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
      </div>

      <aside className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-base-100 pt-4 pb-2 lg:top-4 lg:bottom-auto lg:mt-0 lg:gap-3 lg:pt-2">
        <div className="hidden lg:block">{fillerNote}</div>
        <p className="hidden text-sm text-secondary tabular-nums lg:block">
          총 {mmss(totalDuration(parts))} · 고친 문장 {editedCount}개
        </p>
        {/* 말버릇을 고쳤다 되돌리면 자주 열리고 닫혀서, 높이째 부드럽게 접는다 */}
        <Collapse open={!!fillerWarning}>
          {fillerWarning && (
            <p role="status" className="text-center text-xs text-warning-content">
              '{fillerWarning}'처럼 말버릇을 고치면 군말 분석에서 빠져요. 잘못 들린 게 아니라면
              되돌려 주세요.
            </p>
          )}
        </Collapse>
        {(error || player.error) && (
          <div role="alert" className="alert alert-error alert-soft animate-reveal text-sm">
            {error ?? player.error}
          </div>
        )}
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={runAnalyze}>
          {editedCount > 0 ? `고친 ${editedCount}문장으로 분석하기` : "이대로 분석하기"}
        </button>
      </aside>
    </div>
  );
}

function NoSession({ onSample }: { onSample?: ReturnType<typeof useAnalysis>["setSession"] }) {
  async function loadSample() {
    const sample = (await import("../../mocks/transcribe.sample.json"))
      .default as TranscribeResponse;
    onSample?.({ audio: [], transcript: sample });
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <p className="text-lg font-semibold">확인할 대본이 없어요</p>
      <p className="text-sm text-secondary">먼저 녹음하고 "대본 만들기"를 눌러 주세요.</p>
      <div className="flex gap-2">
        <Link to="/" className="btn btn-primary">
          처음으로
        </Link>
        {onSample && (
          <button type="button" className="btn btn-ghost" onClick={() => void loadSample()}>
            예시 대본 보기
          </button>
        )}
      </div>
    </div>
  );
}

// 문장마다 원본의 말버릇 개수보다 지금 개수가 적으면 그 말버릇을 돌려준다 (고쳤거나 지운 것)
function removedFiller(original: ScriptPart[], parts: ScriptPart[]) {
  for (const [pi, p] of original.entries())
    for (const [li, line] of p.script.entries()) {
      const now = parts[pi].script[li].words;
      for (const w of new Set(line.words.filter(isFillerWord)))
        if (now.filter((x) => x === w).length < line.words.filter((x) => x === w).length) return w;
    }
  return null;
}
