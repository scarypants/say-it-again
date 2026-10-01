import { useEffect, useRef } from "react";
import { categories, type Feedback } from "../feedback";
import "./inlineFeedback.css";

export default function InlineFeedback({
  feedback,
  id,
  onClose,
}: {
  feedback: Feedback[];
  id: string;
  onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(
      () => {
        panel.current?.closest("li")?.scrollIntoView({
          block: "nearest",
          behavior: reducedMotion ? "instant" : "smooth",
        });
      },
      reducedMotion ? 0 : 280,
    );
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="script-feedback-reveal">
      <div className="min-h-0 overflow-hidden">
        <section
          ref={panel}
          id={id}
          className="relative mt-3 rounded-box border border-base-300 bg-base-200 p-4"
          aria-labelledby={`${id}-title`}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 id={`${id}-title`} className="text-sm font-bold">
              선택한 표현의 피드백
            </h3>
            <button
              type="button"
              className="btn btn-circle btn-ghost btn-sm shrink-0"
              aria-label="피드백 접기"
              onClick={onClose}
            >
              <span aria-hidden="true" className="text-xl">
                ×
              </span>
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-4" aria-live="polite">
            {feedback.map((item, index) => (
              <div key={index} className={index ? "border-t border-base-300 pt-4" : ""}>
                <h4
                  className={`inline text-xs font-semibold underline underline-offset-4 ${categories[item.category].style}`}
                >
                  {categories[item.category].label}
                </h4>
                {item.reason && (
                  <p className="mt-2 text-sm leading-relaxed wrap-anywhere">{item.reason}</p>
                )}
                <p className="mt-3 text-xs font-semibold text-base-content/65">개선한 표현</p>
                <p className="mt-1 font-script text-lg leading-relaxed whitespace-pre-wrap wrap-anywhere">
                  {item.improved || "개선된 표현이 아직 준비되지 않았어요."}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
