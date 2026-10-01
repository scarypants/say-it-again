import { useState } from "react";
import { useNavigate } from "react-router";
import { useAnalysis } from "../store/analysis";
import type { TranscribeRequest } from "../types/api";
import { RequestError, transcribe } from "./client";

// 서버 422는 "알아들은 단어가 3개 미만"이라는 뜻이라(backend config MIN_WORDS)
// "음성이 감지되지 않았다" 대신 짧았거나 작게 들렸다고 안내한다. 몇 번째 녹음인지는 서버 문구에서 가져온다
function tooShortMessage(server: string) {
  const which = /^(\d+번째 녹음)/.exec(server)?.[1];
  return `${which ? `${which}에서 ` : ""}알아들은 말이 너무 적어요. 세 단어 이상, 마이크 가까이에서 또렷하게 다시 말해 주세요.`;
}

// 녹음 화면·시험 화면 공용: 녹음을 대본으로 바꾸고 검토 화면(/review)으로 간다
export function useTranscribe() {
  const navigate = useNavigate();
  const { setSession, setResult } = useAnalysis();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 음성이 감지되지 않음(422): 같은 녹음을 다시 보내도 소용없으니 새로 녹음해야 한다
  const [noSpeech, setNoSpeech] = useState(false);

  async function run(req: TranscribeRequest) {
    setBusy(true);
    setError(null);
    setNoSpeech(false);
    try {
      const transcript = await transcribe(req);
      setSession({ audio: req.audio, questions: req.questions, transcript });
      setResult(null);
      navigate("/review");
    } catch (err) {
      const silent = err instanceof RequestError && err.status === 422;
      const message = err instanceof Error ? err.message : "대본을 만들지 못했어요.";
      setError(silent ? tooShortMessage(message) : message);
      setNoSpeech(silent);
      setBusy(false);
    }
  }

  function clear() {
    setError(null);
    setNoSpeech(false);
  }

  return { run, busy, error, noSpeech, clear };
}
