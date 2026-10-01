import { useEffect, useRef } from "react";
import type { Highlight, Part } from "../../types/api";
import { CATEGORY, highlightText } from "./highlights";

type Props = { part: Part | null; items: Highlight[]; onClose: () => void };

// 하이라이트를 누르면 아래에서 올라오는 LLM 분석 (와이어프레임: 단어 / 변경 후 / 사유)
export default function FeedbackSheet({ part, items, onClose }: Props) {
  const open = !!part && items.length > 0;
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    sheetRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, onClose]);

  return (
    <>
      {/* 바깥을 누르면 닫힌다. 대본은 계속 보이게 어둡게 하지 않는다 */}
      {open && (
        <button
          type="button"
          aria-label="분석 닫기"
          className="fixed inset-0 z-30 cursor-default"
          onClick={onClose}
        />
      )}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="false"
        aria-label="하이라이트 분석"
        tabIndex={-1}
        className={`fixed inset-x-0 bottom-0 z-40 mx-auto max-h-[60svh] max-w-md overflow-y-auto rounded-t-box border border-b-0 border-base-300 bg-base-100 px-5 pt-3 pb-6 shadow-[0_-8px_24px_rgb(30_43_79/0.12)] transition-transform duration-300 ease-out outline-none motion-reduce:transition-none ${
          open ? "translate-y-0" : "pointer-events-none translate-y-full"
        }`}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-base-300" aria-hidden />
        {open &&
          items.map((h, i) => (
            <article key={i} className={i ? "mt-5 border-t border-base-300 pt-5" : ""}>
              <header className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY[h.category].dot}`} />
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
                  <dd className="mt-1 text-[1.0625rem] leading-relaxed">
                    {highlightText(part!, h)}
                  </dd>
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
    </>
  );
}
