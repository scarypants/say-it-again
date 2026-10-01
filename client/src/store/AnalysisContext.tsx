import { useState, type ReactNode } from "react";
import type { AnalyzeResponse } from "../types/api";
import { AnalysisContext, type Settings } from "./analysis";

// 페이지 사이에서 공유하는 상태: 입력 설정(홈) → 녹음 → 결과(스크립트/총평)
export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>({
    mode: "lecture",
    language: "ko",
    keywords: "",
  });
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  return (
    <AnalysisContext.Provider value={{ settings, setSettings, result, setResult }}>
      {children}
    </AnalysisContext.Provider>
  );
}
