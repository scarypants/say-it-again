import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { analyzeSpeaking, audioFileName } from "../../api/client";
import AnalyzingView from "../../components/common/AnalyzingView";
import LevelBars from "../../components/common/LevelBars";
import MicButton from "../../components/common/MicButton";
import { useLeaveGuard } from "../../components/common/useLeaveGuard";
import { useRecorder } from "../../components/common/useRecorder";
import { useAnalysis } from "../../store/analysis";
import {
  ANSWER_GOAL_SEC,
  ANSWER_MAX_SEC,
  buildOpicExam,
  HARD_LEVEL,
  opicQuestionText,
  REPLAY_WINDOW_SEC,
  SELF_LEVELS,
  SURVEY_TOPICS,
  type OpicItem,
} from "./opicItems";

const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

function mmss(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

type Stage = "setup" | "running" | "done";
// listen: Ava가 질문을 읽는 중 / replay: 다시 듣기를 고를 수 있는 5초 / speak: 답변 녹음
type Phase = "listen" | "replay" | "speak";

// 오픽 모의시험: 서베이·자가 평가 → 질문은 소리로만 → 5초 안에 한 번 다시 듣기 → 자동 녹음.
// 다 말하면 버튼으로 다음 문제. 이전 문제로는 돌아갈 수 없다.
export default function OpicExam() {
  const navigate = useNavigate();
  const { setResult } = useAnalysis();
  const rec = useRecorder(ANSWER_MAX_SEC); // 3분이 되면 자동으로 멈추고 다음 문제

  const [stage, setStage] = useState<Stage>("setup");
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [level, setLevel] = useState<number | null>(null);
  const [items, setItems] = useState<OpicItem[]>([]);
  const [qi, setQi] = useState(0);
  const [phase, setPhase] = useState<Phase>("listen");
  const [replayEndsAt, setReplayEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [answers, setAnswers] = useState<(Blob | null)[]>([]);
  const [answerUrls, setAnswerUrls] = useState<(string | null)[]>([]);
  const [startError, setStartError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  // 시험을 시작한 뒤에는 다른 화면으로 가기 전에 확인 (답변 녹음이 사라지므로)
  const leaveGuard = useLeaveGuard(stage !== "setup", "지금까지 녹음한 답변이 모두 사라져요.");

  const timerRef = useRef<number | null>(null);
  const tokenRef = useRef(0); // 문제·단계가 바뀌면 이전 콜백(타이머·TTS·녹음 종료)을 무시
  const itemsRef = useRef<OpicItem[]>([]);
  const answersRef = useRef<(Blob | null)[]>([]);
  const urlsRef = useRef<string[]>([]);
  const beepCtxRef = useRef<AudioContext | null>(null);

  function clearTimer() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }

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

  // 문장마다 나눠 읽는다. 긴 문장 하나는 크롬에서 15초쯤에 끊기는 일이 있다
  function speakThen(text: string, token: number, onEnd: () => void) {
    const words = text.split(/\s+/).length;
    const finish = () => {
      if (tokenRef.current !== token) return;
      clearTimer();
      onEnd();
    };
    if (!canSpeak) {
      // 소리를 못 내면 화면에 글로 보여 주고 읽을 시간을 준다
      timerRef.current = window.setTimeout(finish, Math.max(5000, words * 400));
      return;
    }
    speechSynthesis.cancel();
    const sentences = text.match(/[^.?!]+[.?!]+/g) ?? [text];
    sentences.forEach((s, i) => {
      const u = new SpeechSynthesisUtterance(s.trim());
      u.lang = "en-US";
      u.rate = 0.95;
      if (i === sentences.length - 1) {
        u.onend = finish;
        u.onerror = finish;
      }
      speechSynthesis.speak(u);
    });
    // onend가 안 오는 브라우저 대비 안전 타이머 (단어당 0.45초 + 문장당 0.5초 + 2초)
    timerRef.current = window.setTimeout(finish, words * 450 + sentences.length * 500 + 2000);
  }

  function finishExam() {
    clearTimer();
    tokenRef.current++;
    const urls = answersRef.current.map((b) => (b ? URL.createObjectURL(b) : null));
    urlsRef.current = urls.filter((u): u is string => u !== null);
    setAnswerUrls(urls);
    setStage("done");
  }

  function nextQuestion(q: number) {
    if (q + 1 < itemsRef.current.length) askQuestion(q + 1);
    else finishExam();
  }

  function startSpeaking(q: number) {
    clearTimer();
    const token = ++tokenRef.current;
    if (canSpeak) speechSynthesis.cancel();
    setReplayEndsAt(null);
    setPhase("speak");
    beep();
    void rec.start((blob) => {
      if (tokenRef.current !== token) return;
      answersRef.current = answersRef.current.map((b, i) => (i === q ? blob : b));
      setAnswers(answersRef.current);
      nextQuestion(q);
    });
  }

  // replayed: 이미 한 번 다시 들었으면 끝나자마자 답변
  function listen(q: number, replayed: boolean) {
    clearTimer();
    const token = ++tokenRef.current;
    setReplayEndsAt(null);
    setPhase("listen");
    speakThen(itemsRef.current[q].text, token, () => {
      if (replayed || !canSpeak) return startSpeaking(q);
      setPhase("replay");
      setReplayEndsAt(Date.now() + REPLAY_WINDOW_SEC * 1000);
      setNow(Date.now());
      timerRef.current = window.setTimeout(() => {
        if (tokenRef.current === token) startSpeaking(q);
      }, REPLAY_WINDOW_SEC * 1000);
    });
  }

  function askQuestion(q: number) {
    rec.reset();
    setQi(q);
    listen(q, false);
  }

  function toggleTopic(id: string) {
    setTopicIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function startExam() {
    if (!level || topicIds.length === 0) return;
    setStartError(null);
    // 첫 문제에서 자동 녹음이 막히지 않도록 시작할 때 마이크 권한을 먼저 받는다
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
    const exam = buildOpicExam(topicIds, level);
    itemsRef.current = exam;
    answersRef.current = exam.map(() => null);
    setItems(exam);
    setAnswers(answersRef.current);
    setStage("running");
    askQuestion(0);
  }

  // 답변 중 버튼 = 지금 답변을 끝내고 다음 문제 (onRecorded에서 넘어간다)
  function stopEarly() {
    rec.stop();
  }

  async function runAnalyze() {
    if (!level) return;
    const pairs = items.flatMap((it, i) =>
      answers[i] ? [{ question: opicQuestionText(it, i, level), audio: answers[i]! }] : [],
    );
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

  // 다시 듣기 남은 시간 표시용 시계
  useEffect(() => {
    if (phase !== "replay") return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [phase]);

  // 화면을 떠나면 진행 중인 단계·음성·녹음 URL 정리
  useEffect(
    () => () => {
      tokenRef.current++;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (canSpeak) speechSynthesis.cancel();
      beepCtxRef.current?.close().catch(() => {});
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  if (analyzing)
    return (
      <>
        <AnalyzingView />
        {leaveGuard}
      </>
    );

  if (stage === "setup") {
    const ready = topicIds.length > 0 && level !== null;
    return (
      <div className="flex flex-1 flex-col">
        <section className="flex items-center justify-between gap-3 pt-2 pb-4">
          <h1 className="text-xl font-bold">오픽 모의시험</h1>
          <Link to="/" className="btn btn-ghost btn-sm">
            설정 바꾸기
          </Link>
        </section>
        <p className="text-[0.9375rem] leading-relaxed">
          실제 시험처럼 자기소개, 고른 주제의 질문 세 개, 롤플레이 순서로 다섯 문제를 풀어요. 질문은
          소리로만 나오고, 끝나면 신호음과 함께 자동으로 녹음돼요.
        </p>

        <fieldset className="mt-6">
          <legend className="font-semibold">관심 있는 주제</legend>
          <p className="mt-0.5 text-sm text-secondary">
            Background Survey예요. 고른 주제 중 하나로 질문 세 개가 이어져요.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SURVEY_TOPICS.map((t) => {
              const on = topicIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTopic(t.id)}
                  className={`btn btn-sm ${on ? "btn-primary" : "btn-ghost border border-base-300"}`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="font-semibold">내 영어 수준</legend>
          <p className="mt-0.5 text-sm text-secondary">
            Self Assessment예요. {HARD_LEVEL}단계 이상이면 롤플레이가 문제 해결형으로 바뀌어요.
          </p>
          <div className="mt-3 divide-y divide-base-300 rounded-box border border-base-300">
            {SELF_LEVELS.map((l) => (
              <label key={l.level} className="flex cursor-pointer items-start gap-3 px-4 py-3">
                <input
                  type="radio"
                  name="opic-level"
                  className="radio radio-primary radio-sm mt-0.5"
                  checked={level === l.level}
                  onChange={() => setLevel(l.level)}
                />
                <span className="text-sm leading-relaxed">
                  <span className="font-semibold tabular-nums">{l.level}단계</span>{" "}
                  <span className="text-secondary">{l.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-secondary">
          <li>질문이 끝나고 {REPLAY_WINDOW_SEC}초 안에 한 번 더 들을 수 있어요.</li>
          <li>
            문제마다 {ANSWER_GOAL_SEC / 60}분 안팎으로 답해요. {ANSWER_MAX_SEC / 60}분이 되면 다음
            문제로 넘어가요.
          </li>
          <li>이전 문제로는 돌아갈 수 없어요. 질문 글은 시험이 끝나면 보여 드려요.</li>
          <li>소리가 나오니 스피커나 이어폰을 켜 주세요.</li>
        </ul>
        {startError && (
          <div role="alert" className="alert alert-error alert-soft mt-4 text-sm">
            {startError}
          </div>
        )}
        <div className="sticky bottom-0 mt-auto bg-base-100 pt-6 pb-2">
          {!ready && (
            <p className="mb-2 text-center text-xs text-secondary">
              {topicIds.length === 0 ? "주제를 하나 이상 골라 주세요" : "영어 수준을 골라 주세요"}
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            onClick={startExam}
            disabled={!ready}
          >
            시험 시작
          </button>
        </div>
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="flex flex-1 flex-col">
        {leaveGuard}
        <section className="pt-2 pb-4">
          <h1 className="text-xl font-bold">시험이 끝났어요</h1>
          <p className="mt-1 text-sm text-secondary">
            질문과 답변을 확인하고, 다섯 문제를 한 번에 분석해요.
          </p>
        </section>
        <ul className="flex flex-col gap-3">
          {items.map((it, i) => (
            <li key={i} className="rounded-box border border-base-300 p-4">
              <p>
                <span className="font-semibold">Q{i + 1}</span>{" "}
                <span className="text-secondary">
                  {it.name}
                  {it.topic && `, ${it.topic.label}`}
                </span>
              </p>
              <p lang="en" className="mt-2 text-sm leading-relaxed">
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
                <p className="mt-2 text-sm text-secondary">녹음된 답변이 없어요.</p>
              )}
            </li>
          ))}
        </ul>
        {analyzeError && (
          <div role="alert" className="alert alert-error alert-soft mt-4 text-sm">
            {analyzeError}
          </div>
        )}
        <div className="sticky bottom-0 mt-auto flex gap-2 bg-base-100 pt-4 pb-2">
          <Link to="/" className="btn btn-ghost btn-lg flex-1">
            처음으로
          </Link>
          <button
            type="button"
            className="btn btn-primary btn-lg flex-[2]"
            onClick={runAnalyze}
            disabled={!answers.some(Boolean)}
          >
            {analyzeError ? "다시 분석하기" : "전체 분석하기"}
          </button>
        </div>
      </div>
    );
  }

  const item = items[qi];
  const speaking = phase === "speak";
  const replayLeft = replayEndsAt ? (replayEndsAt - now) / 1000 : 0;
  const overGoal = rec.elapsed >= ANSWER_GOAL_SEC;

  return (
    <div className="flex flex-1 flex-col">
      {leaveGuard}
      {/* 진행 표시: 순서대로만 진행되므로 누를 수 없다 */}
      <div className="flex items-center gap-3 pt-2 pb-3">
        <div className="flex flex-1 gap-1" aria-hidden>
          {items.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= qi ? "bg-primary" : "bg-base-300"}`}
            />
          ))}
        </div>
        <span className="text-sm tabular-nums text-secondary">
          {qi + 1} / {items.length}
        </span>
      </div>

      <h1 className="text-xl font-bold">Question {qi + 1}</h1>
      <p className="mt-1 text-sm text-secondary">{item.name}</p>

      {/* Ava: 질문은 소리로만. 읽는 동안 고리가 퍼진다 */}
      <section className="flex flex-1 flex-col items-center justify-center gap-3 py-6">
        <div className="relative flex h-28 w-28 items-center justify-center" aria-hidden>
          {phase === "listen" && canSpeak && (
            <span className="absolute inset-0 rounded-full bg-primary/15 motion-safe:animate-ping" />
          )}
          <span
            className={`relative flex h-24 w-24 items-center justify-center rounded-full text-2xl font-semibold ${
              speaking ? "bg-base-200 text-secondary" : "bg-primary text-primary-content"
            }`}
          >
            Ava
          </span>
        </div>
        <p className="text-sm font-semibold" aria-live="polite">
          {phase === "listen" && (canSpeak ? "Ava가 질문하는 중" : "질문을 읽어 주세요")}
          {phase === "replay" && "질문을 한 번 더 들을 수 있어요"}
          {speaking && "답변 녹음 중"}
        </p>
        {/* TTS가 없는 브라우저에서만 질문 글을 보여 준다 */}
        {!canSpeak && phase === "listen" && (
          <p lang="en" className="text-lg leading-relaxed font-medium">
            {item.text}
          </p>
        )}
      </section>

      <section className="flex flex-col items-center gap-3 pt-2 pb-2">
        {phase === "replay" && (
          <>
            <p className="text-4xl font-semibold tabular-nums tracking-tight">
              {Math.max(0, Math.ceil(replayLeft))}
            </p>
            <div className="flex w-full gap-2">
              <button
                type="button"
                className="btn btn-outline btn-lg flex-1 border-base-300"
                onClick={() => listen(qi, true)}
              >
                다시 듣기
              </button>
              <button
                type="button"
                className="btn btn-primary btn-lg flex-1"
                onClick={() => startSpeaking(qi)}
              >
                바로 답하기
              </button>
            </div>
            <p className="text-xs text-secondary">시간이 지나면 신호음과 함께 녹음이 시작돼요</p>
          </>
        )}

        {speaking && (
          <>
            <p className="text-4xl font-semibold tabular-nums tracking-tight">
              {mmss(rec.elapsed)}
              <span className="text-lg font-medium text-secondary"> / {mmss(ANSWER_GOAL_SEC)}</span>
            </p>
            <LevelBars levels={rec.levels} />
            <MicButton size="md" recording={rec.status === "recording"} onClick={stopEarly} />
            <p className="text-xs text-secondary">
              {overGoal
                ? `권장 시간이 지났어요. ${mmss(ANSWER_MAX_SEC - rec.elapsed)} 뒤 다음 문제로 넘어가요`
                : "다 말했으면 버튼을 눌러 다음 문제로"}
            </p>
          </>
        )}

        {rec.error && (
          <div role="alert" className="alert alert-error alert-soft w-full text-sm">
            {rec.error}
            <button type="button" className="btn btn-sm" onClick={() => nextQuestion(qi)}>
              다음 문제로
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
