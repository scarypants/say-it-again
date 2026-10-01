import { useState } from "react";
import { useNavigate } from "react-router";
import { useAnalysis, type Exam } from "../../store/analysis";

type Choice = "lecture" | "language";

const MODES: { value: Choice; title: string; desc: string }[] = [
  { value: "lecture", title: "발표", desc: "강의·과제 발표를 소리 내어 연습해요" },
  { value: "language", title: "어학 스피킹", desc: "토익 스피킹·오픽 질문에 영어로 답해요" },
];

const EXAMS: { value: Exam; label: string }[] = [
  { value: "TOEIC-Speaking", label: "토익 스피킹" },
  { value: "opic", label: "오픽" },
];

// 와이어프레임 "초기화면": 모드 선택 → (발표) 키워드 / (어학) 토익 스피킹·오픽 → 시작
export default function HomePage() {
  const navigate = useNavigate();
  const { settings, setSettings } = useAnalysis();
  const [mode, setMode] = useState<Choice | null>(null);
  const [keywords, setKeywords] = useState(settings.keywords);
  const [exam, setExam] = useState<Exam | null>(settings.exam ?? null);

  const ready = mode === "lecture" || (mode === "language" && exam !== null);

  function start() {
    if (mode === "lecture") {
      setSettings({ mode: "lecture", language: "ko", keywords: keywords.trim() });
      navigate("/record");
    } else if (mode === "language" && exam) {
      setSettings({ mode: "language", language: "en", keywords: "", exam });
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

              {selected && m.value === "lecture" && (
                <div className="border-t border-base-300 px-4 pt-3 pb-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">발표 키워드</span>
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="예: 학생식당, 점심 대기 시간"
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                    />
                    <span className="text-xs text-secondary">
                      발표에 꼭 들어가야 할 단어를 쉼표로 구분해 적어요. AI가 실제 발표와 비교해
                      봐요.
                    </span>
                  </label>
                </div>
              )}

              {selected && m.value === "language" && (
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
          {mode === "language" ? "질문 받고 시작하기" : "녹음하러 가기"}
        </button>
        {mode === "language" && !exam && (
          <p className="mt-2 text-center text-xs text-secondary">시험 종류를 골라 주세요</p>
        )}
      </div>
    </div>
  );
}
