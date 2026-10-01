import { useEffect, useRef } from "react";
import type { Highlight, Part } from "../../types/api";
import { revealSoon } from "../../components/common/reveal";
import { CATEGORY, displayCategory, highlightText } from "./highlights";

// 같은 종류가 바로 붙어 있으면("어 그러니까") 대본에서 한 덩어리로 칠했으니 설명도 하나로 합친다
function mergeAdjacent(items: Highlight[]): Highlight[] {
  const out: Highlight[] = [];
  const actionable = items.map((h) => ({ ...h, category: displayCategory(h.category) }));
  for (const h of actionable.sort((a, b) => a.from - b.from)) {
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
      items.findIndex((h) => displayCategory(h.category) === a.category) -
      items.findIndex((h) => displayCategory(h.category) === b.category),
  );
}

type Props = { part: Part; items: Highlight[]; onClose: () => void; inline?: boolean };

// 하이라이트를 눌렀을 때 보이는 LLM 분석 (와이어프레임: 단어 / 변경 후 / 사유). 패닉존은 막힌 이유와 이어 갈 말.
// 폰은 누른 줄 바로 아래(inline), PC는 오른쪽 칸에 띄운다
export default function FeedbackDetail({ part, items: raw, onClose, inline }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const items = mergeAdjacent(raw);

  // 줄 아래에 펼쳐질 때 화면 밖이나 아래 고정 버튼에 가리면 보이게 당긴다 (Collapse가 다 펼친 뒤)
  useEffect(() => (inline ? revealSoon(ref.current) : undefined), [inline, raw]);

  if (!items.length) return null;

  return (
    <div
      ref={ref}
      role="region"
      aria-label="하이라이트 분석"
      className={inline ? "mt-1 mb-2 rounded-box bg-base-200 px-4 py-4" : "animate-fade"}
    >
      {items.map((h, i) => (
        <article key={i} className={i ? "mt-5 border-t border-base-300 pt-5" : ""}>
          <header className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY[h.category].dot}`} aria-hidden />
            <h2 className="text-base font-semibold">{CATEGORY[h.category].label}</h2>
            {h.category === "panic" && h.pauseSec !== undefined && (
              <span className="text-sm text-secondary tabular-nums">
                {h.pauseSec.toFixed(1)}초 멈춤
              </span>
            )}
            {i === 0 && (
              <button
                type="button"
                className="btn btn-circle btn-ghost btn-sm ml-auto"
                aria-label="피드백 닫기"
                onClick={onClose}
              >
                <span aria-hidden="true" className="text-xl leading-none">
                  ×
                </span>
              </button>
            )}
          </header>
          {/* 재도전 결과는 서버가 패닉존 원인·대안을 비워 보낸다 (docs/api.md 5절) */}
          {h.category === "panic" && h.fixed === undefined && !h.reason ? (
            <p className="mt-3 text-sm leading-relaxed text-secondary">
              <b className="font-semibold text-base-content">{highlightText(part, h)}</b> 다음에
              멈췄어요. 막힌 이유와 이어 갈 말은 첫 분석 결과에서 볼 수 있어요.
            </p>
          ) : (
            <dl className="mt-3 flex flex-col gap-3">
              <div>
                <dt className="text-sm text-secondary">
                  {h.category === "panic" ? "멈추기 직전에 한 말" : "말한 문장"}
                </dt>
                <dd className="mt-2 text-[1.0625rem] leading-8 wrap-anywhere">
                  <mark
                    className={`box-decoration-clone rounded px-1 py-0.5 font-semibold text-base-content ${CATEGORY[h.category].mark}`}
                  >
                    {highlightText(part, h)}
                  </mark>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-secondary">
                  {h.category === "panic" ? "이렇게 이어 가 보세요" : "개선한 문장"}
                </dt>
                <dd className="mt-2 text-[1.0625rem] leading-8 wrap-anywhere font-semibold">
                  {h.fixed === undefined
                    ? "준비된 대안이 없어요"
                    : h.fixed === ""
                      ? "빼고 말해 보세요"
                      : h.fixed}
                </dd>
              </div>
              {h.reason && (
                <div>
                  <dt className="text-sm text-secondary">
                    {h.category === "panic" ? "막힌 이유" : "이유"}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed">{h.reason}</dd>
                </div>
              )}
            </dl>
          )}
        </article>
      ))}
    </div>
  );
}
