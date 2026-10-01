import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { audioFileName, interviewQuestions } from "../../api/client";
import { useTranscribe } from "../../api/useTranscribe";
import AnalyzingView from "../../components/common/AnalyzingView";
import LevelBars from "../../components/common/LevelBars";
import MicButton from "../../components/common/MicButton";
import PageHeader from "../../components/common/PageHeader";
import { mmss } from "../../components/common/scriptFormat";
import { useLeaveGuard } from "../../components/common/useLeaveGuard";
import { useRecorder } from "../../components/common/useRecorder";
import { useAnalysis } from "../../store/analysis";
import type { InterviewQuestion } from "../../types/api";
import {
  ANSWER_GOAL_SEC,
  ANSWER_MAX_SEC,
  interviewQuestionText,
  interviewTypeName,
} from "./interviewItems";

type Stage = "setup" | "running" | "done";

// 면접 모의 연습 (#76): 화면을 열면 백엔드가 지원 직무에 맞춘 질문 5개를 만든다.
// 질문을 화면에 보여 주자마자 신호음과 함께 자동 녹음 (생각할 시간 없음). 어려운 질문은 건너뛸 수 있다.
// 다 말하면 버튼으로 다음 질문. 다섯 질문이 끝나면 한 번에 대본으로 만든다.
// onRestart: 음성이 감지되지 않았을 때 처음부터 다시 (부모가 새로 그린다)
export default function InterviewExam({ onRestart }: { onRestart: () => void }) {
  const { settings } = useAnalysis();
  const language = settings.language;
  const job = settings.job ?? "";
  const rec = useRecorder(ANSWER_MAX_SEC); // 2분이 되면 자동으로 멈추고 다음 질문

  const [stage, setStage] = useState<Stage>("setup");
  const [items, setItems] = useState<InterviewQuestion[]>([]);
  // 질문 생성: 화면을 열자마자 미리 받아 둔다. loadRound를 올리면 다시 받는다
  const [loadRound, setLoadRound] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<(Blob | null)[]>([]);
  const [answerUrls, setAnswerUrls] = useState<(string | null)[]>([]);
  const [startError, setStartError] = useState<string | null>(null);
  const tx = useTranscribe(); // 녹음 → 대본 → 검토 화면
  const leaveGuard = useLeaveGuard(stage !== "setup", "지금까지 녹음한 답변이 모두 사라져요.");

  const skippedRef = useRef(false); // 건너뛰기로 멈춘 녹음은 답변으로 저장하지 않는다
  const tokenRef = useRef(0); // 질문·단계가 바뀌면 이전 콜백(타이머·녹음 종료)을 무시
  const itemsRef = useRef<InterviewQuestion[]>([]);
  const answersRef = useRef<(Blob | null)[]>([]);
  const urlsRef = useRef<string[]>([]);
  const beepCtxRef = useRef<AudioContext | null>(null);

  function beep() {
    const ctx = beepCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  }

  function finish() {
    tokenRef.current++;
    const urls = answersRef.current.map((b) => (b ? URL.createObjectURL(b) : null));
    urlsRef.current = urls.filter((u): u is string => u !== null);
    setAnswerUrls(urls);
    setStage("done");
  }

  function nextQuestion(q: number) {
    if (q + 1 < itemsRef.current.length) askQuestion(q + 1);
    else finish();
  }

  // 건너뛰기: 이 질문의 답변은 비워 두고(분석에서 빠진다) 다음 질문으로. 녹음 중이면 멈춰서 버린다
  function skipQuestion(q: number) {
    if (rec.status === "recording") {
      skippedRef.current = true;
      rec.stop(); // 녹음 종료 콜백에서 비운 채로 다음 질문
      return;
    }
    tokenRef.current++;
    answersRef.current = answersRef.current.map((b, i) => (i === q ? null : b));
    setAnswers(answersRef.current);
    nextQuestion(q);
  }

  // 질문을 보여 주자마자 신호음과 함께 녹음한다 (생각할 시간 없음, docs/api.md 면접)
  function askQuestion(q: number) {
    rec.reset();
    const token = ++tokenRef.current;
    skippedRef.current = false;
    setQi(q);
    beep();
    void rec.start((blob) => {
      if (tokenRef.current !== token) return;
      const answer = skippedRef.current ? null : blob;
      answersRef.current = answersRef.current.map((b, i) => (i === q ? answer : b));
      setAnswers(answersRef.current);
      nextQuestion(q);
    });
  }

  async function start() {
    if (items.length === 0) return;
    setStartError(null);
    // 첫 질문에서 자동 녹음이 막히지 않도록 시작할 때 마이크 권한을 먼저 받는다
    if (!navigator.mediaDevices?.getUserMedia) {
      setStartError("이 주소에서는 녹음할 수 없어요. 휴대폰이라면 https 주소로 접속해 주세요.");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
    } catch {
      setStartError(
        "마이크 권한이 필요해요. 주소창 왼쪽 아이콘에서 마이크를 허용한 뒤 다시 눌러 주세요.",
      );
      return;
    }
    beepCtxRef.current = new AudioContext();
    itemsRef.current = items;
    answersRef.current = items.map(() => null);
    setAnswers(answersRef.current);
    setStage("running");
    askQuestion(0);
  }

  async function runTranscribe() {
    const pairs = items.flatMap((it, i) =>
      answers[i] ? [{ question: interviewQuestionText(it, i, job), audio: answers[i]! }] : [],
    );
    if (pairs.length === 0) return;
    await tx.run({
      mode: "interview",
      language,
      questions: pairs.map((p) => p.question),
      audio: pairs.map((p) => p.audio),
    });
  }

  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    interviewQuestions({ language, job })
      .then((res) => {
        if (cancelled) return;
        if (res.questions.length === 0) throw new Error("질문을 받지 못했어요.");
        setItems(res.questions);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "질문을 만들지 못했어요.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [language, job, loadRound]);

  // 화면을 떠나면 진행 중인 단계·녹음 URL 정리
  useEffect(
    () => () => {
      tokenRef.current++;
      beepCtxRef.current?.close().catch(() => {});
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  if (tx.busy)
    return (
      <>
        <AnalyzingView />
        {leaveGuard}
      </>
    );

  // 새로고침 등으로 직무 설정이 사라졌으면 홈에서 다시 고른다
  if (!job)
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="면접 연습" />
        <p className="text-[0.9375rem] leading-relaxed">지원 직무를 먼저 적어 주세요.</p>
        <div className="sticky bottom-0 mt-auto bg-base-100 pt-6 pb-2">
          <Link to="/" className="btn btn-primary btn-lg btn-block">
            처음으로
          </Link>
        </div>
      </div>
    );

  if (stage === "setup") {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader
          title="면접 연습"
          description={`${job} · ${language === "en" ? "영어" : "한국어"}로 답해요`}
          action={
            <Link to="/" className="btn btn-ghost btn-sm">
              설정 바꾸기
            </Link>
          }
        />
        <p className="text-[0.9375rem] leading-relaxed">
          AI가 {job} 직무에 맞춰 만든 다섯 질문에 답해요. 자기소개로 시작해 마무리로 끝나요. 질문이
          나오면 신호음과 함께 바로 녹음돼요.
        </p>
        <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-secondary">
          <li>
            답변은 {ANSWER_GOAL_SEC / 60}분 안팎을 권해요. {ANSWER_MAX_SEC / 60}분이 되면 다음
            질문으로 넘어가요.
          </li>
          <li>결론을 먼저 말하고, 구체적인 경험으로 뒷받침해 보세요.</li>
          <li>답하기 어려운 질문은 건너뛸 수 있어요. 건너뛴 질문은 분석에서 빠져요.</li>
          <li>이전 질문으로는 돌아갈 수 없어요.</li>
        </ul>
        {loadError && (
          <div role="alert" className="alert alert-error alert-soft mt-4 text-sm">
            {loadError}
          </div>
        )}
        {startError && (
          <div role="alert" className="alert alert-error alert-soft mt-4 text-sm">
            {startError}
          </div>
        )}
        <div className="sticky bottom-0 mt-auto bg-base-100 pt-6 pb-2">
          {loadError ? (
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              onClick={() => {
                setLoading(true);
                setLoadError(null);
                setLoadRound((r) => r + 1);
              }}
            >
              질문 다시 만들기
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              onClick={start}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  질문 만드는 중
                </>
              ) : (
                "면접 시작"
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="flex flex-1 flex-col">
        {leaveGuard}
        <PageHeader
          title="면접이 끝났어요"
          description="질문과 답변을 확인하고, 다섯 답변을 한 번에 분석해요."
        />
        <ul className="flex flex-col gap-3">
          {items.map((it, i) => (
            <li key={i} className="rounded-box border border-base-300 p-4">
              <p>
                <span className="font-semibold">Q{i + 1}</span>{" "}
                <span className="text-secondary">{interviewTypeName(it.type)}</span>
              </p>
              <p lang={language} className="mt-2 text-sm leading-relaxed">
                {it.text}
              </p>
              {answerUrls[i] ? (
                <>
                  <audio src={answerUrls[i]!} controls className="mt-3 w-full" />
                  <div className="mt-2 flex justify-end">
                    <a
                      href={answerUrls[i]!}
                      download={`q${i + 1}-${audioFileName(answers[i]!)}`}
                      className="btn btn-ghost btn-sm"
                    >
                      파일 저장
                    </a>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-secondary">건너뛴 질문이라 분석에서 빠져요.</p>
              )}
            </li>
          ))}
        </ul>
        {!answers.some(Boolean) && (
          <p className="mt-4 text-sm text-secondary">
            모든 질문을 건너뛰어 분석할 답변이 없어요. 처음부터 다시 해 보세요.
          </p>
        )}
        {tx.error && (
          <div role="alert" className="alert alert-error alert-soft mt-4 text-sm">
            {tx.error}
          </div>
        )}
        <div className="sticky bottom-0 mt-auto flex gap-2 bg-base-100 pt-4 pb-2">
          <Link to="/" className="btn btn-ghost btn-lg flex-1">
            처음으로
          </Link>
          <button
            type="button"
            className="btn btn-primary btn-lg flex-[2]"
            onClick={tx.noSpeech ? onRestart : runTranscribe}
            disabled={!answers.some(Boolean)}
          >
            {tx.noSpeech ? "처음부터 다시 하기" : tx.error ? "다시 시도하기" : "대본 만들기"}
          </button>
        </div>
      </div>
    );
  }

  const item = items[qi];
  const overGoal = rec.elapsed >= ANSWER_GOAL_SEC;
  const skipButton = (
    <button type="button" className="btn btn-ghost btn-sm" onClick={() => skipQuestion(qi)}>
      {qi + 1 < items.length ? "이 질문 건너뛰기" : "건너뛰고 끝내기"}
    </button>
  );

  return (
    <div className="flex flex-1 flex-col">
      {leaveGuard}
      {/* 진행 표시: 순서대로만 진행되므로 누를 수 없다 */}
      <div className="flex items-center gap-3 pt-2 pb-3">
        <div className="flex flex-1 gap-1" aria-hidden>
          {items.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ease-soft ${i <= qi ? "bg-primary" : "bg-base-300"}`}
            />
          ))}
        </div>
        <span className="text-sm tabular-nums text-secondary">
          {qi + 1} / {items.length}
        </span>
      </div>

      {/* 다음 질문으로 넘어가면 질문이 새로 올라온다 */}
      <section key={`q${qi}`} className="flex flex-1 animate-enter flex-col justify-center py-6">
        <p className="text-sm text-secondary">
          Q{qi + 1} · {interviewTypeName(item.type)}
        </p>
        <h1 lang={language} className="mt-2 text-2xl leading-snug font-bold">
          {item.text}
        </h1>
      </section>

      <section className="flex flex-col items-center gap-3 pt-2 pb-2" aria-live="polite">
        <p className="text-sm font-semibold">
          {rec.status === "recording" ? "답변 녹음 중" : "녹음 준비 중"}
        </p>
        <p className="text-4xl font-semibold tabular-nums tracking-tight">
          {mmss(rec.elapsed)}
          <span className="text-lg font-medium text-secondary"> / {mmss(ANSWER_GOAL_SEC)}</span>
        </p>
        <LevelBars levels={rec.levels} />
        <MicButton size="md" recording={rec.status === "recording"} onClick={() => rec.stop()} />
        <p className="text-xs text-secondary">
          {overGoal
            ? `권장 시간이 지났어요. ${mmss(ANSWER_MAX_SEC - rec.elapsed)} 뒤 다음 질문으로 넘어가요`
            : "다 말했으면 버튼을 눌러 다음 질문으로"}
        </p>
        {skipButton}

        {rec.error && (
          <div role="alert" className="alert alert-error alert-soft w-full text-sm">
            {rec.error}
            <button type="button" className="btn btn-sm" onClick={() => nextQuestion(qi)}>
              다음 질문으로
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
