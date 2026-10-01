export default function WordFrequency({
  rows,
  category,
}: {
  rows: { word: string; count: number }[];
  category: "filler" | "repeat";
}) {
  const sorted = rows
    .filter((row) => Number.isFinite(row.count) && row.count > 0)
    .toSorted((a, b) => b.count - a.count);
  const max = Math.max(1, ...sorted.map((row) => row.count));
  return (
    <section
      aria-label={category === "filler" ? "군말 사용 횟수" : "반복 표현 사용 횟수"}
      className="mt-5 border-b border-base-300 pb-6"
    >
      <h3 className="text-sm font-semibold">어떤 말을 자주 사용했나요?</h3>
      {sorted.length ? (
        <ul className="mt-4 space-y-4">
          {sorted.map((row) => (
            <li key={row.word}>
              <div className="mb-2 flex items-baseline justify-between gap-4 text-sm">
                <span className="min-w-0 break-words font-medium">{row.word}</span>
                <span className="shrink-0 tabular-nums">{row.count}회</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-base-200" aria-hidden="true">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(row.count / max) * 100}%`,
                    backgroundColor: `var(--color-hl-${category})`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-base-content/70">감지된 표현이 없어요.</p>
      )}
    </section>
  );
}
