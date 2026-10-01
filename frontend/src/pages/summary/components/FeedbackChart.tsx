import type { ChartItem, ChartKey } from "../chartData";

export default function FeedbackChart({
  categories,
  selected,
  onSelect,
}: {
  categories: ChartItem[];
  selected: ChartKey | null;
  onSelect: (key: "filler" | "repeat") => void;
}) {
  const total = categories.reduce((sum, item) => sum + item.value, 0);
  const wedges = categories
    .filter((item) => item.value > 0)
    .map((item, index, items) => {
      const start =
        -Math.PI / 2 +
        items.slice(0, index).reduce((sum, row) => sum + (row.value / total) * Math.PI * 2, 0);
      const angle = start + (item.value / total) * Math.PI * 2;
      const point = (a: number) => `${130 + 102 * Math.cos(a)} ${130 + 102 * Math.sin(a)}`;
      const path =
        item.value === total
          ? "M 130 28 A 102 102 0 1 1 130 232 A 102 102 0 1 1 130 28 Z"
          : `M 130 130 L ${point(start)} A 102 102 0 ${angle - start > Math.PI ? 1 : 0} 1 ${point(angle)} Z`;
      return {
        ...item,
        path,
        labelX: 130 + 68 * Math.cos((start + angle) / 2),
        labelY: 130 + 68 * Math.sin((start + angle) / 2),
      };
    });

  return (
    <section aria-labelledby="category-chart-title">
      <h2 id="category-chart-title" className="text-lg font-bold">
        말하기 항목별 비율
      </h2>
      <p className="mt-2 text-sm text-base-content/70">
        보라색 반복, 노란색 군말을 누르면 개선안을 볼 수 있어요.
      </p>
      {total > 0 ? (
        <>
          <svg
            viewBox="0 0 260 260"
            className="mx-auto mt-3 w-full max-w-64"
            role="group"
            aria-label="정상 구간을 포함한 말하기 비율 원형 차트"
          >
            {wedges.map((item) => {
              const interactive = item.key === "filler" || item.key === "repeat";
              return (
                <g key={item.key}>
                  <path
                    d={item.path}
                    fill={item.fill}
                    stroke="var(--color-base-100)"
                    strokeWidth={selected === item.key ? 5 : 2}
                    role={interactive ? "button" : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    aria-label={`${item.name} ${item.percent}%${interactive ? " 개선안 보기" : ""}`}
                    aria-pressed={interactive ? selected === item.key : undefined}
                    className={
                      interactive
                        ? "cursor-pointer transition-opacity hover:opacity-80 focus:outline-none focus:stroke-primary"
                        : undefined
                    }
                    onClick={() => {
                      if (item.key === "filler" || item.key === "repeat") onSelect(item.key);
                    }}
                    onKeyDown={(event) => {
                      if (interactive && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        onSelect(item.key as "filler" | "repeat");
                      }
                    }}
                  >
                    <title>
                      {item.name} {item.percent}%
                    </title>
                  </path>
                  {item.percent >= 5 && (
                    <text
                      x={item.labelX}
                      y={item.labelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="pointer-events-none fill-base-100 text-[13px] font-bold"
                      aria-hidden="true"
                      style={{
                        fill: item.key === "filler" ? "var(--color-base-content)" : undefined,
                      }}
                    >
                      {item.percent}%
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <ul className="grid grid-cols-2 gap-2 text-sm" aria-label="항목별 백분율">
            {categories.map((item) => (
              <li key={item.key}>
                {item.key === "filler" || item.key === "repeat" ? (
                  <button
                    type="button"
                    className={`flex min-h-10 w-full items-center gap-2 rounded-box border px-2 text-left ${selected === item.key ? "border-primary bg-base-200" : "border-base-300"}`}
                    disabled={item.value === 0}
                    aria-pressed={selected === item.key}
                    aria-label={`${item.name} ${item.percent}% 개선안 보기`}
                    onClick={() => onSelect(item.key as "filler" | "repeat")}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.fill }}
                      aria-hidden="true"
                    />
                    {item.name} {item.percent}%
                  </button>
                ) : (
                  <div className="flex min-h-10 items-center gap-2 px-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.fill }}
                      aria-hidden="true"
                    />
                    {item.name} {item.percent}%
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-base-content/60">
            전체 단어 가운데 각 항목에 걸린 단어의 비율이에요. 겹친 단어는 한 번만 세고, 정상은 걸린
            데가 없는 단어예요.
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-base-content/70">
          분석할 구간의 시간이 없어 비율을 계산할 수 없어요.
        </p>
      )}
    </section>
  );
}
