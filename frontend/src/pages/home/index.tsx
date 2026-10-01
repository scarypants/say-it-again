import { useState } from "react";
import { useNavigate } from "react-router";
import { PRESENTATION_LEVELS } from "../../api/presentationLevels";
import { useAnalysis, type Exam, type PresentationLevel } from "../../store/analysis";
import type { Lang } from "../../types/api";

type Choice = "presentation" | "speaking" | "interview";

const MODES: { value: Choice; title: string; desc: string }[] = [
  { value: "presentation", title: "발표", desc: "강의·과제 발표를 소리 내어 연습해요" },
  { value: "speaking", title: "어학 스피킹", desc: "토익 스피킹·오픽 질문에 영어로 답해요" },
  { value: "interview", title: "면접", desc: "자주 나오는 면접 질문에 답해요" },
];

const LANGS: { value: Lang; label: string }[] = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "영어" },
];

const EXAMS: { value: Exam; label: string }[] = [
  { value: "TOEIC-Speaking", label: "토익 스피킹" },
  { value: "opic", label: "오픽" },
];

// 와이어프레임 "초기화면": 모드 선택 → (발표) 발표 수준 / (어학) 토익 스피킹·오픽 / (면접) 답변 언어 → 시작
export default function HomePage() {
  const navigate = useNavigate();
  const { settings, setSettings, setPrevious } = useAnalysis();
  const [mode, setMode] = useState<Choice | null>(null);
  const [level, setLevel] = useState<PresentationLevel | null>(settings.level ?? null);
  // 발표·면접 언어: 어학 모드에서 돌아와도 한국어로 시작
  const [lang, setLang] = useState<Lang>(settings.mode === "speaking" ? "ko" : settings.language);
  const [exam, setExam] = useState<Exam | null>(settings.exam ?? null);

  const ready =
    (mode === "presentation" && level !== null) ||
    (mode === "speaking" && exam !== null) ||
    mode === "interview";

  function start() {
    setPrevious(null); // 새 연습이면 재도전 비교 기준을 비운다
    if (mode === "presentation" && level) {
      setSettings({ mode: "presentation", language: lang, level });
      navigate("/record");
    } else if (mode === "speaking" && exam) {
      setSettings({ mode: "speaking", language: "en", exam });
      navigate("/question");
    } else if (mode === "interview") {
      setSettings({ mode: "interview", language: lang });
      navigate("/question");
    }
  }

  return (
    // PC: 왼쪽 제목, 오른쪽 선택. 폰: 위아래 한 컬럼
    <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center lg:gap-16 lg:py-10">
      <section className="pt-6 pb-8 lg:pt-0 lg:pb-16">
        <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight lg:text-5xl lg:leading-[1.15]">
          어떤 말하기를
          <br />
          연습할까요?
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-secondary lg:mt-6 lg:text-lg">
          녹음하면 말이 막힌 곳과 그 이유,
          <br />
          다시 말할 문장까지 짚어 드려요.
        </p>
      </section>

      <div className="flex flex-1 flex-col lg:flex-none">
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
                  <div className="animate-reveal border-t border-base-300 px-4 pt-3 pb-4">
                    <LangPicker label="발표 언어" value={lang} onChange={setLang} />
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
                      고른 발표 상황에 맞춰 AI가 피드백해 드려요.
                    </p>
                  </div>
                )}

                {selected && m.value === "interview" && (
                  <div className="animate-reveal border-t border-base-300 px-4 pt-3 pb-4">
                    <LangPicker label="답변 언어" value={lang} onChange={setLang} />
                    <p className="-mt-2 text-xs text-secondary">
                      자기소개부터 마무리까지 다섯 질문에 답해요.
                    </p>
                  </div>
                )}

                {selected && m.value === "speaking" && (
                  <div className="animate-reveal border-t border-base-300 px-4 pt-3 pb-4">
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

        <div className="sticky bottom-0 mt-auto bg-base-100 pt-6 pb-2 lg:static lg:mt-0">
          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            disabled={!ready}
            onClick={start}
          >
            {mode === "speaking" || mode === "interview" ? "질문 받고 시작하기" : "녹음하러 가기"}
          </button>
          {mode === "speaking" && !exam && (
            <p className="mt-2 animate-fade text-center text-xs text-secondary">
              시험 종류를 골라 주세요
            </p>
          )}
          {mode === "presentation" && !level && (
            <p className="mt-2 animate-fade text-center text-xs text-secondary">
              발표 수준을 골라 주세요
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function LangPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Lang;
  onChange: (l: Lang) => void;
}) {
  return (
    <>
      <span className="mb-2 block text-sm font-medium">{label}</span>
      <div className="join mb-4 w-full" role="radiogroup" aria-label={label}>
        {LANGS.map((l) => (
          <button
            key={l.value}
            type="button"
            role="radio"
            aria-checked={value === l.value}
            className={`btn join-item flex-1 ${
              value === l.value ? "btn-primary" : "btn-outline border-base-300"
            }`}
            onClick={() => onChange(l.value)}
          >
            {l.label}
          </button>
        ))}
      </div>
    </>
  );
}
