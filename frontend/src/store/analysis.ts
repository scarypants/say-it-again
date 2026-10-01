import { createContext, useCallback, useContext } from "react";
import { useNavigate } from "react-router";
import type {
  AnalyzeResponse,
  Exam,
  Lang,
  Mode,
  PresentationLevel,
  TranscribeResponse,
} from "../types/api";

export type { Exam, PresentationLevel } from "../types/api";

export type Settings = { mode: Mode; language: Lang; level?: PresentationLevel; exam?: Exam };

// 한 번의 연습: 녹음 파일(문장 재생용)과 질문, 1단계 전사 결과. 검토 화면과 결과 화면이 같이 쓴다
export type Session = {
  audio: Blob[]; // parts와 같은 순서
  questions?: string[]; // 스피킹만
  transcript: TranscribeResponse;
};

type AnalysisState = {
  settings: Settings;
  setSettings: (s: Settings) => void;
  session: Session | null;
  setSession: (s: Session | null) => void;
  result: AnalyzeResponse | null;
  setResult: (r: AnalyzeResponse | null) => void;
  // "다시, 말해" 재도전: 비교 기준이 되는 이전 결과. 새 연습을 시작하면 비운다
  previous: AnalyzeResponse | null;
  setPrevious: (r: AnalyzeResponse | null) => void;
};

export const AnalysisContext = createContext<AnalysisState | null>(null);

// 사용: const { settings, session, setResult } = useAnalysis();
export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis는 AnalysisProvider 안에서만 사용");
  return ctx;
}

// "다시, 말해": 지금 결과를 previous로 보관하고 같은 설정으로 녹음 화면에 간다 (발표 모드)
export function useStartRetry() {
  const { result, setPrevious, setResult, setSettings } = useAnalysis();
  const navigate = useNavigate();
  return useCallback(() => {
    if (!result) return;
    setSettings({ mode: result.mode, language: result.language, level: result.level });
    setPrevious(result);
    setResult(null);
    navigate("/record");
  }, [result, setPrevious, setResult, setSettings, navigate]);
}
