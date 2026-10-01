import { Link } from "react-router";
import type { AnalyzeResponse } from "../../../types/api";
import { questionLine } from "../../../components/common/scriptFormat";

export default function FollowUpSummary({ result, questions }: { result: AnalyzeResponse; questions?: string[] }) {
  return (
    <section aria-labelledby="follow-up-summary-title">
      <h2 id="follow-up-summary-title" className="text-xl font-bold">꼬리질문별 피드백</h2>
      {questions?.length !== result.parts.length && (
        <p role="status" className="mt-3 text-sm text-secondary">질문 정보가 없어 답변 순서대로 표시해요.</p>
      )}
      <div className="mt-3 divide-y divide-base-300 border-y border-base-300">
        {result.parts.map((part, index) => (
          <article key={index} className="py-5">
            <p className="text-sm font-semibold text-secondary">
              꼬리질문 {questions?.length === result.parts.length
                ? questions[index].match(/^(?:Interview|OPIc) Follow-up (\d+)\b/)?.[1] ?? index + 1
                : index + 1}
            </p>
            <h3 className="mt-2 text-lg font-semibold leading-relaxed wrap-anywhere">
              {questions?.length === result.parts.length ? questionLine(questions[index]) : `답변 ${index + 1}`}
            </h3>
            <p className="mt-3 text-base leading-relaxed wrap-anywhere">
              {part.comment?.trim() || "이 답변의 개별 코멘트가 제공되지 않았어요. 전체 총평과 대본의 개선점을 확인해 주세요."}
            </p>
            {part.final.length > 0 && (
              <details className="collapse collapse-arrow mt-3 border border-base-300 bg-base-100">
                <summary className="collapse-title font-semibold">{result.mode === "interview" ? "모범 답안 보기" : "개선한 답변 보기"}</summary>
                <div className="collapse-content space-y-2 text-base leading-relaxed wrap-anywhere">
                  {part.final.map((line, lineIndex) => <p key={lineIndex}>{line.words.join(" ")}</p>)}
                </div>
              </details>
            )}
            <Link to={`/script?part=${index}`} className="btn btn-ghost mt-2 text-accent">이 답변의 대본 보기</Link>
          </article>
        ))}
      </div>
    </section>
  );
}
