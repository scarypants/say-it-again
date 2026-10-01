import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { analyze, audioFileName } from "../../api/client";
import MicButton from "../../components/common/MicButton";
import { useAnalysis } from "../../store/analysis";
import LevelBars from "./LevelBars";
import MaterialPreview from "./MaterialPreview";
import { useRecorder } from "./useRecorder";

const MAX_SEC = 300;

function mmss(sec: number) {
  const s = Math.floor(sec);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// 와이어프레임 녹음 화면: (발표 자료) + 마이크 + 파일 업로드 → 분석하기 → /script
export default function RecordPage() {
  const navigate = useNavigate();
  const { settings, setResult } = useAnalysis();
  const rec = useRecorder(MAX_SEC);
  const [material, setMaterial] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const keywords = settings.keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  async function runAnalyze() {
    if (!rec.blob) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await analyze({
        audio: rec.blob,
        mode: settings.mode,
        language: settings.language,
        keywords: settings.keywords || undefined,
        material: material ?? undefined,
      });
      setResult(result);
      navigate("/script");
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "분석 요청에 실패했어요.");
      setAnalyzing(false);
    }
  }

  if (analyzing) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <span className="loading loading-dots loading-lg text-primary" />
        <div>
          <p className="text-lg font-semibold">녹음을 분석하고 있어요</p>
          <p className="mt-2 text-sm leading-relaxed text-secondary">
            말을 글로 옮기고, 막힌 구간과 그 이유를 찾는 중이에요.
            <br />
            보통 30초 안팎 걸려요.
          </p>
        </div>
      </div>
    );
  }

  const recording = rec.status === "recording";

  return (
    <div className="flex flex-1 flex-col">
      <section className="flex items-start justify-between gap-3 pt-2 pb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">발표 연습</h1>
          {keywords.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="발표 키워드">
              {keywords.map((k) => (
                <li key={k} className="badge badge-outline border-base-300 badge-sm">
                  {k}
                </li>
              ))}
            </ul>
          )}
        </div>
        {!recording && (
          <Link to="/" className="btn btn-ghost btn-sm shrink-0">
            설정 바꾸기
          </Link>
        )}
      </section>

      {material && <MaterialPreview file={material} onRemove={() => setMaterial(null)} />}

      <section className="flex flex-1 flex-col items-center justify-center gap-4 py-6">
        <p
          className={`text-4xl font-semibold tabular-nums tracking-tight ${
            recording ? "text-base-content" : "text-secondary"
          }`}
          aria-live="off"
        >
          {mmss(rec.elapsed)}
        </p>

        {rec.status !== "recorded" && <LevelBars levels={rec.levels} />}

        {rec.status === "recorded" && rec.url ? (
          <div className="flex w-full flex-col items-center gap-3">
            <audio src={rec.url} controls className="w-full" />
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={rec.reset}>
                다시 녹음
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
            disabled={rec.status === "requesting"}
            onClick={recording ? rec.stop : rec.start}
          />
        )}

        <p className="min-h-5 text-sm text-secondary" role="status">
          {rec.status === "idle" && `버튼을 누르면 녹음이 시작돼요. 최대 ${MAX_SEC / 60}분`}
          {rec.status === "requesting" && "마이크 권한을 허용해 주세요"}
          {recording && "다 말했으면 버튼을 눌러 멈춰요"}
          {rec.status === "recorded" && "들어 보고 괜찮으면 분석을 시작해요"}
        </p>

        {(rec.error || analyzeError) && (
          <div role="alert" className="alert alert-error alert-soft w-full text-sm">
            {rec.error ?? analyzeError}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-2 pt-2">
        {/* 와이어프레임: 파일을 올리면 이 버튼만 사라진다 */}
        {!material && !recording && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf,.ppt,.pptx"
              className="hidden"
              onChange={(e) => setMaterial(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="btn btn-outline btn-block border-base-300"
              onClick={() => fileRef.current?.click()}
            >
              발표 자료 올리기
            </button>
          </>
        )}
        {rec.status === "recorded" && (
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={runAnalyze}>
            {analyzeError ? "다시 분석하기" : "분석하기"}
          </button>
        )}
      </div>
    </div>
  );
}
