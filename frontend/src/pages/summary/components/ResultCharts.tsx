import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

type Category = { name: string; value: number; fill: string };
type Props = { fillers: { word: string; count: number }[]; categories: Category[] };

export default function ResultCharts({ fillers, categories }: Props) {
  const top = fillers
    .filter((item) => Number.isFinite(item.count) && item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const nonzero = categories.filter((item) => Number.isFinite(item.value) && item.value > 0);
  const total = nonzero.reduce((sum, item) => sum + item.value, 0);

  return (
    <>
      <section aria-labelledby="filler-chart-title">
        <h2 id="filler-chart-title" className="text-lg font-bold">
          자주 나온 군더더기
        </h2>
        {top.length ? (
          <>
            <div className="mt-3 min-w-0" aria-hidden="true">
              <ResponsiveContainer width="100%" height={Math.max(150, top.length * 38)}>
                <BarChart
                  data={top}
                  layout="vertical"
                  margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                >
                  <CartesianGrid stroke="var(--color-base-300)" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: "var(--color-base-content)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="word"
                    width={72}
                    tickFormatter={(value) =>
                      String(value).length > 8 ? `${String(value).slice(0, 8)}…` : String(value)
                    }
                    tick={{ fill: "var(--color-base-content)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--color-hl-filler)"
                    radius={[0, 4, 4, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="군더더기 사용 횟수">
              {top.map((item, index) => (
                <li
                  key={`${item.word}-${index}`}
                  className="badge badge-outline h-auto max-w-full py-1 text-left whitespace-normal break-all"
                >
                  {item.word} · {item.count}회
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-3 text-sm text-base-content/70">감지된 군더더기가 없어요.</p>
        )}
      </section>

      <section aria-labelledby="category-chart-title">
        <h2 id="category-chart-title" className="text-lg font-bold">
          피드백 항목별 비중
        </h2>
        {total ? (
          <>
            <div className="mt-3 min-w-0" aria-hidden="true">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={nonzero}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={42}
                    outerRadius={74}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {nonzero.map((item) => (
                      <Cell key={item.name} fill={item.fill} stroke="var(--color-base-100)" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="grid grid-cols-2 gap-3 text-xs" aria-label="피드백 항목별 횟수와 비율">
              {nonzero.map((item) => (
                <li key={item.name} className="flex items-start gap-2">
                  <span
                    className="mt-0.5 size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.fill }}
                    aria-hidden="true"
                  />
                  <span>
                    {item.name} {item.value}개 · {Math.round((item.value / total) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-3 text-sm text-base-content/70">감지된 개선 항목이 없어요.</p>
        )}
      </section>
    </>
  );
}
