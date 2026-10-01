import { Link, Outlet } from "react-router";
import Logo from "./Logo";

// 모바일 우선: 화면 폭과 상관없이 가운데 폰 폭 컬럼. 상단 = 로고(홈) + 기록
export default function Layout() {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-base-100 sm:border-x sm:border-base-300">
      <header className="flex h-14 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
          <Logo />
          <span>다시, 말해</span>
        </Link>
        {/* 기록: DB가 없어 스트레치 목표. 자리만 잡아 둔다 */}
        <button type="button" className="btn btn-ghost btn-sm" disabled title="준비 중">
          기록
        </button>
      </header>
      <main className="flex flex-1 flex-col px-5 pb-6">
        <Outlet />
      </main>
    </div>
  );
}
