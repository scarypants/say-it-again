import { useState, type CSSProperties } from "react";

type Props = {
  leftMs: number; // 처음 그릴 때 남은 시간. 단계가 바뀌면 key를 바꿔 새로 그린다
  totalSec: number; // 이 단계 전체 시간 (막대가 처음 얼마나 차 있을지)
  className?: string; // 막대 색은 text-* 로 (bg-current)
};

// 남은 시간 막대. 부모가 0.2초마다 다시 그려도 막대는 처음 한 번만 정하고,
// 그 뒤로는 CSS로 끝까지 일정하게 줄어든다 (툭툭 끊기지 않게). styles/index.css의 .countdown-fill
// 사용: <CountdownBar key={endsAt} leftMs={endsAt - now} totalSec={45} className="text-primary" />
export default function CountdownBar({ leftMs, totalSec, className = "" }: Props) {
  const [start] = useState(() => ({
    ms: Math.max(0, leftMs),
    from: Math.min(1, Math.max(0, leftMs / (totalSec * 1000))),
  }));
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-base-300 ${className}`}
      aria-hidden
    >
      <div
        className="countdown-fill h-full w-full origin-left rounded-full bg-current"
        style={
          { "--countdown-ms": `${start.ms}ms`, "--countdown-from": start.from } as CSSProperties
        }
      />
    </div>
  );
}
