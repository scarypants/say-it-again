import { useState } from "react";
import { followUpQuestions } from "../../api/client";
import { followUpRequest, usePracticeFollowUp } from "../../store/analysis";
import type { AnalyzeResponse } from "../../types/api";

// 모드마다 꼬리질문의 성격이 다르다 (docs/api.md 6절)
const COPY = {
  presentation: {
    title: "예상 질문",
    desc: "발표가 끝나고 받을 법한 질문과 답변 방향이에요.",
    get: "예상 질문 받기",
  },
  interview: {
    title: "꼬리질문",
    desc: "방금 한 답변을 파고드는 질문이에요. 면접관이 이어서 물을 수 있어요.",
    get: "꼬리질문 받기",
  },
  speaking: {
    title: "연습 질문 더 받기",
    desc: "같은 시험 형식으로 이어서 연습할 질문이에요.",
    get: "연습 질문 받기",
  },
} as const;

type Props = {
  result: AnalyzeResponse;
  questions?: string[]; // 원래 연습의 질문 문자열 (스피킹·면접)
};

// 결과 화면 아래의 꼬리질문. 버튼을 누르면 질문을 받아(LLM 호출) 바로 질문 연습 화면으로 넘어간다.
// 답변 방향·질문 의도는 연습 화면에서 눌러서 보는 힌트로 나온다
export default function FollowUpQuestions({ result, questions }: Props) {
  const copy = COPY[result.mode];
  const practice = usePracticeFollowUp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await followUpQuestions(followUpRequest(result, questions, []));
      practice(result, res.questions, questions?.[0]?.match(/^Job: (.*)$/m)?.[1]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "질문을 만들지 못했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="follow-up-title" className="border-t border-base-300 pt-5">
      <h2 id="follow-up-title" className="text-lg font-bold">
        {copy.title}
      </h2>
      <p className="mt-1 text-sm text-secondary">{copy.desc}</p>

      <button
        type="button"
        className="btn btn-outline mt-4 border-base-300"
        onClick={() => void start()}
        disabled={busy}
      >
        {busy ? (
          <>
            <span className="loading loading-spinner loading-sm" />
            질문 만드는 중
          </>
        ) : (
          copy.get
        )}
      </button>

      {error && (
        <div role="alert" className="alert alert-error alert-soft mt-3 text-sm">
          {error}
        </div>
      )}
    </section>
  );
}
