import { useEffect, useMemo, useRef, useState } from "react";
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
import { isInterview, useAnalysis } from "../../store/analysis";
import {
  ANSWER_GOAL_SEC,
  ANSWER_MAX_SEC,
  interviewQuestionText,
  interviewTypeName,
  parseInterviewQuestion,
  practiceItem,
  type ExamItem,
} from "./interviewItems";

type Stage = "setup" | "running" | "done";

const TOEIC_MAX_SEC = 60; // 토익 꼬리질문(Part 3·5) 답변 상한. 서버도 답변당 60초

// 안내 문장용 시간: 30 → "30초", 120 → "2분"
const secText = (sec: number) => (sec % 60 ? `${sec}초` : `${sec / 60}분`);

// 면접 모의 연습 (#76): 화면을 열면 백엔드가 지원 직무에 맞춘 질문 5개를 만든다.
// 질문을 화면에 보여 주자마자 신호음과 함께 자동 녹음 (생각할 시간 없음). 어려운 질문은 건너뛸 수 있다.
// 다 말하면 버튼으로 다음 질문. 다섯 질문이 끝나면 한 번에 대본으로 만든다.
// "다시, 말해" 재도전이면 질문을 새로 만들지 않고 지난번 질문 그대로, 질문마다 지난 모범 답안을 펼쳐 볼 수 있다.
// 꼬리질문 연습(settings.practice)도 이 화면을 쓴다: 결과 화면에서 받은 질문 1~3개에 같은 방식으로 답한다 (스피킹 포함).
// onRestart: 음성이 감지되지 않았을 때 처음부터 다시 (부모가 새로 그린다)
export default function InterviewExam({ onRestart }: { onRestart: () => void }) {
  const { settings, previous } = useAnalysis();
  const language = settings.language;
  const practice = settings.practice?.length ? settings.practice : null;
  const isSpeaking = settings.mode === "speaking";
  // 재도전: 지난번 질문 문자열에서 질문과 직무를 되살린다
  const retry = useMemo(
    () =>
      previous && isInterview(previous) && settings.retryQuestions?.length
        ? settings.retryQuestions.map(parseInterviewQuestion)
        : null,
    [previous, settings.retryQuestions],
  );
  const job = settings.job ?? retry?.[0]?.job ?? "";
  const maxSec = settings.exam === "TOEIC-Speaking" ? TOEIC_MAX_SEC : ANSWER_MAX_SEC;
  const rec = useRecorder(maxSec); // 상한이 되면 자동으로 멈추고 다음 질문

  const [stage, setStage] = useState<Stage>("setup");
  // 재도전·꼬리질문은 받은 질문 문자열(prompt)을 그대로 다시 보낸다
  const [items, setItems] = useState<ExamItem[]>(
    () =>
      practice?.map((q) => practiceItem(q, settings.mode)) ??
      retry?.map((r, i) => ({ ...r.question, prompt: settings.retryQuestions![i] })) ??
      [],
  );
  const kindName = practice ? (isSpeaking ? "연습" : "꼬리질문 연습") : "면접";
  // 질문 생성: 화면을 열자마자 미리 받아 둔다. loadRound를 올리면 다시 받는다
  const [loadRound, setLoadRound] = useState(0);
  const [loading, setLoading] = useState(!retry && !practice);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<(Blob | null)[]>([]);
  const [answerUrls, setAnswerUrls] = useState<(string | null)[]>([]);
  const [startError, setStartError] = useState<string | null>(null);
  const tx = useTranscribe(); // 녹음 → 대본 → 검토 화면
  const leaveGuard = useLeaveGuard(stage !== "setup", "지금까지 녹음한 답변이 모두 사라져요.");

  const skippedRef = useRef(false); // 건너뛰기로 멈춘 녹음은 답변으로 저장하지 않는다
  const tokenRef = useRef(0); // 질문·단계가 바뀌면 이전 콜백(타이머·녹음 종료)을 무시
  const itemsRef = useRef<ExamItem[]>([]);
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
      answers[i]
        ? [{ question: it.prompt ?? interviewQuestionText(it, i, job), audio: answers[i]! }]
        : [],
    );
    if (pairs.length === 0) return;
    await tx.run({
      mode: settings.mode,
      language,
      exam: settings.exam,
      questions: pairs.map((p) => p.question),
      audio: pairs.map((p) => p.audio),
    });
  }

  useEffect(() => {
    if (!job || retry || practice) return;
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
  }, [language, job, loadRound, retry, practice]);

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
  if (!job && !practice)
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
          title={retry ? "다시, 말해" : practice ? kindName : "면접 연습"}
          description={`${job ? `${job} · ` : ""}${language === "en" ? "영어" : "한국어"}로 답해요`}
          action={
            <Link to="/" className="btn btn-ghost btn-sm">
              설정 바꾸기
            </Link>
          }
        />
        <p className="text-[0.9375rem] leading-relaxed">
          {practice
            ? `결과 화면에서 받은 질문 ${items.length}개에 답해요. 끝나면 이 답변만 따로 분석해 드려요.`
            : retry
              ? `지난번과 같은 질문 ${items.length}개에 다시 답해요. 질문마다 지난번 모범 답안을 펼쳐 볼 수 있고, 끝나면 지난번과 비교해 드려요.`
              : `AI가 ${job} 직무에 맞춰 만든 다섯 질문에 답해요. 자기소개로 시작해 마무리로 끝나요.`}{" "}
          질문이 나오면 신호음과 함께 바로 녹음돼요.
        </p>
        <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-secondary">
          <li>
            답변은 {secText(items[0]?.goalSec ?? ANSWER_GOAL_SEC)} 안팎을 권해요.{" "}
            {secText(maxSec)}이 되면 다음 질문으로 넘어가요.
          </li>
          <li>
            {isSpeaking
              ? "의견이나 답을 먼저 말하고, 이유와 예시를 붙여 보세요."
              : "결론을 먼저 말하고, 구체적인 경험으로 뒷받침해 보세요."}
          </li>
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
                `${practice ? "연습" : "면접"} 시작`
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
          title={`${kindName}이 끝났어요`}
          description={`질문과 답변을 확인하고, 답한 ${answers.filter(Boolean).length}개를 한 번에 분석해요.`}
        />
        <ul className="flex flex-col gap-3">
          {items.map((it, i) => (
            <li key={i} className="rounded-box border border-base-300 p-4">
              <p>
                <span className="font-semibold">Q{i + 1}</span>{" "}
                <span className="text-secondary">{it.label ?? interviewTypeName(it.type)}</span>
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
  const goal = item.goalSec ?? ANSWER_GOAL_SEC;
  const overGoal = rec.elapsed >= goal;
  // 재도전: 이 질문의 지난 모범 답안 (previous.parts는 지난번 질문과 같은 순서)
  const modelAnswer = retry
    ? previous?.parts[qi]?.final.map((l) => l.words.join(" ")).join(" ")
    : undefined;
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
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ease-soft ${i <= qi ? "bg-primary" : "bg-base-300"}`}
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
          Q{qi + 1} · {item.label ?? interviewTypeName(item.type)}
        </p>
        <h1 lang={language} className="mt-2 text-2xl leading-snug font-bold">
          {item.text}
        </h1>
        {item.context && (
          <p lang={language} className="mt-3 text-sm leading-relaxed text-secondary">
            {item.context}
          </p>
        )}
        {modelAnswer && (
          <details className="mt-4 rounded-box bg-base-200 px-4 py-3 text-sm">
            <summary className="cursor-pointer font-medium">지난번 모범 답안 보기</summary>
            <p lang={language} className="mt-2 leading-relaxed">
              {modelAnswer}
            </p>
          </details>
        )}
      </section>

      <section className="flex flex-col items-center gap-3 pt-2 pb-2" aria-live="polite">
        <p className="text-sm font-semibold">
          {rec.status === "recording" ? "답변 녹음 중" : "녹음 준비 중"}
        </p>
        <p className="-mt-2 text-sm font-semibold text-accent">
          {language === "en" ? "영어" : "한국어"}로 답해 주세요
        </p>
        <p className="text-4xl font-semibold tabular-nums tracking-tight">
          {mmss(rec.elapsed)}
          <span className="text-lg font-medium text-secondary"> / {mmss(goal)}</span>
        </p>
        <LevelBars levels={rec.levels} />
        <MicButton
          key={qi}
          size="md"
          recording={rec.status === "recording"}
          onClick={() => rec.stop()}
        />
        <p className="text-xs text-secondary">
          {overGoal
            ? `권장 시간이 지났어요. ${mmss(maxSec - rec.elapsed)} 뒤 다음 질문으로 넘어가요`
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
