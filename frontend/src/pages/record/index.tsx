import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { analyze, audioFileName } from "../../api/client";
import AnalyzingView from "../../components/common/AnalyzingView";
import LevelBars from "../../components/common/LevelBars";
import MicButton from "../../components/common/MicButton";
import { useRecorder } from "../../components/common/useRecorder";
import { useAnalysis } from "../../store/analysis";
import { isMaterialFile, MATERIAL_ACCEPT } from "./material";
import MaterialPreview from "./MaterialPreview";

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
  const [materialError, setMaterialError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 발표 자료는 PDF·PPT만
  function pickMaterial(file: File | null) {
    if (fileRef.current) fileRef.current.value = ""; // 같은 파일을 다시 골라도 반응하게
    if (file && !isMaterialFile(file)) {
      setMaterialError("발표 자료는 PDF나 PPT 파일만 올릴 수 있어요.");
      return;
    }
    setMaterialError(null);
    setMaterial(file);
  }

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

  if (analyzing) return <AnalyzingView />;

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

      {material && (
        <MaterialPreview
          file={material}
          locked={rec.status !== "idle"}
          onRemove={() => pickMaterial(null)}
        />
      )}

      {/* 자료가 있으면 자료가 화면을 차지하고 녹음 영역은 아래로 작게 */}
      <section
        className={`flex flex-col items-center justify-center ${
          material ? "gap-2 pt-3" : "flex-1 gap-4 py-6"
        }`}
      >
        <p
          className={`${material ? "text-2xl" : "text-4xl"} font-semibold tabular-nums tracking-tight ${
            recording ? "text-base-content" : "text-secondary"
          }`}
          aria-live="off"
        >
          {mmss(rec.elapsed)}
        </p>

        {rec.status !== "recorded" && !material && <LevelBars levels={rec.levels} />}

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
            size={material ? "md" : "lg"}
            recording={recording}
            disabled={rec.status === "requesting"}
            onClick={recording ? rec.stop : rec.start}
          />
        )}

        <p className="min-h-5 text-sm text-secondary" role="status">
          {rec.status === "idle" &&
            (material
              ? "자료를 보면서 말해 보세요. 버튼을 누르면 녹음이 시작돼요"
              : `버튼을 누르면 녹음이 시작돼요. 최대 ${MAX_SEC / 60}분`)}
          {rec.status === "requesting" && "마이크 권한을 허용해 주세요"}
          {recording && "다 말했으면 버튼을 눌러 멈춰요"}
          {rec.status === "recorded" && "들어 보고 괜찮으면 분석을 시작해요"}
        </p>

        {(rec.error || analyzeError || materialError) && (
          <div role="alert" className="alert alert-error alert-soft w-full text-sm">
            {rec.error ?? analyzeError ?? materialError}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-2 pt-2">
        {/* 와이어프레임: 자료는 녹음 전에 올린다. 올리면 이 버튼만 사라진다 */}
        {!material && rec.status === "idle" && (
          <>
            <p className="text-center text-xs text-secondary">
              발표 자료를 먼저 올리면 화면에 띄워 놓고 보면서 녹음할 수 있어요
            </p>
            <input
              ref={fileRef}
              type="file"
              accept={MATERIAL_ACCEPT}
              className="hidden"
              onChange={(e) => pickMaterial(e.target.files?.[0] ?? null)}
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
