import { useState } from "react";
import { Link, Outlet, useLocation, useMatches } from "react-router";
import HistoryPanel from "./HistoryPanel";
import Logo from "./Logo";

// 라우트에 handle: { wide: true }를 주면 PC(lg 이상)에서 넓게 쓴다. 안 주면 폰 폭 컬럼 그대로
export type RouteHandle = { wide?: boolean };

// 모바일 우선: 폰에선 한 컬럼. PC에선 상단 바가 화면 끝까지, 본문은 페이지가 고른 폭으로 가운데
export default function Layout() {
  const matches = useMatches();
  const { pathname } = useLocation();
  const wide = matches.some((m) => (m.handle as RouteHandle | undefined)?.wide);
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <div className="flex min-h-svh flex-col bg-base-100">
      <header className="border-b border-base-300">
        <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-5 lg:max-w-6xl lg:px-8">
          <Link to="/" className="flex items-center" aria-label="다시, 말해 처음으로">
            <Logo />
          </Link>
          {/* 기록: 지난 연습을 이 기기(localStorage)에서 다시 본다 */}
          <button
            type="button"
            className="btn gap-1.5 px-3 text-[0.9375rem] btn-ghost"
            aria-haspopup="dialog"
            onClick={() => setHistoryOpen(true)}
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path
                d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 7v5l3 2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            기록
          </button>
        </div>
      </header>
      <main
        className={`mx-auto flex w-full min-w-0 max-w-md flex-1 flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pt-4 ${
          wide ? "lg:max-w-6xl lg:px-8" : ""
        }`}
      >
        {/* 화면이 바뀔 때마다 새로 그려지며 살짝 올라온다 */}
        <div key={pathname} className="flex min-w-0 flex-1 animate-enter flex-col">
          <Outlet />
        </div>
      </main>
      <HistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
