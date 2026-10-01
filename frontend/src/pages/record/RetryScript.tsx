import { retryFinal } from "../../store/analysis";
import type { AnalyzeResponse } from "../../types/api";

type Props = { previous: AnalyzeResponse };

// "다시, 말해" 재도전: 위에는 지난번 총평의 개선할 점(한 줄씩), 아래에는 다듬은 대본을 항상 펼쳐 두고 보며 다시 녹음한다
export default function RetryScript({ previous }: Props) {
  const priorities = previous.analysis.summary.topPriorities.filter(Boolean).slice(0, 3);
  const lines = retryFinal(previous).map((f) => f.words.join(" "));
  const { panicCount, panicTotalSec } = previous.analysis.stats;

  return (
    <section
      aria-label="지난번 개선할 점과 다듬은 대본"
      className="flex max-h-[52svh] min-h-0 flex-1 flex-col overflow-hidden rounded-box border border-base-300 bg-base-100 lg:max-h-none"
    >
      <header className="border-b border-base-300 bg-base-200/60 px-4 py-3">
        <h2 className="text-xs font-semibold text-secondary">지난번 개선할 점</h2>
        {priorities.length > 0 ? (
          <ol className="mt-1.5 flex flex-col gap-1">
            {priorities.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm leading-snug font-medium">
                <span className="w-3 shrink-0 text-secondary tabular-nums">{i + 1}</span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-1 text-sm font-medium">
            {panicCount > 0
              ? `${panicCount}곳에서 모두 ${panicTotalSec.toFixed(1)}초 멈췄어요. 막힌 곳을 이어 말해 보세요.`
              : "다듬은 대본으로 한 번 더 말해 보세요."}
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">
        <h2 className="text-xs font-semibold text-secondary">
          다듬은 대본 · 보면서 처음부터 말해요
        </h2>
        {lines.length > 0 ? (
          <div className="mt-2 flex flex-col gap-2.5 text-[1.0625rem] leading-8 lg:text-lg lg:leading-9">
            {lines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-secondary">
            지난번 대본이 없어요. 개선할 점을 떠올리며 말해 보세요.
          </p>
        )}
      </div>
    </section>
  );
}
