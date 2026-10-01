import { useAnalysis } from "../../store/analysis";
import OpicExam from "./OpicExam";
import ToeicSpeakingExam from "./ToeicSpeakingExam";

// 와이어프레임 어학 모드 화면. 토익 스피킹·오픽 모두 실제 시험처럼 자동 진행
export default function QuestionPage() {
  const { settings } = useAnalysis();
  return settings.exam === "TOEIC-Speaking" ? <ToeicSpeakingExam /> : <OpicExam />;
}
