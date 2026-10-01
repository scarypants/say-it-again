import { createContext, useContext } from "react";
import type { AnalyzeResponse, Lang, Mode } from "../types/api";

export type Exam = "toss" | "opic"; // 어학 모드: 토익 스피킹 / 오픽

export type Settings = { mode: Mode; language: Lang; keywords: string; exam?: Exam };

type AnalysisState = {
  settings: Settings;
  setSettings: (s: Settings) => void;
  result: AnalyzeResponse | null;
  setResult: (r: AnalyzeResponse | null) => void;
};

export const AnalysisContext = createContext<AnalysisState | null>(null);

// 사용: const { settings, setResult } = useAnalysis();
export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis는 AnalysisProvider 안에서만 사용");
  return ctx;
}
