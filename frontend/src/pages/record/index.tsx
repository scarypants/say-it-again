import PageHeader from "../../components/common/PageHeader";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { audioFileName } from "../../api/client";
import { useTranscribe } from "../../api/useTranscribe";
import { LEVEL_LABEL } from "../../api/presentationLevels";
import AnalyzingView from "../../components/common/AnalyzingView";
import LevelBars from "../../components/common/LevelBars";
import MicButton from "../../components/common/MicButton";
import { DESKTOP_QUERY, useMediaQuery } from "../../components/common/useMediaQuery";
import { useLeaveGuard } from "../../components/common/useLeaveGuard";
import { useRecorder } from "../../components/common/useRecorder";
import { useAnalysis } from "../../store/analysis";
import { isPdf, MATERIAL_ACCEPT } from "./material";
import MaterialPreview from "./MaterialPreview";
import AudioFileUpload from "./AudioFileUpload";

const MAX_SEC = 300; // 파일 하나 5분. 다 되면 잠깐 멈추고 새 파일로 이어서 녹음할지 고른다
const MAX_FILES = 5;
const MAX_TOTAL_SEC = MAX_SEC * MAX_FILES; // 최대 25분

function mmss(sec: number) {
  const s = Math.floor(sec);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// 와이어프레임 녹음 화면: (발표 자료) + 마이크 + 파일 업로드 → 분석하기 → /script
export default function RecordPage() {
  const { settings } = useAnalysis();
  const rec = useRecorder(MAX_SEC, { maxTotalSec: MAX_TOTAL_SEC });
  const [material, setMaterial] = useState<File | null>(null);
  const [materialError, setMaterialError] = useState<string | null>(null);
  const tx = useTranscribe(); // 녹음 → 대본 → 검토 화면
  const analyzing = tx.busy;
  const analyzeError = tx.error;
  const fileRef = useRef<HTMLInputElement>(null);
  const desktop = useMediaQuery(DESKTOP_QUERY);
  // 녹음을 시작한 뒤에는 다른 화면으로 가기 전에 확인
  const leaveGuard = useLeaveGuard(rec.status !== "idle");

  // 발표 자료는 PDF만
  function pickMaterial(file: File | null) {
    if (fileRef.current) fileRef.current.value = ""; // 같은 파일을 다시 골라도 반응하게
    if (file && !isPdf(file)) {
      setMaterialError(
        "발표 자료는 PDF 파일만 올릴 수 있어요. PowerPoint는 PDF로 저장해서 올려 주세요.",
      );
      return;
    }
    setMaterialError(null);
    setMaterial(file);
  }

  function runAnalyze(audio: Blob[]) {
    void tx.run({
      audio,
      mode: "presentation",
      language: settings.language,
      level: settings.level,
    });
  }

  if (analyzing)
    return (
      <>
        <AnalyzingView />
        {leaveGuard}
      </>
    );

  const recording = rec.status === "recording";
  const paused = rec.status === "paused";
  const remaining = rec.limit - rec.elapsed;

  return (
    <div className="flex flex-1 flex-col">
      {leaveGuard}
      <PageHeader
        title="발표 연습"
        description={
          (settings.language === "en" ? "영어" : "한국어") +
          (settings.level ? ` 발표, ${LEVEL_LABEL[settings.level]}` : "")
        }
        action={
          !recording &&
          !paused && (
            <Link to="/" className="btn btn-ghost btn-sm">
              설정 바꾸기
            </Link>
          )
        }
      />

      {/* 자료가 있으면 폰에선 자료가 위를 차지하고 녹음 영역은 아래로 작게,
          PC에선 자료를 왼쪽에 크게 두고 녹음 패널은 오른쪽 */}
      <div
        className={`flex flex-1 flex-col ${
          material
            ? "lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8"
            : "lg:mx-auto lg:w-full lg:max-w-md"
        }`}
      >
        {material && (
          <div className="flex min-h-0 flex-1 flex-col lg:sticky lg:top-4 lg:h-[calc(100svh-11rem)] lg:min-h-[28rem]">
            <MaterialPreview
              file={material}
              locked={rec.status !== "idle"}
              onRemove={() => pickMaterial(null)}
            />
          </div>
        )}

        <div
          className={`flex flex-col ${
            material
              ? "lg:sticky lg:top-4 lg:h-[calc(100svh-11rem)] lg:min-h-[28rem] lg:overflow-y-auto lg:rounded-box lg:border lg:border-base-300 lg:p-5"
              : "flex-1"
          }`}
        >
          <section
            className={`flex flex-col items-center justify-center ${
              material ? "gap-2 pt-3 lg:flex-1 lg:gap-4 lg:pt-0" : "flex-1 gap-4 py-6"
            }`}
          >
            <p
              className={`${material && !desktop ? "text-2xl" : "text-4xl"} font-semibold tabular-nums tracking-tight ${
                recording ? "text-base-content" : "text-secondary"
              }`}
              aria-live="off"
            >
              {mmss(rec.elapsed)}
            </p>

            {rec.status !== "recorded" && !paused && (!material || desktop) && (
              <LevelBars levels={rec.levels} />
            )}

            {rec.status === "recorded" && rec.urls.length > 0 ? (
              <div className="flex w-full animate-fade flex-col items-center gap-3">
                {rec.urls.length === 1 ? (
                  <audio src={rec.urls[0]} controls className="w-full" />
                ) : (
                  // 5분짜리 파일 여러 개: 녹음 순서대로, 각 파일이 전체에서 몇 분 몇 초 구간인지
                  <ol className="flex w-full flex-col gap-2" aria-label="녹음 파일">
                    {rec.urls.map((u, i) => (
                      <li key={u} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs text-secondary tabular-nums">
                          <span>
                            {mmss(i * MAX_SEC)} –{" "}
                            {mmss(i === rec.urls.length - 1 ? rec.elapsed : (i + 1) * MAX_SEC)}
                          </span>
                          <a
                            href={u}
                            download={`part${i + 1}-${audioFileName(rec.blobs[i])}`}
                            className="link link-hover"
                          >
                            파일 저장
                          </a>
                        </div>
                        <audio src={u} controls className="w-full" />
                      </li>
                    ))}
                  </ol>
                )}
                <div className="flex gap-2">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={rec.reset}>
                    다시 녹음
                  </button>
                  {rec.urls.length === 1 && rec.blob && (
                    <a
                      href={rec.urls[0]}
                      download={audioFileName(rec.blob)}
                      className="btn btn-ghost btn-sm"
                    >
                      파일 저장
                    </a>
                  )}
                </div>
              </div>
            ) : paused ? null : (
              <MicButton
                size={material && !desktop ? "md" : "lg"}
                recording={recording}
                disabled={rec.status === "requesting"}
                onClick={recording ? rec.stop : () => void rec.start()}
              />
            )}

            <p className="min-h-5 text-sm text-secondary" role="status">
              {rec.status === "idle" &&
                (material
                  ? "자료를 보면서 말해 보세요. 버튼을 누르면 녹음이 시작돼요"
                  : `버튼을 누르면 녹음이 시작돼요. ${MAX_SEC / 60}분마다 이어서 녹음할 수 있어요`)}
              {rec.status === "requesting" && "마이크 권한을 허용해 주세요"}
              {recording &&
                (remaining <= 30 && rec.limit < MAX_TOTAL_SEC
                  ? `${Math.ceil(remaining)}초 뒤 잠깐 멈춰요. 이어서 녹음할 수 있어요`
                  : remaining <= 30
                    ? `최대 ${MAX_TOTAL_SEC / 60}분이에요. ${Math.ceil(remaining)}초 뒤 녹음이 끝나요`
                    : "다 말했으면 버튼을 눌러 멈춰요")}
              {paused &&
                `${rec.limit / 60}분이 지나 잠깐 멈췄어요. 이어서 녹음하면 새 파일로 저장돼요 (${rec.blobs.length}/${MAX_FILES})`}
              {rec.status === "recorded" && "들어 보고 괜찮으면 분석을 시작해요"}
            </p>

            {(rec.error || analyzeError || materialError) && (
              <div
                role="alert"
                className="alert alert-error alert-soft w-full animate-reveal text-sm"
              >
                {rec.error ?? analyzeError ?? materialError}
              </div>
            )}
          </section>

          <div className="flex flex-col gap-2 pt-2">
            {/* 와이어프레임: 자료는 녹음 전에 올린다. 올리면 이 버튼만 사라진다 */}
            {!material && rec.status === "idle" && (
              <>
                <p className="text-center text-xs text-secondary">
                  PDF 발표 자료를 먼저 올리면 화면에 띄워 놓고 보면서 녹음할 수 있어요
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
            {/* 녹음 대신 이미 녹음한 파일로 바로 대본 만들기 */}
            {rec.status === "idle" && <AudioFileUpload onFiles={runAnalyze} />}
            {/* 5분이 다 되면: 새 파일로 이어서 녹음하거나, 여기까지 바로 분석 */}
            {paused && (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline btn-lg flex-1 border-base-300"
                  onClick={rec.resume}
                >
                  이어서 녹음하기
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-lg flex-1"
                  onClick={() => rec.finish((_, all) => void runAnalyze(all))}
                >
                  분석하기
                </button>
              </div>
            )}
            {rec.status === "recorded" && rec.blobs.length > 0 && (
              <button
                type="button"
                className="btn btn-primary btn-lg btn-block"
                onClick={() => void runAnalyze(rec.blobs)}
              >
                {analyzeError ? "다시 시도하기" : "대본 만들기"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
