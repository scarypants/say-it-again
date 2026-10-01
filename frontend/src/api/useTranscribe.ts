import { useState } from "react";
import { useNavigate } from "react-router";
import { useAnalysis } from "../store/analysis";
import type { TranscribeRequest } from "../types/api";
import { transcribe } from "./client";

// 녹음 화면·시험 화면 공용: 녹음을 대본으로 바꾸고 검토 화면(/review)으로 간다
export function useTranscribe() {
  const navigate = useNavigate();
  const { setSession, setResult } = useAnalysis();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(req: TranscribeRequest) {
    setBusy(true);
    setError(null);
    try {
      const transcript = await transcribe(req);
      setSession({ audio: req.audio, questions: req.questions, transcript });
      setResult(null);
      navigate("/review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "대본을 만들지 못했어요.");
      setBusy(false);
    }
  }

  return { run, busy, error };
}
