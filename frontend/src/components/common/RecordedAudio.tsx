import type { SyntheticEvent } from "react";

// 브라우저로 녹음한 webm은 길이 정보가 없어(duration = Infinity) 크롬 플레이어에 끝 시간이 안 나오고
// 재생 막대가 제멋대로 움직인다. 처음 한 번 끝으로 이동시켜 길이를 계산하게 한 뒤 처음으로 돌린다
function fixDuration(e: SyntheticEvent<HTMLAudioElement>) {
  const a = e.currentTarget;
  if (Number.isFinite(a.duration)) return;
  const back = () => {
    if (!Number.isFinite(a.duration)) return;
    a.removeEventListener("durationchange", back);
    a.currentTime = 0;
  };
  a.addEventListener("durationchange", back);
  a.currentTime = 1e101;
}

// 녹음한 답변 듣기 (녹음 화면·시험이 끝난 화면 공용)
export default function RecordedAudio({
  src,
  className = "",
}: {
  src: string;
  className?: string;
}) {
  return (
    <audio
      src={src}
      controls
      preload="metadata"
      onLoadedMetadata={fixDuration}
      className={`w-full ${className}`}
    />
  );
}
