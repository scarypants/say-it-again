import { Link, Outlet, useMatches } from "react-router";
import Logo from "./Logo";

// 라우트에 handle: { wide: true }를 주면 PC(lg 이상)에서 넓게 쓴다. 안 주면 폰 폭 컬럼 그대로
export type RouteHandle = { wide?: boolean };

// 모바일 우선: 폰에선 한 컬럼. PC에선 상단 바가 화면 끝까지, 본문은 페이지가 고른 폭으로 가운데
export default function Layout() {
  const matches = useMatches();
  const wide = matches.some((m) => (m.handle as RouteHandle | undefined)?.wide);

  return (
    <div className="flex min-h-svh flex-col bg-base-100">
      <header className="sm:border-b sm:border-base-300">
        <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4 lg:max-w-6xl lg:px-8">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <Logo />
            <span>다시, 말해</span>
          </Link>
          {/* 기록: DB가 없어 스트레치 목표. 자리만 잡아 둔다 */}
          <button type="button" className="btn btn-ghost btn-sm" disabled title="준비 중">
            기록
          </button>
        </div>
      </header>
      <main
        className={`mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-6 sm:pt-4 ${
          wide ? "lg:max-w-6xl lg:px-8" : ""
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
}
