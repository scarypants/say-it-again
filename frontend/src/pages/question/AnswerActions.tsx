// 시험이 끝난 뒤 답변 카드 아래: 이 문항만 다시 녹음하거나, 분석에서 빼기(건너뛰기)
type Props = {
  hasAnswer: boolean;
  failed: boolean; // 서버가 이 답변에서 말을 거의 알아듣지 못했다 (422)
  onRedo: () => void;
  onSkip: () => void;
  download?: { href: string; name: string };
};

export default function AnswerActions({ hasAnswer, failed, onRedo, onSkip, download }: Props) {
  return (
    <>
      {failed && (
        <p role="alert" className="mt-2 text-sm text-error">
          이 답변은 알아들은 말이 너무 적어요. 다시 녹음하거나 건너뛰어 주세요.
        </p>
      )}
      <div className="mt-2 flex flex-wrap justify-end gap-1">
        {download && (
          <a href={download.href} download={download.name} className="btn btn-ghost btn-sm">
            파일 저장
          </a>
        )}
        {hasAnswer && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onSkip}>
            건너뛰기
          </button>
        )}
        <button
          type="button"
          className={`btn btn-sm ${failed ? "btn-primary" : "btn-outline border-base-300"}`}
          onClick={onRedo}
        >
          {hasAnswer ? "다시 녹음" : "녹음하기"}
        </button>
      </div>
    </>
  );
}
