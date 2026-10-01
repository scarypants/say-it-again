import { useState } from "react";
import { useNavigate } from "react-router";
import { PRESENTATION_LEVELS } from "../../api/presentationLevels";
import { useAnalysis, type Exam, type PresentationLevel } from "../../store/analysis";

type Choice = "presentation" | "speaking";

const MODES: { value: Choice; title: string; desc: string }[] = [
  { value: "presentation", title: "발표", desc: "강의·과제 발표를 소리 내어 연습해요" },
  { value: "speaking", title: "어학 스피킹", desc: "토익 스피킹·오픽 질문에 영어로 답해요" },
];

const EXAMS: { value: Exam; label: string }[] = [
  { value: "TOEIC-Speaking", label: "토익 스피킹" },
  { value: "opic", label: "오픽" },
];

// 와이어프레임 "초기화면": 모드 선택 → (발표) 발표 수준 / (어학) 토익 스피킹·오픽 → 시작
export default function HomePage() {
  const navigate = useNavigate();
  const { settings, setSettings } = useAnalysis();
  const [mode, setMode] = useState<Choice | null>(null);
  const [level, setLevel] = useState<PresentationLevel | null>(settings.level ?? null);
  const [exam, setExam] = useState<Exam | null>(settings.exam ?? null);

  const ready =
    (mode === "presentation" && level !== null) || (mode === "speaking" && exam !== null);

  function start() {
    if (mode === "presentation" && level) {
      setSettings({ mode: "presentation", language: "ko", level });
      navigate("/record");
    } else if (mode === "speaking" && exam) {
      setSettings({ mode: "speaking", language: "en", exam });
      navigate("/question");
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <section className="pt-6 pb-8">
        <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight">
          어떤 말하기를
          <br />
          연습할까요?
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-secondary">
          녹음하면 말이 막힌 곳과 그 이유,
          <br />
          다시 말할 문장까지 짚어 드려요.
        </p>
      </section>

      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">모드 선택</legend>
        {MODES.map((m) => {
          const selected = mode === m.value;
          return (
            <div
              key={m.value}
              className={`rounded-box border transition-colors ${
                selected ? "border-primary bg-base-100" : "border-base-300 bg-base-100"
              }`}
            >
              <label className="flex cursor-pointer items-center gap-4 p-4">
                <input
                  type="radio"
                  name="mode"
                  value={m.value}
                  className="radio radio-primary"
                  checked={selected}
                  onChange={() => setMode(m.value)}
                />
                <span className="flex flex-col">
                  <span className="text-lg font-semibold">{m.title}</span>
                  <span className="text-sm text-secondary">{m.desc}</span>
                </span>
              </label>

              {selected && m.value === "presentation" && (
                <div className="border-t border-base-300 px-4 pt-3 pb-4">
                  <span className="mb-2 block text-sm font-medium">발표 수준</span>
                  <div className="join w-full" role="radiogroup" aria-label="발표 수준">
                    {PRESENTATION_LEVELS.map((l) => (
                      <button
                        key={l.value}
                        type="button"
                        role="radio"
                        aria-checked={level === l.value}
                        className={`btn join-item flex-1 px-2 ${
                          level === l.value ? "btn-primary" : "btn-outline border-base-300"
                        }`}
                        onClick={() => setLevel(l.value)}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-secondary">
                    어떤 자리의 발표인지에 맞춰 AI가 기준을 달리해 봐요.
                  </p>
                </div>
              )}

              {selected && m.value === "speaking" && (
                <div className="border-t border-base-300 px-4 pt-3 pb-4">
                  <span className="mb-2 block text-sm font-medium">시험 종류</span>
                  <div className="join w-full" role="radiogroup" aria-label="시험 종류">
                    {EXAMS.map((e) => (
                      <button
                        key={e.value}
                        type="button"
                        role="radio"
                        aria-checked={exam === e.value}
                        className={`btn join-item flex-1 ${
                          exam === e.value ? "btn-primary" : "btn-outline border-base-300"
                        }`}
                        onClick={() => setExam(e.value)}
                      >
                        {e.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </fieldset>

      <div className="sticky bottom-0 mt-auto bg-base-100 pt-6 pb-2">
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          disabled={!ready}
          onClick={start}
        >
          {mode === "speaking" ? "질문 받고 시작하기" : "녹음하러 가기"}
        </button>
        {mode === "speaking" && !exam && (
          <p className="mt-2 text-center text-xs text-secondary">시험 종류를 골라 주세요</p>
        )}
        {mode === "presentation" && !level && (
          <p className="mt-2 text-center text-xs text-secondary">발표 수준을 골라 주세요</p>
        )}
      </div>
    </div>
  );
}
