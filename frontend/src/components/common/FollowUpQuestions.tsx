import { useState } from "react";
import { followUpQuestions } from "../../api/client";
import { followUpRequest, usePracticeFollowUp } from "../../store/analysis";
import type { AnalyzeResponse, Question } from "../../types/api";
import Collapse from "./Collapse";
import { partTitle } from "./scriptFormat";

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

// 결과 화면 아래의 꼬리질문. 버튼을 눌렀을 때만 받는다 (LLM 호출).
// 스피킹·면접은 받은 질문으로 바로 다시 연습할 수 있다
export default function FollowUpQuestions({ result, questions }: Props) {
  const copy = COPY[result.mode];
  const practice = usePracticeFollowUp();
  const [items, setItems] = useState<Question[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState<string[]>([]); // 다시 받을 때 겹치지 않게
  const canPractice = result.mode !== "presentation";

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await followUpQuestions(followUpRequest(result, questions, asked));
      setAsked([...asked, ...res.questions.map((q) => q.text)]);
      setItems(res.questions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "질문을 만들지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  // 어느 답변에서 나온 질문인지 (면접·오픽). 원래 질문 번호를 쓴다
  const aboutLabel = (q: Question) =>
    q.about !== undefined && result.parts.length > 1
      ? `${partTitle(result.mode, q.about, 0, questions?.[q.about])} 답변에서`
      : q.topic?.label;

  const spinner = <span className="loading loading-spinner loading-sm" />;

  return (
    <section aria-labelledby="follow-up-title" className="border-t border-base-300 pt-5">
      <h2 id="follow-up-title" className="text-lg font-bold">
        {copy.title}
      </h2>
      <p className="mt-1 text-sm text-secondary">{copy.desc}</p>

      {!items.length && (
        <button
          type="button"
          className="btn btn-outline mt-4 border-base-300"
          onClick={() => void load()}
          disabled={busy}
        >
          {busy ? (
            <>
              {spinner}
              질문 만드는 중
            </>
          ) : (
            copy.get
          )}
        </button>
      )}

      {error && (
        <div role="alert" className="alert alert-error alert-soft mt-3 text-sm">
          {error}
        </div>
      )}

      <Collapse open={items.length > 0}>
        <ol
          key={asked.length}
          className="mt-4 flex animate-fade flex-col gap-4"
          aria-live="polite"
        >
          {items.map((q, i) => (
            <li key={q.text} className="flex gap-3">
              <span className="w-5 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-secondary">
                {i + 1}
              </span>
              <div className="min-w-0">
                {aboutLabel(q) && <p className="text-xs text-secondary">{aboutLabel(q)}</p>}
                <p lang={result.language} className="leading-relaxed font-medium">
                  {q.text}
                </p>
                {q.context && (
                  <p lang={result.language} className="mt-1 text-sm text-secondary">
                    {q.context}
                  </p>
                )}
                {q.hint && <p className="mt-1 text-sm text-accent">{q.hint}</p>}
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          {canPractice && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => practice(result, items, questions?.[0]?.match(/^Job: (.*)$/m)?.[1])}
            >
              이 질문으로 연습하기
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void load()}
            disabled={busy}
          >
            {busy && spinner}
            다른 질문 받기
          </button>
        </div>
      </Collapse>
    </section>
  );
}
