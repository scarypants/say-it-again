import { createContext, useContext } from "react";
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
};

export const AnalysisContext = createContext<AnalysisState | null>(null);

// 사용: const { settings, session, setResult } = useAnalysis();
export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis는 AnalysisProvider 안에서만 사용");
  return ctx;
}
