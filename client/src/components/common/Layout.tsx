import { Link, Outlet } from "react-router";

// 모바일 우선: 화면 폭과 상관없이 가운데 폰 폭 컬럼
export default function Layout() {
  return (
    <div className="min-h-screen bg-base-200">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-base-100">
        <header className="navbar border-b border-base-300 px-4">
          <Link to="/" className="text-lg font-bold tracking-tight">
            다시, 말해
          </Link>
        </header>
        <main className="flex flex-1 flex-col p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
