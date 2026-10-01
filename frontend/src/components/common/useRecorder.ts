import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "requesting" | "recording" | "paused" | "recorded";

const BAR_COUNT = 36;
const SAMPLE_MS = 90;
// 64kbps면 30분이 약 14MB라 Whisper 업로드 한도(25MB) 안에 든다
const AUDIO_BPS = 64_000;

// 브라우저가 지원하는 첫 형식. Safari는 webm이 없어 mp4로 떨어진다 (Whisper는 둘 다 받음)
function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

function permissionMessage(err: unknown) {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "마이크 권한이 꺼져 있어요. 주소창 왼쪽 아이콘에서 마이크를 허용한 뒤 다시 눌러 주세요.";
  if (name === "NotFoundError") return "마이크를 찾지 못했어요. 이어폰이나 마이크 연결을 확인해 주세요.";
  if (name === "NotReadableError")
    return "다른 앱이 마이크를 쓰고 있어요. 통화나 녹음 앱을 닫고 다시 눌러 주세요.";
  return "녹음을 시작하지 못했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.";
}

// maxSec: 한 번에 녹음할 수 있는 길이. 다 되면 멈춘다
// maxTotalSec을 주면 maxSec마다 멈추는 대신 일시정지하고, resume()으로 maxSec씩 이어서 녹음한다 (파일은 하나)
export function useRecorder(maxSec = 300, { maxTotalSec = maxSec }: { maxTotalSec?: number } = {}) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [limit, setLimit] = useState(maxSec);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0));

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const urlRef = useRef<string | null>(null);
  const onRecordedRef = useRef<((blob: Blob) => void) | undefined>(undefined);
  // 일시정지를 거쳐도 이어지는 시간: 지난 구간 합 + 지금 구간 시작 시각
  const doneSecRef = useRef(0);
  const runStartRef = useRef(0);
  const limitRef = useRef(maxSec);

  const stopLoops = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    timerRef.current = rafRef.current = null;
  }, []);

  const teardown = useCallback(() => {
    stopLoops();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    analyserRef.current = null;
  }, [stopLoops]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop(); // onstop에서 blob 생성
    teardown();
  }, [teardown]);

  // 녹음을 끝내고 blob이 만들어지면 onRecorded 호출 (일시정지 상태에서 바로 분석할 때)
  const finish = useCallback(
    (onRecorded: (blob: Blob) => void) => {
      onRecordedRef.current = onRecorded;
      stop();
    },
    [stop],
  );

  const pause = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "recording") return;
    rec.pause();
    doneSecRef.current += (Date.now() - runStartRef.current) / 1000;
    setElapsed(doneSecRef.current);
    stopLoops();
    setStatus("paused");
  }, [stopLoops]);

  // 타이머 + 음량 막대. 처음 녹음할 때와 이어서 녹음할 때 돌린다
  const runLoops = useCallback(() => {
    runStartRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      const sec = doneSecRef.current + (Date.now() - runStartRef.current) / 1000;
      setElapsed(sec);
      if (sec < limitRef.current) return;
      if (limitRef.current < maxTotalSec) pause();
      else stop();
    }, 200);

    // 입력 음량 → 막대. 조용한 구간이 눈에 보이게
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    let lastSample = 0;
    const tick = (now: number) => {
      if (now - lastSample >= SAMPLE_MS) {
        lastSample = now;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        const rms = Math.sqrt(sum / data.length);
        setLevels((prev) => [...prev.slice(1), Math.min(1, rms * 5)]);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [maxTotalSec, pause, stop]);

  // 일시정지한 녹음을 같은 파일에 이어서. 한도는 maxSec만큼 늘어난다
  const resume = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "paused") return;
    limitRef.current = Math.min(limitRef.current + maxSec, maxTotalSec);
    setLimit(limitRef.current);
    rec.resume();
    runLoops();
    setStatus("recording");
  }, [maxSec, maxTotalSec, runLoops]);

  // onRecorded: 녹음이 끝나 blob이 만들어지면 호출 (시험 모드에서 자동으로 다음 문제로 넘길 때)
  const start = useCallback(
    async (onRecorded?: (blob: Blob) => void) => {
      setError(null);
      // http로 휴대폰에서 접속하면 mediaDevices 자체가 없다
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setError("이 주소에서는 녹음할 수 없어요. 휴대폰이라면 https 주소로 접속해 주세요.");
        return;
      }

      setStatus("requesting");
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch (err) {
        setError(permissionMessage(err));
        setStatus("idle");
        return;
      }
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: AUDIO_BPS,
      });
      const chunks: Blob[] = [];
      onRecordedRef.current = onRecorded;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = () => {
        const b = new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" });
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = URL.createObjectURL(b);
        setBlob(b);
        setUrl(urlRef.current);
        setStatus("recorded");
        onRecordedRef.current?.(b);
      };
      rec.onerror = () => {
        setError("녹음 중 문제가 생겼어요. 다시 녹음해 주세요.");
        teardown();
        setStatus("idle");
      };
      recorderRef.current = rec;
      rec.start(1000);

      const ctx = new AudioContext();
      ctx.resume().catch(() => {}); // 자동 시작(사용자 클릭 없이)일 때 suspended로 시작할 수 있음
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;

      doneSecRef.current = 0;
      limitRef.current = maxSec;
      setLimit(maxSec);
      setElapsed(0);
      runLoops();
      setStatus("recording");
    },
    [maxSec, runLoops, teardown],
  );

  const reset = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setBlob(null);
    setUrl(null);
    setElapsed(0);
    limitRef.current = maxSec;
    setLimit(maxSec);
    setError(null);
    setLevels(Array(BAR_COUNT).fill(0));
    setStatus("idle");
  }, [maxSec]);

  useEffect(
    () => () => {
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.onstop = null;
        rec.stop();
      }
      teardown();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [teardown],
  );

  return { status, elapsed, limit, blob, url, error, levels, start, stop, finish, pause, resume, reset };
}
