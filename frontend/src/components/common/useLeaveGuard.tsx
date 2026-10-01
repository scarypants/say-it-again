import { useEffect, useRef } from "react";
import { useBlocker } from "react-router";

// 대본 검토·결과 화면으로 넘어가는 건 막지 않는다
const ALLOWED_PATHS = ["/review", "/script"];

// when이 true인 동안 다른 화면으로 가거나(로고, 처음으로, 뒤로 가기) 새로고침·창 닫기를 하면 확인을 받는다.
// 반환한 요소를 화면에 같이 렌더링해야 확인 창이 뜬다
export function useLeaveGuard(when: boolean, message = "지금까지 녹음한 내용이 모두 사라져요.") {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when &&
      currentLocation.pathname !== nextLocation.pathname &&
      !ALLOWED_PATHS.includes(nextLocation.pathname),
  );
  const dialogRef = useRef<HTMLDialogElement>(null);

  // 새로고침·탭 닫기는 브라우저 기본 확인 창만 띄울 수 있다
  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [when]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (blocker.state === "blocked" && !dialog.open) dialog.showModal();
    if (blocker.state !== "blocked" && dialog.open) dialog.close();
  }, [blocker.state]);

  const stay = () => {
    if (blocker.state === "blocked") blocker.reset();
  };
  const leave = () => {
    if (blocker.state === "blocked") blocker.proceed();
  };

  return (
    // Esc나 바깥을 눌러 닫으면 머무르기
    <dialog ref={dialogRef} className="modal modal-bottom sm:modal-middle" onClose={stay}>
      <div className="modal-box">
        <h2 className="text-lg font-bold">이 화면을 나갈까요?</h2>
        <p className="mt-2 text-sm text-secondary">{message} 나가면 되돌릴 수 없어요.</p>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost text-error" onClick={leave}>
            나가기
          </button>
          <button type="button" className="btn btn-primary" onClick={stay} autoFocus>
            계속하기
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" aria-label="계속하기">
          닫기
        </button>
      </form>
    </dialog>
  );
}
