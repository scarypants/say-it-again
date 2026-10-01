// 최근 음량 막대. 말할 때는 잉크색, 조용하면 침묵색으로 낮게 깔린다
export default function LevelBars({ levels }: { levels: number[] }) {
  return (
    <div className="flex h-14 items-center justify-center gap-[3px]" aria-hidden>
      {levels.map((v, i) => (
        <span
          key={i}
          className={`w-1 rounded-full transition-[height] duration-75 ${
            v > 0.06 ? "bg-primary" : "bg-silence/40"
          }`}
          style={{ height: `${Math.max(6, v * 100)}%` }}
        />
      ))}
    </div>
  );
}
