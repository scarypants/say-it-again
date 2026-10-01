import { Link } from "react-router";
import { partTitle, questionLine } from "../../../components/common/scriptFormat";
import type { AnalyzeResponse } from "../../../types/api";
import { partAccuracy } from "../speakingScore";

export default function AnswerComments({ result, questions }: {
  result: AnalyzeResponse;
  questions?: string[];
}) {
  const isToeic = result.mode === "speaking" && result.exam === "TOEIC-Speaking";
  const hasQuestions = questions?.length === result.parts.length;

  return (
    <section aria-labelledby="answer-comments-title">
      <h2 id="answer-comments-title" className="text-xl font-bold">
        {isToeic ? "파트별 코멘트" : "질문별 코멘트"}
      </h2>
      <dl className="mt-3 divide-y divide-base-300 border-y border-base-300">
        {result.parts.map((part, index) => {
          const question = hasQuestions ? questions[index] : undefined;
          const toeicPart = question?.match(/^TOEIC Speaking Part (\d+)\b/)?.[1];
          const title = isToeic
            ? `Part ${toeicPart ?? index + 1}`
            : partTitle(result.mode, index, part.duration, question);
          const prompt = questionLine(question);
          const comment = part.comment?.trim();
          const accuracy = result.mode === "speaking" ? partAccuracy(part) : null;

          return (
            <div key={index} className="grid gap-3 py-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:gap-6">
              <dt className="min-w-0">
                <p className="text-sm font-semibold text-secondary">{title}</p>
                {prompt && (
                  <p className="mt-2 text-base font-semibold leading-relaxed wrap-anywhere">{prompt}</p>
                )}
              </dt>
              <dd className="min-w-0">
                {accuracy !== null && (
                  <p className="mb-2 text-sm font-semibold tabular-nums text-accent">답변 정확성 {accuracy}점</p>
                )}
                <p className={`max-w-prose text-base leading-relaxed wrap-anywhere ${comment ? "text-base-content" : "text-secondary"}`}>
                  {comment || "이 답변의 코멘트가 제공되지 않았어요."}
                </p>
                <Link
                  to={`/script?part=${index}`}
                  aria-label={`${title} 대본 보기`}
                  className="btn btn-ghost mt-2 min-h-10 px-0 text-sm text-accent"
                >
                  대본 보기
                </Link>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
