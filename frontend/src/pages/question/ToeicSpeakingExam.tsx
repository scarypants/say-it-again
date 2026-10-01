import PageHeader from "../../components/common/PageHeader";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { audioFileName } from "../../api/client";
import { useTranscribe } from "../../api/useTranscribe";
import AnalyzingView from "../../components/common/AnalyzingView";
import LevelBars from "../../components/common/LevelBars";
import MicButton from "../../components/common/MicButton";
import { useLeaveGuard } from "../../components/common/useLeaveGuard";
import { useRecorder } from "../../components/common/useRecorder";
import CafeteriaScene from "./CafeteriaScene";
import {
  TOEIC_SPEAKING_ITEMS,
  toeicSpeakingQuestionText,
  type Phase,
  type ToeicSpeakingItem,
} from "./toeicSpeakingItems";

const PHASE_LABEL: Record<Phase["kind"], string> = {
  read: "자료 읽기",
  listen: "질문 듣는 중",
  prep: "준비 시간",
  speak: "답변 시간",
};

const ANSWER_HARD_MAX_SEC = 60; // 서버가 받는 답변 하나의 최대 길이
const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

function mmss(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function totalSec(item: ToeicSpeakingItem, kind: "prep" | "speak") {
  const p = item.phases.find((x) => x.kind === kind);
  return p && "sec" in p ? p.sec : 0;
}

type Stage = "intro" | "running" | "done";

// 토익 스피킹 모의시험: 질문 듣기/보기 → 준비 → 자동 녹음. 답변 시간이 끝나면 신호음으로 알리고 녹음은 계속한다.
// 마이크 버튼을 누르면 녹음을 끝내고 다음 문제. 이전 문제로는 돌아갈 수 없다.
export default function ToeicSpeakingExam() {
  // 답변 시간이 끝나도 녹음은 계속하되, 서버 상한(답변당 60초, docs/api.md)에서 멈추고 다음 문제
  const rec = useRecorder(ANSWER_HARD_MAX_SEC);

  const [stage, setStage] = useState<Stage>("intro");
  const [qi, setQi] = useState(0);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [answers, setAnswers] = useState<(Blob | null)[]>(() =>
    TOEIC_SPEAKING_ITEMS.map(() => null),
  );
  const [answerUrls, setAnswerUrls] = useState<(string | null)[]>([]);
  const [startError, setStartError] = useState<string | null>(null);
  const tx = useTranscribe(); // 녹음 → 대본 → 검토 화면
  const analyzing = tx.busy;
  const analyzeError = tx.error;
  // 시험을 시작한 뒤에는 다른 화면으로 가기 전에 확인 (답변 녹음이 사라지므로)
  const leaveGuard = useLeaveGuard(stage !== "intro", "지금까지 녹음한 답변이 모두 사라져요.");

  const timerRef = useRef<number | null>(null);
  const tokenRef = useRef(0); // 단계가 바뀌면 이전 단계의 콜백(타이머·TTS·녹음 종료)을 무시
  const posRef = useRef({ q: 0, p: 0 }); // 지금 진행 중인 문제·단계 (건너뛰기용)
  const answersRef = useRef<(Blob | null)[]>(answers);
  const urlsRef = useRef<string[]>([]);
  const beepCtxRef = useRef<AudioContext | null>(null);

  function clearTimer() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  // 실제 시험처럼 준비·답변 시작에 짧은 신호음. 답변 시간이 끝날 때는 낮은 음
  function beep(freq = 880) {
    const ctx = beepCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  }

  function speakThen(text: string | undefined, token: number, onEnd: () => void) {
    const finish = () => {
      if (tokenRef.current !== token) return;
      onEnd();
    };
    if (!canSpeak || !text) {
      timerRef.current = window.setTimeout(finish, 1500);
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    u.onend = finish;
    u.onerror = finish;
    // onend가 안 오는 브라우저 대비 안전 타이머 (단어당 0.45초 + 2초)
    timerRef.current = window.setTimeout(finish, text.split(" ").length * 450 + 2000);
    speechSynthesis.speak(u);
  }

  function finishExam() {
    clearTimer();
    tokenRef.current++;
    setPhase(null);
    setEndsAt(null);
    const urls = answersRef.current.map((b) => (b ? URL.createObjectURL(b) : null));
    urlsRef.current = urls.filter((u): u is string => u !== null);
    setAnswerUrls(urls);
    setStage("done");
  }

  function nextQuestion(q: number) {
    if (q + 1 < TOEIC_SPEAKING_ITEMS.length) runPhase(q + 1, 0);
    else finishExam();
  }

  function runPhase(q: number, p: number) {
    clearTimer();
    const token = ++tokenRef.current;
    const item = TOEIC_SPEAKING_ITEMS[q];
    const ph = item.phases[p];
    if (!ph) return nextQuestion(q);

    posRef.current = { q, p };
    setQi(q);
    setPhase(ph);
    const next = () => tokenRef.current === token && runPhase(q, p + 1);

    if (ph.kind === "listen") {
      setEndsAt(null);
      speakThen(item.listenText, token, next);
      return;
    }

    setEndsAt(Date.now() + ph.sec * 1000);
    setNow(Date.now());

    if (ph.kind === "speak") {
      beep();
      void rec.start((blob) => {
        if (tokenRef.current !== token) return;
        answersRef.current = answersRef.current.map((b, i) => (i === q ? blob : b));
        setAnswers(answersRef.current);
        nextQuestion(q);
      });
      timerRef.current = window.setTimeout(() => beep(440), ph.sec * 1000);
    } else {
      if (ph.kind === "prep") beep();
      timerRef.current = window.setTimeout(next, ph.sec * 1000);
    }
  }

  async function startExam() {
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
    setStage("running");
    runPhase(0, 0);
  }

  // 준비·자료 읽기를 건너뛰고 다음 단계로 (준비 → 신호음과 함께 바로 답변)
  function skipPhase() {
    const { q, p } = posRef.current;
    runPhase(q, p + 1);
  }

  // 답변 중 마이크 버튼 = 지금 답변을 끝내고 바로 다음 문제
  function stopEarly() {
    clearTimer();
    rec.stop();
  }

  // 질문과 답변을 모두 한 번에 백엔드로 (녹음이 없는 문제는 빼고 순서 유지)
  async function runAnalyze() {
    const pairs = TOEIC_SPEAKING_ITEMS.flatMap((it, i) =>
      answers[i] ? [{ question: toeicSpeakingQuestionText(it), audio: answers[i]! }] : [],
    );
    if (pairs.length === 0) return;
    await tx.run({
      mode: "speaking",
      language: "en",
      exam: "TOEIC-Speaking",
      questions: pairs.map((p) => p.question),
      audio: pairs.map((p) => p.audio),
    });
  }

  // 남은 시간 표시용 시계
  useEffect(() => {
    if (stage !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [stage]);

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

  if (stage === "intro") {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader
          title="토익 스피킹 모의시험"
          action={
            <Link to="/" className="btn btn-ghost btn-sm">
              설정 바꾸기
            </Link>
          }
        />
        <p className="text-[0.9375rem] leading-relaxed">
          실제 시험처럼 Part 1부터 5까지 한 문제씩 이어서 진행해요. 준비 시간이 끝나면 신호음과 함께
          자동으로 녹음돼요. 답변 시간이 끝나면 알려 드리고, 버튼을 누르면 다음 문제로 넘어가요.
        </p>
        <ol className="mt-5 divide-y divide-base-300 rounded-box border border-base-300">
          {TOEIC_SPEAKING_ITEMS.map((it) => (
            <li key={it.part} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="font-semibold">Part {it.part}</span>{" "}
                <span className="text-secondary">{it.name}</span>
              </span>
              <span className="shrink-0 text-sm tabular-nums text-secondary">
                준비 {totalSec(it, "prep")}초 / 답변 {totalSec(it, "speak")}초
              </span>
            </li>
          ))}
        </ol>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-secondary">
          <li>준비가 끝났으면 바로 답하기를 눌러 준비 시간을 건너뛸 수 있어요.</li>
          <li>
            답변 시간이 끝나도 녹음은 계속돼요. 마이크 버튼을 누르거나, 녹음이 1분이 되면 다음
            문제로 넘어가요.
          </li>
          <li>이전 문제로는 돌아갈 수 없어요.</li>
          <li>소리가 나오니 스피커나 이어폰을 켜 주세요.</li>
        </ul>
        {startError && (
          <div role="alert" className="alert alert-error alert-soft mt-4 text-sm">
            {startError}
          </div>
        )}
        <div className="mt-auto pt-6">
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={startExam}>
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
        <PageHeader
          title="시험이 끝났어요"
          description="답변을 들어 보고, 다섯 문제를 한 번에 분석해요."
        />
        <ul className="flex flex-col gap-3">
          {TOEIC_SPEAKING_ITEMS.map((it, i) => (
            <li key={it.part} className="rounded-box border border-base-300 p-4">
              <p>
                <span className="font-semibold">Part {it.part}</span>{" "}
                <span className="text-secondary">{it.name}</span>
              </p>
              {answerUrls[i] ? (
                <>
                  <audio src={answerUrls[i]!} controls className="mt-3 w-full" />
                  <div className="mt-2 flex justify-end">
                    <a
                      href={answerUrls[i]!}
                      download={`part${it.part}-${audioFileName(answers[i]!)}`}
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
            {analyzeError ? "다시 시도하기" : "대본 만들기"}
          </button>
        </div>
      </div>
    );
  }

  const item = TOEIC_SPEAKING_ITEMS[qi];
  const kind = phase?.kind;
  const remaining = endsAt ? (endsAt - now) / 1000 : null;
  // 답변 시간이 끝나도 녹음은 계속. 넘긴 시간을 +로 보여 준다
  const timeUp = kind === "speak" && remaining !== null && remaining <= 0;
  const phaseTotal = phase && "sec" in phase ? phase.sec : 0;
  // Part 4는 자료 읽기가 끝나야 질문이 화면에 나온다
  const showPrompt = !(item.part === 4 && kind === "read");

  return (
    <div className="flex flex-1 flex-col">
      {leaveGuard}
      {/* 진행 표시: 순서대로만 진행되므로 누를 수 없다 */}
      <div className="flex items-center gap-3 pt-2 pb-3">
        <div className="flex flex-1 gap-1" aria-hidden>
          {TOEIC_SPEAKING_ITEMS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= qi ? "bg-primary" : "bg-base-300"}`}
            />
          ))}
        </div>
        <span className="text-sm tabular-nums text-secondary">
          {qi + 1} / {TOEIC_SPEAKING_ITEMS.length}
        </span>
      </div>

      <h1 className="text-xl font-bold">
        Part {item.part} <span className="font-medium text-secondary">{item.name}</span>
      </h1>
      <p lang="en" className="mt-1 text-xs leading-relaxed text-secondary">
        {item.directions}
      </p>

      <article lang="en" className="mt-4 flex flex-col gap-3">
        {item.context && (
          <p className="text-sm leading-relaxed text-secondary italic">{item.context}</p>
        )}
        {item.picture === "cafeteria" && (
          <div className="aspect-[8/5] overflow-hidden rounded-box border border-base-300">
            <CafeteriaScene />
          </div>
        )}
        {item.schedule && (
          <div className="overflow-hidden rounded-box border border-base-300 text-sm">
            <p className="bg-base-200 px-3 py-2 font-semibold">{item.schedule.title}</p>
            <table className="table table-sm">
              <tbody>
                {item.schedule.rows.map((r) => (
                  <tr key={r.time}>
                    <td className="whitespace-nowrap tabular-nums">{r.time}</td>
                    <td>{r.session}</td>
                    <td className="text-secondary">{r.speaker}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {showPrompt && (
          <p
            className={
              item.part === 1
                ? "rounded-box border border-base-300 p-4 text-[1.0625rem] leading-loose"
                : "text-lg leading-relaxed font-medium"
            }
          >
            {item.prompt}
          </p>
        )}
      </article>

      <section className="mt-auto flex flex-col items-center gap-3 pt-6 pb-2" aria-live="polite">
        <p className={`text-sm font-semibold ${timeUp ? "text-error" : ""}`}>
          {timeUp ? "답변 시간이 끝났어요" : kind ? PHASE_LABEL[kind] : ""}
        </p>
        {remaining !== null ? (
          <>
            <p
              className={`text-4xl font-semibold tabular-nums tracking-tight ${timeUp ? "text-error" : ""}`}
            >
              {timeUp ? `+${mmss(-remaining)}` : mmss(remaining)}
            </p>
            {!timeUp && (
              <progress
                className={`progress h-1.5 w-full max-w-60 ${kind === "speak" ? "progress-primary" : ""}`}
                value={Math.max(0, remaining)}
                max={phaseTotal}
              />
            )}
          </>
        ) : (
          <span className="loading loading-dots loading-md text-secondary" />
        )}

        {kind === "speak" ? (
          <>
            <LevelBars levels={rec.levels} />
            <MicButton size="md" recording={rec.status === "recording"} onClick={stopEarly} />
            <p className="text-xs text-secondary">
              {timeUp
                ? `녹음은 계속돼요. 다 말했으면 버튼을 눌러 다음 문제로 (${ANSWER_HARD_MAX_SEC - Math.floor(rec.elapsed)}초 뒤 자동으로 넘어가요)`
                : "다 말했으면 버튼을 눌러 다음 문제로"}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-secondary">
              {kind === "prep" && "신호음이 울리면 바로 녹음이 시작돼요"}
              {kind === "read" && "자료를 읽어 두세요. 곧 질문이 나와요"}
              {kind === "listen" && "질문을 잘 들어 주세요"}
            </p>
            {(kind === "prep" || kind === "read") && phaseTotal > 5 && (
              <button
                type="button"
                className="btn btn-outline btn-sm border-base-300"
                onClick={skipPhase}
              >
                {kind === "prep" ? "준비 끝, 바로 답하기" : "다 읽었어요"}
              </button>
            )}
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
