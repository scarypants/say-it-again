import type { AnalyzeResponse } from "../../types/api";

type Props = { previous: AnalyzeResponse };

// "다시, 말해" 재도전: 지난번 막혔던 곳(패닉존)의 대안 대본과 전체 최종 대본을 보면서 다시 녹음한다
export default function RetryScript({ previous }: Props) {
  const panics = previous.parts.flatMap((p) =>
    p.highlight.filter((h) => h.category === "panic" && h.fixed),
  );
  const finalLines = previous.parts.flatMap((p) => p.final.map((f) => f.words.join(" ")));
  const { panicCount, panicTotalSec } = previous.analysis.stats;

  return (
    <section
      aria-label="지난번 대안 대본"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-box border border-base-300 bg-base-100"
    >
      <header className="border-b border-base-300 px-4 py-3">
        <h2 className="font-semibold">지난번에 막혔던 곳</h2>
        <p className="text-sm text-secondary">
          {panicCount > 0
            ? `${panicCount}곳에서 모두 ${panicTotalSec.toFixed(1)}초 멈췄어요. 아래 문장으로 이어 말해 보세요.`
            : "멈춘 곳은 없었어요. 다듬은 대본으로 한 번 더 말해 보세요."}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {panics.length > 0 && (
          <ol className="flex flex-col gap-3">
            {panics.map((h, i) => (
              <li key={i} className="rounded-box bg-hl-panic-soft p-3">
                <span className="badge badge-sm border-0 bg-hl-panic text-white tabular-nums">
                  {h.pauseSec?.toFixed(1)}초 멈춤
                </span>
                {h.reason && <p className="mt-1.5 text-xs text-secondary">{h.reason}</p>}
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed font-medium">{h.fixed}</p>
              </li>
            ))}
          </ol>
        )}

        {finalLines.length > 0 && (
          <details className="group mt-4" open={panics.length === 0}>
            <summary className="cursor-pointer text-sm font-medium text-secondary select-none">
              다듬은 전체 대본 보기
            </summary>
            <ol className="mt-2 flex flex-col gap-1.5 text-[0.9375rem] leading-relaxed">
              {finalLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </section>
  );
}
