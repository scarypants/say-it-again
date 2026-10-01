import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { analyzeSpeaking, audioFileName, fetchQuestions } from "../../api/client";
import { ANSWER_SEC } from "../../api/questionBank";
import AnalyzingView from "../../components/common/AnalyzingView";
import LevelBars from "../../components/common/LevelBars";
import MicButton from "../../components/common/MicButton";
import { useRecorder } from "../../components/common/useRecorder";
import { useAnalysis } from "../../store/analysis";

const EXAM_NAME = { toss: "토익 스피킹", opic: "오픽" } as const;

function mmss(sec: number) {
  const s = Math.floor(sec);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

// 오픽 연습: 질문 상자(Q1.) + 마이크. 질문 5개를 하나씩 골라 답한다
export default function OpicQuestions() {
  const navigate = useNavigate();
  const { settings, setResult } = useAnalysis();
  const exam = settings.exam ?? "opic";
  const limit = ANSWER_SEC[exam];
  const rec = useRecorder(limit);

  const [questions, setQuestions] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(Blob | null)[]>(() => Array(5).fill(null));
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchQuestions(exam).then((qs) => !cancelled && setQuestions(qs));
    return () => {
      cancelled = true;
    };
  }, [exam]);

  // 화면을 떠나면 읽어 주던 질문도 멈춘다
  useEffect(() => () => void (canSpeak && speechSynthesis.cancel()), []);

  const question = questions?.[index] ?? "";
  const recording = rec.status === "recording";
  const busy = recording || rec.status === "requesting";
  const answeredCount = answers.filter(Boolean).length;

  function goTo(i: number) {
    if (canSpeak) speechSynthesis.cancel();
    rec.reset();
    setAnalyzeError(null);
    setIndex(i);
  }

  function speak() {
    if (!canSpeak || !question) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(question);
    u.lang = "en-US";
    u.rate = 0.95;
    speechSynthesis.speak(u);
  }

  function startAnswer() {
    const i = index;
    void rec.start((blob) => setAnswers((prev) => prev.map((b, j) => (j === i ? blob : b))));
  }

  // 답한 질문과 녹음을 모두 한 번에 백엔드로 (순서 유지)
  async function runAnalyze() {
    if (!questions) return;
    const pairs = questions.flatMap((q, i) => (answers[i] ? [{ question: q, audio: answers[i]! }] : []));
    if (pairs.length === 0) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await analyzeSpeaking({ exam: "opic", answers: pairs });
      setResult(result);
      navigate("/script");
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "분석 요청에 실패했어요.");
      setAnalyzing(false);
    }
  }

  if (analyzing) return <AnalyzingView />;

  return (
    <div className="flex flex-1 flex-col">
      <section className="flex items-center justify-between gap-3 pt-2 pb-4">
        <h1 className="text-xl font-bold">{EXAM_NAME[exam]} 연습</h1>
        {!busy && (
          <Link to="/" className="btn btn-ghost btn-sm">
            설정 바꾸기
          </Link>
        )}
      </section>

      {/* 질문 순서: 실제로 1~5번 순서가 있는 내용이라 번호를 붙인다 */}
      <nav aria-label="질문 선택" className="mb-3 flex gap-1.5">
        {(questions ?? Array(5).fill("")).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            disabled={busy || !questions}
            aria-current={i === index ? "step" : undefined}
            aria-label={`${i + 1}번 질문${answers[i] ? " (답변함)" : ""}`}
            className={`btn btn-sm flex-1 ${
              i === index
                ? "btn-primary"
                : answers[i]
                  ? "btn-ghost border border-primary"
                  : "btn-ghost border border-base-300"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      <article className="rounded-box border border-base-300 bg-base-100 p-5">
        {questions ? (
          <>
            <p className="text-sm font-semibold text-secondary">Q{index + 1}.</p>
            <p lang="en" className="mt-2 text-lg leading-relaxed font-medium">
              {question}
            </p>
            {canSpeak && (
              <button
                type="button"
                className="btn btn-ghost btn-sm mt-3 -ml-2"
                onClick={speak}
                disabled={busy}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M3 10v4h4l5 5V5L7 10H3Zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4ZM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z" />
                </svg>
                질문 듣기
              </button>
            )}
          </>
        ) : (
          <div className="flex h-24 items-center justify-center">
            <span className="loading loading-spinner text-secondary" />
          </div>
        )}
      </article>

      <section className="flex flex-1 flex-col items-center justify-center gap-4 py-6">
        <div className="flex w-full max-w-60 flex-col items-center gap-2">
          <p className="text-3xl font-semibold tabular-nums tracking-tight">
            <span className={recording ? "" : "text-secondary"}>{mmss(rec.elapsed)}</span>
            <span className="text-lg text-secondary"> / {mmss(limit)}</span>
          </p>
          {recording && (
            <progress
              className="progress progress-primary h-1.5 w-full"
              value={rec.elapsed}
              max={limit}
              aria-label="답변 시간"
            />
          )}
        </div>

        {rec.status !== "recorded" && <LevelBars levels={rec.levels} />}

        {rec.status === "recorded" && rec.url ? (
          <div className="flex w-full flex-col items-center gap-3">
            <audio src={rec.url} controls className="w-full" />
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={rec.reset}>
                다시 답하기
              </button>
              <a
                href={rec.url}
                download={rec.blob ? audioFileName(rec.blob) : "recording.webm"}
                className="btn btn-ghost btn-sm"
              >
                파일 저장
              </a>
            </div>
          </div>
        ) : (
          <MicButton
            recording={recording}
            disabled={rec.status === "requesting" || !questions}
            onClick={recording ? rec.stop : startAnswer}
          />
        )}

        <p className="min-h-5 text-sm text-secondary" role="status">
          {rec.status === "idle" &&
            (answers[index]
              ? "이미 답한 질문이에요. 다시 녹음하면 답변이 바뀌어요"
              : "질문을 읽고 준비되면 버튼을 눌러 영어로 답해요")}
          {rec.status === "requesting" && "마이크 권한을 허용해 주세요"}
          {recording && "시간이 다 되면 자동으로 멈춰요"}
          {rec.status === "recorded" && "답변을 저장했어요. 다음 질문으로 넘어가요"}
        </p>

        {(rec.error || analyzeError) && (
          <div role="alert" className="alert alert-error alert-soft w-full text-sm">
            {rec.error ?? analyzeError}
          </div>
        )}
      </section>

      {!busy && (rec.status === "recorded" || answeredCount > 0) && (
        <div className="flex gap-2 pt-2">
          {rec.status === "recorded" && questions && index < questions.length - 1 && (
            <button
              type="button"
              className="btn btn-outline btn-lg flex-1 border-base-300"
              onClick={() => goTo(index + 1)}
            >
              다음 질문
            </button>
          )}
          {answeredCount > 0 && (
            <button type="button" className="btn btn-primary btn-lg flex-[2]" onClick={runAnalyze}>
              {analyzeError ? "다시 분석하기" : `전체 분석하기 (${answeredCount}/5)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
