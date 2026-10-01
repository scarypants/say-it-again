import { useAnalysis } from "../../store/analysis";
import OpicQuestions from "./OpicQuestions";
import TossExam from "./TossExam";

// 와이어프레임 어학 모드 화면. 토익 스피킹은 실제 시험처럼 자동 진행, 오픽은 질문별 자유 연습
export default function QuestionPage() {
  const { settings } = useAnalysis();
  return settings.exam === "toss" ? <TossExam /> : <OpicQuestions />;
}
