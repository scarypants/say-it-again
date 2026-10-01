import { useCallback, useEffect, useRef, useState } from "react";

// 녹음 파일의 한 구간(문장 하나)만 재생한다. 대본 검토·스크립트 화면 공용.
// key로 지금 재생 중인 구간을 구분하고, 같은 key를 다시 누르면 멈춘다
export function useClipPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlsRef = useRef(new Map<Blob, string>());
  const endRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioRef.current?.pause();
    setPlaying(null);
  }, []);

  const play = useCallback(
    async (key: string, blob: Blob, start: number, end: number) => {
      if (playing === key) {
        stop();
        return;
      }
      stop();
      setError(null);
      let url = urlsRef.current.get(blob);
      if (!url) {
        url = URL.createObjectURL(blob);
        urlsRef.current.set(blob, url);
      }
      const audio = (audioRef.current ??= new Audio());
      if (audio.src !== url) audio.src = url;
      endRef.current = end;
      try {
        audio.currentTime = Math.max(0, start);
        await audio.play();
        setPlaying(key);
        // 끝 시각을 넘으면 멈춘다. 프레임마다 확인하고(timeupdate는 250ms 간격이라 짧은 문장에서 늦다),
        // 탭이 가려져 프레임이 멈춰도 timeupdate·ended로 한 번 더 확인한다
        const check = () => {
          if (audio.paused || audio.ended || audio.currentTime >= endRef.current) {
            stop();
            return true;
          }
          return false;
        };
        const tick = () => {
          if (!check()) rafRef.current = requestAnimationFrame(tick);
        };
        audio.ontimeupdate = check;
        audio.onended = check;
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        setError("녹음을 재생하지 못했어요. 다시 눌러 주세요.");
        stop();
      }
    },
    [playing, stop],
  );

  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioRef.current?.pause();
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
  }, []);

  return { play, stop, playing, error };
}
