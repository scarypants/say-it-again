import type { AnalyzeResponse } from "../../../types/api";
import { comparisonValues } from "../retryComparison";

export default function RetryComparison({
  previous,
  result,
}: {
  previous: AnalyzeResponse | null;
  result: AnalyzeResponse;
}) {
  const values = comparisonValues(result, previous);
  if (!values) return null;
  const { before, after } = values;
  const rows = [
    { label: "점수", old: before.score, now: after.score, unit: "점", higher: true },
    { label: "군말/분", old: before.fillerPerMin, now: after.fillerPerMin, unit: "회" },
    { label: "반복/분", old: before.repeatPerMin, now: after.repeatPerMin, unit: "회" },
    { label: "패닉존/분", old: before.panicPerMin, now: after.panicPerMin, unit: "회" },
    {
      label: "멈춘 시간",
      old: before.panicTotalSec,
      now: after.panicTotalSec,
      unit: "초",
    },
  ];
  const improved = result.retry?.improved.filter((text) => text.trim()).slice(0, 3) ?? [];
  const remaining = result.retry?.remaining.filter((text) => text.trim()).slice(0, 3) ?? [];
  const hasFeedback = Boolean(result.retry?.comment.trim() || improved.length || remaining.length);
  const format = (value: number, unit: string) =>
    Number.isFinite(value) ? `${Math.round(value * 10) / 10}${unit}` : "—";

  return (
    <section aria-labelledby="retry-title" className="rounded-box border border-base-300 bg-base-100 p-5 sm:p-7">
      <h2 id="retry-title" className="text-xl font-bold">다시 말한 결과</h2>
      <p className="mt-2 text-base leading-relaxed text-base-content/70">
        같은 기준의 점수와 1분당 횟수로 비교해요. 점수는 높을수록, 군말·반복·멈춤은 적을수록 좋아요.
      </p>
      <table className="table mt-3 w-full text-sm sm:text-base [&_td]:px-1 [&_td]:py-3 [&_th]:px-1 [&_th]:py-3">
        <caption className="sr-only">이전 녹음과 이번 녹음의 변화</caption>
        <thead>
          <tr>
            <th scope="col">항목</th>
            <th scope="col" className="text-right">이전</th>
            <th scope="col" className="text-right">이번</th>
            <th scope="col" className="text-right">변화</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const valid = Number.isFinite(row.old) && Number.isFinite(row.now);
            const delta = valid ? Math.round((row.now - row.old) * 10) / 10 : null;
            const better = delta !== null && (row.higher ? delta > 0 : delta < 0);
            const worse = delta !== null && (row.higher ? delta < 0 : delta > 0);
            return (
              <tr key={row.label}>
                <th scope="row" className="font-medium">{row.label}</th>
                <td className="text-right tabular-nums text-base-content/70">{format(row.old, row.unit)}</td>
                <td className="text-right font-semibold tabular-nums">{format(row.now, row.unit)}</td>
                <td className={`text-right font-medium tabular-nums ${better ? "text-primary" : worse ? "text-error" : "text-base-content/70"}`}>
                  <span className="sr-only">{better ? "개선 " : worse ? "악화 " : ""}</span>
                  {delta === null ? "—" : delta === 0 ? "변화 없음" : `${delta > 0 ? "+" : "−"}${format(Math.abs(delta), row.unit)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {typeof result.compare?.scriptMatch === "number" && Number.isFinite(result.compare.scriptMatch) && (
        <p className="mt-3 text-sm font-medium">이전 대본과 일치한 비율 {result.compare.scriptMatch}%</p>
      )}
      <p className="mt-3 text-sm leading-relaxed text-base-content/70">
        군말 {before.fillerCount} → {after.fillerCount}개 · 반복 {before.repeatCount} → {after.repeatCount}개 · 패닉존 {before.panicCount} → {after.panicCount}회
      </p>
      {result.warnings?.includes("script_mismatch") && (
        <p role="alert" className="alert alert-warning alert-soft mt-4 text-sm">
          이전과 내용이 많이 달라 비교는 참고용이에요.
        </p>
      )}
      {hasFeedback ? (
        <div className="mt-5 border-t border-base-300 pt-5">
          <h3 className="font-semibold">재도전 총평</h3>
          {result.retry?.comment && result.retry.comment !== result.analysis.summary.headline && <p className="mt-2 text-base leading-relaxed wrap-anywhere">{result.retry.comment}</p>}
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            {[
              { title: "개선된 점", items: improved },
              { title: "더 연습할 점", items: remaining },
            ].map((group) => (
              <div key={group.title}>
                <h4 className="text-sm font-semibold text-primary">{group.title}</h4>
                {group.items.length ? (
                  <ul className="mt-2 space-y-2 text-base leading-relaxed">
                    {group.items.map((text, index) => <li key={index} className="wrap-anywhere">{text}</li>)}
                  </ul>
                ) : <p className="mt-2 text-sm text-base-content/70">별도 피드백이 없어요.</p>}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p role="status" className="mt-4 rounded-box bg-base-200 p-3 text-sm leading-relaxed">
          재도전 AI 총평이 없어 전후 수치만 표시했어요.
        </p>
      )}
    </section>
  );
}
