import { useState } from "react";
import { useAnalysis } from "../../store/analysis";
import InterviewExam from "./InterviewExam";
import OpicExam from "./OpicExam";
import ToeicSpeakingExam from "./ToeicSpeakingExam";

// 와이어프레임 어학 모드 화면. 토익 스피킹·오픽 모두 실제 시험처럼 자동 진행. 면접 모드도 여기서 질문을 받는다
export default function QuestionPage() {
  const { settings } = useAnalysis();
  // 다시 응시하면 key를 바꿔 시험 상태(답변·단계)를 처음부터 새로 만든다
  const [round, setRound] = useState(0);
  const restart = () => setRound((r) => r + 1);
  // 꼬리질문 연습: 면접·발표 예상 질문은 면접 화면, 스피킹은 처음 시험과 같은 시험 화면에서 답한다
  if (settings.mode !== "speaking") return <InterviewExam key={round} onRestart={restart} />;
  return settings.exam === "TOEIC-Speaking" ? (
    <ToeicSpeakingExam key={round} onRestart={restart} />
  ) : (
    <OpicExam key={round} onRestart={restart} />
  );
}
