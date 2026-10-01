import { createContext, useCallback, useContext } from "react";
import { useNavigate } from "react-router";
import type {
  AnalyzeResponse,
  RetryRequest,
  Exam,
  Lang,
  InputMode,
  PresentationLevel,
  TranscribeResponse,
} from "../types/api";
import { loadAudio, recordTranscript, type HistoryRecord } from "./history";

export type { Exam, PresentationLevel } from "../types/api";

export type Settings = { mode: InputMode; language: Lang; level?: PresentationLevel; exam?: Exam };

// 한 번의 연습: 녹음 파일(문장 재생용)과 질문, 1단계 전사 결과. 검토 화면과 결과 화면이 같이 쓴다
export type Session = {
  audio: Blob[]; // parts와 같은 순서
  questions?: string[]; // 스피킹·면접
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
  const { result } = useAnalysis();
  const retryFrom = useRetryFrom();
  return useCallback(() => {
    if (result) retryFrom(result);
  }, [result, retryFrom]);
}

// 지정한 결과(예: 기록)를 기준으로 "다시, 말해"를 시작한다
export function useRetryFrom() {
  const { setPrevious, setResult, setSession, setSettings } = useAnalysis();
  const navigate = useNavigate();
  return useCallback(
    (from: AnalyzeResponse) => {
      setSettings({ mode: from.mode, language: from.language, level: from.level });
      setPrevious(from);
      setResult(null);
      setSession(null);
      navigate("/record");
    },
    [setPrevious, setResult, setSession, setSettings, navigate],
  );
}

// 기록 하나를 결과 화면으로 연다 (총평 또는 스크립트)
export function useOpenRecord() {
  const { setPrevious, setResult, setSession, setSettings } = useAnalysis();
  const navigate = useNavigate();
  return useCallback(
    (record: HistoryRecord, to: "/summary" | "/script" = "/summary") => {
      const { mode, language, level, exam } = record.result;
      setSettings({ mode, language, level, exam });
      setPrevious(null);
      setSession({
        audio: loadAudio(record),
        questions: record.questions,
        transcript: recordTranscript(record),
      });
      setResult(record.result);
      navigate(to);
    },
    [setPrevious, setResult, setSession, setSettings, navigate],
  );
}

// 재도전 때 따라 말할 대본. 재도전 결과는 서버가 final을 비워 보내므로(docs/api.md 5절)
// 그때는 실제로 말한 대본에서 필러만 뺀 것을 쓴다. 그래야 재도전을 또 이어 할 수 있다
export function retryFinal(r: AnalyzeResponse): { words: string[] }[] {
  const final = r.parts.flatMap((p) => p.final);
  if (final.length) return final;
  return r.parts.flatMap((p) => {
    const fillers = new Set<number>();
    for (const h of p.highlight)
      if (h.category === "filler") for (let i = h.from; i <= h.to; i++) fillers.add(i);
    return p.script
      .filter((l) => !l.pause)
      .map((l) => ({ words: l.words.filter((_, i) => !fillers.has(l.offset + i)) }))
      .filter((l) => l.words.length > 0);
  });
}

// POST /api/retry의 previous: 이전 결과에서 그대로 복사한다
export function retryPrevious(r: AnalyzeResponse): RetryRequest["previous"] {
  return {
    durationSec: Math.round(r.parts.reduce((sum, p) => sum + p.duration, 0) * 10) / 10,
    stats: r.analysis.stats,
    categoryRatio: r.charts.categoryRatio,
    topPriorities: r.analysis.summary.topPriorities,
    final: retryFinal(r),
  };
}
