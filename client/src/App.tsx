import { createBrowserRouter, RouterProvider } from "react-router";
import Layout from "./components/common/Layout";
import HomePage from "./pages/home";
import QuestionPage from "./pages/question";
import RecordPage from "./pages/record";
import ScriptPage from "./pages/script";
import SummaryPage from "./pages/summary";
import UploadPage from "./pages/upload";
import { AnalysisProvider } from "./store/AnalysisContext";

// 각 페이지는 pages/<name>/index.tsx 의 default export. 주인은 AGENTS.md 2절 참고.
const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <HomePage /> }, // 고민준: 모드 선택
      { path: "/record", element: <RecordPage /> }, // 고민준: 녹음
      { path: "/upload", element: <UploadPage /> }, // 고민준: 발표 자료 업로드
      { path: "/question", element: <QuestionPage /> }, // 고민준: 어학 질문
      { path: "/script", element: <ScriptPage /> }, // 김왁수: 스크립트 하이라이트
      { path: "/summary", element: <SummaryPage /> }, // 김왁수: 총평
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
