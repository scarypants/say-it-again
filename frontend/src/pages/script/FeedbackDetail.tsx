import { useEffect, useRef } from "react";
import type { Highlight, Part } from "../../types/api";
import { CATEGORY, highlightText } from "./highlights";

// 같은 종류가 바로 붙어 있으면("어 그러니까") 대본에서 한 덩어리로 칠했으니 설명도 하나로 합친다
function mergeAdjacent(items: Highlight[]): Highlight[] {
  const out: Highlight[] = [];
  for (const h of [...items].sort((a, b) => a.from - b.from)) {
    const prev = out.find((p) => p.category === h.category && h.from <= p.to + 1);
    if (!prev) {
      out.push({ ...h });
      continue;
    }
    prev.to = Math.max(prev.to, h.to);
    prev.fixed =
      prev.fixed === "" && h.fixed === ""
        ? ""
        : [prev.fixed, h.fixed].filter((f) => f !== undefined && f !== "").join(" ") || undefined;
    if (h.reason && h.reason !== prev.reason)
      prev.reason = prev.reason ? `${prev.reason} ${h.reason}` : h.reason;
  }
  // 우선순위 순서는 원래 배열 순서를 따른다
  return out.sort(
    (a, b) =>
      items.findIndex((h) => h.category === a.category) -
      items.findIndex((h) => h.category === b.category),
  );
}

type Props = { part: Part; items: Highlight[]; onClose: () => void; inline?: boolean };

// 하이라이트를 눌렀을 때 보이는 LLM 분석 (와이어프레임: 단어 / 변경 후 / 사유).
// 폰은 누른 줄 바로 아래(inline), PC는 오른쪽 칸에 띄운다
export default function FeedbackDetail({ part, items: raw, onClose, inline }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const items = mergeAdjacent(raw);

  // 줄 아래에 펼쳐질 때 화면 밖으로 밀려나면 보이게 당긴다
  useEffect(() => {
    if (inline) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [inline, raw]);

  return (
    <div
      ref={ref}
      role="region"
      aria-label="하이라이트 분석"
      className={
        inline ? "mt-1 mb-2 animate-reveal rounded-box bg-base-200 px-4 py-4" : "animate-fade"
      }
    >
      {items.map((h, i) => (
        <article key={i} className={i ? "mt-5 border-t border-base-300 pt-5" : ""}>
          <header className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY[h.category].dot}`} aria-hidden />
            <h2 className="text-sm font-semibold">{CATEGORY[h.category].label}</h2>
            {h.category === "panic" && h.pauseSec !== undefined && (
              <span className="text-sm text-secondary tabular-nums">
                {h.pauseSec.toFixed(1)}초 멈춤
              </span>
            )}
            {i === 0 && (
              <button type="button" className="btn btn-ghost btn-xs ml-auto" onClick={onClose}>
                닫기
              </button>
            )}
          </header>
          <dl className="mt-3 flex flex-col gap-3">
            <div>
              <dt className="text-xs text-secondary">
                {h.category === "panic" ? "멈추기 직전에 한 말" : "말한 그대로"}
              </dt>
              <dd className="mt-1 text-[1.0625rem] leading-relaxed">{highlightText(part, h)}</dd>
            </div>
            <div>
              <dt className="text-xs text-secondary">
                {h.category === "panic" ? "이렇게 이어 가 보세요" : "바꾸면"}
              </dt>
              <dd className="mt-1 text-[1.0625rem] leading-relaxed font-semibold">
                {h.fixed === undefined
                  ? "준비된 대안이 없어요"
                  : h.fixed === ""
                    ? "빼고 말해 보세요"
                    : h.fixed}
              </dd>
            </div>
            {h.reason && (
              <div>
                <dt className="text-xs text-secondary">이유</dt>
                <dd className="mt-1 text-sm leading-relaxed">{h.reason}</dd>
              </div>
            )}
          </dl>
        </article>
      ))}
    </div>
  );
}
