import { createBrowserRouter, RouterProvider } from "react-router";
import Layout, { type RouteHandle } from "./components/common/Layout";
import HomePage from "./pages/home";
import QuestionPage from "./pages/question";
import RecordPage from "./pages/record";
import ReviewPage from "./pages/review";
import ScriptPage from "./pages/script";
import SummaryPage from "./pages/summary";
import { AnalysisProvider } from "./store/AnalysisContext";

// PC에서 넓게 쓰는 화면 (Layout.tsx 참고). 나머지는 폰 폭 컬럼
const wide: RouteHandle = { wide: true };

// 각 페이지는 pages/<name>/index.tsx 의 default export. 주인은 AGENTS.md 2절 참고.
const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <HomePage />, handle: wide }, // 고민준: 모드 선택
      { path: "/record", element: <RecordPage />, handle: wide }, // 고민준: 녹음
      { path: "/question", element: <QuestionPage /> }, // 고민준: 어학 질문
      { path: "/review", element: <ReviewPage />, handle: wide }, // 고민준: 대본 검토·수정
      { path: "/script", element: <ScriptPage />, handle: wide }, // 고민준: 스크립트 하이라이트
      { path: "/summary", element: <SummaryPage />, handle: wide }, // 김왁수: 총평
    ],
  },
]);

export default function App() {
  return (
    <AnalysisProvider>
      <RouterProvider router={router} />
    </AnalysisProvider>
  );
}
