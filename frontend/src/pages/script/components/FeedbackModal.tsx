import { useEffect, useRef } from "react";
import { categories, type Feedback } from "../feedback";

export default function FeedbackModal({
  feedback,
  time,
  onClose,
}: {
  feedback: Feedback[];
  time: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = feedback.length > 0;
  useEffect(() => {
    const element = dialog.current;
    if (open && !element?.open) element?.showModal();
    else if (!open && element?.open) element.close();
    return () => {
      element?.close();
    };
  }, [open]);

  return (
    <dialog
      ref={dialog}
      id="script-feedback"
      className="modal"
      aria-labelledby="feedback-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="modal-box max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto p-5">
        <button
          type="button"
          className="btn btn-sm btn-circle btn-ghost absolute top-3 right-3"
          aria-label="피드백 닫기"
          onClick={onClose}
          autoFocus
        >
          <span aria-hidden="true" className="text-xl">
            ×
          </span>
        </button>
        <h2 id="feedback-title" className="pr-10 text-lg font-bold">
          선택한 구간의 피드백
        </h2>
        <p className="mt-2 text-xs tabular-nums text-base-content/65">{time}</p>
        <div className="mt-5 flex flex-col gap-5">
          {feedback.map((item, index) => (
            <section key={index} className={index ? "border-t border-base-300 pt-5" : ""}>
              <h3
                className={`inline rounded px-2 py-1 text-sm font-semibold underline underline-offset-4 ${categories[item.category].style}`}
              >
                {categories[item.category].label}
              </h3>
              <h4 className="mt-4 text-xs font-semibold text-base-content/70">말한 표현</h4>
              <p className="mt-1 font-script text-lg leading-relaxed wrap-anywhere">
                {item.original}
              </p>
              <div className="mt-4 rounded-box bg-base-200 p-4">
                <h4 className="text-sm font-semibold">이렇게 다시 말해보세요</h4>
                <p className="mt-2 font-script text-lg leading-relaxed whitespace-pre-wrap wrap-anywhere">
                  {item.improved || "개선된 표현이 아직 준비되지 않았어요."}
                </p>
              </div>
              {item.category !== "panic" && item.reason && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold">개선 이유</h4>
                  <p className="mt-2 text-sm leading-relaxed wrap-anywhere">{item.reason}</p>
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
      <div className="modal-backdrop">
        <button type="button" onClick={onClose} aria-label="팝업 배경을 눌러 닫기">
          닫기
        </button>
      </div>
    </dialog>
  );
}
