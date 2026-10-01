// 분석 요청 중 화면 (녹음·어학 질문 화면 공용)
export default function AnalyzingView() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <span className="loading loading-dots loading-lg text-primary" />
      <div>
        <p className="text-lg font-semibold">녹음을 분석하고 있어요</p>
        <p className="mt-2 text-sm leading-relaxed text-secondary">
          말을 글로 옮기고, 막힌 구간과 그 이유를 찾는 중이에요.
          <br />
          보통 30초 안팎 걸려요.
        </p>
      </div>
    </div>
  );
}
