import { useEffect, useRef, useState } from "react";

type Clip = { part: number; line: number; start: number; end: number };

export default function useSegmentAudio() {
  const player = useRef<HTMLAudioElement | null>(null);
  const source = useRef<Blob | null>(null);
  const url = useRef<string | null>(null);
  const clip = useRef<Clip | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState<Clip | null>(null);
  const [error, setError] = useState("");
  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const stop = () => {
    clearTimer();
    clip.current = null;
    player.current?.pause();
    setPlaying(null);
  };
  const scheduleEnd = () => {
    clearTimer();
    const audio = player.current;
    if (!audio || !clip.current || audio.paused) return;
    const remaining = clip.current.end - audio.currentTime;
    if (remaining <= 0) {
      stop();
      return;
    }
    timer.current = setTimeout(
      () => {
        if (player.current && clip.current && player.current.currentTime >= clip.current.end - 0.02)
          stop();
        else scheduleEnd();
      },
      (remaining / audio.playbackRate) * 1000,
    );
  };
  async function play(blob: Blob, next: Clip) {
    const audio = player.current;
    if (
      !audio ||
      !Number.isFinite(next.start) ||
      !Number.isFinite(next.end) ||
      next.end <= next.start
    )
      return;
    if (clip.current?.part === next.part && clip.current.line === next.line) {
      stop();
      return;
    }
    stop();
    setError("");
    if (source.current !== blob) {
      if (url.current) URL.revokeObjectURL(url.current);
      source.current = blob;
      url.current = URL.createObjectURL(blob);
      audio.src = url.current;
    }
    clip.current = next;
    try {
      audio.currentTime = Math.max(0, next.start);
      await audio.play();
      if (clip.current !== next) return;
      setPlaying(next);
      scheduleEnd();
    } catch {
      if (clip.current === next) {
        stop();
        setError("녹음을 재생하지 못했어요. 오디오 파일을 확인해 주세요.");
      }
    }
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      player.current?.pause();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );
  return { player, playing, error, play, stop, scheduleEnd, clearTimer };
}
