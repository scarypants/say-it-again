import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "requesting" | "recording" | "recorded";

const BAR_COUNT = 36;
const SAMPLE_MS = 90;

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

export function useRecorder(maxSec = 300) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0));

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const urlRef = useRef<string | null>(null);

  const teardown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    timerRef.current = rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop(); // onstop에서 blob 생성
    teardown();
  }, [teardown]);

  // onRecorded: 녹음이 끝나 blob이 만들어지면 호출 (시험 모드에서 자동으로 다음 문제로 넘길 때)
  const start = useCallback(async (onRecorded?: (blob: Blob) => void) => {
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
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
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
      onRecorded?.(b);
    };
    rec.onerror = () => {
      setError("녹음 중 문제가 생겼어요. 다시 녹음해 주세요.");
      teardown();
      setStatus("idle");
    };
    recorderRef.current = rec;
    rec.start(1000);

    const startedAt = Date.now();
    setElapsed(0);
    timerRef.current = window.setInterval(() => {
      const sec = (Date.now() - startedAt) / 1000;
      setElapsed(sec);
      if (sec >= maxSec) stop();
    }, 200);

    // 입력 음량 → 막대. 조용한 구간이 눈에 보이게
    const ctx = new AudioContext();
    ctx.resume().catch(() => {}); // 자동 시작(사용자 클릭 없이)일 때 suspended로 시작할 수 있음
    ctxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
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

    setStatus("recording");
  }, [maxSec, stop, teardown]);

  const reset = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setBlob(null);
    setUrl(null);
    setElapsed(0);
    setError(null);
    setLevels(Array(BAR_COUNT).fill(0));
    setStatus("idle");
  }, []);

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

  return { status, elapsed, blob, url, error, levels, start, stop, reset };
}
