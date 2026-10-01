const COPY = {
  transcribe: {
    title: "말한 내용을 글로 옮기고 있어요",
    desc: "다 되면 대본을 보여 드려요. 잘못 들린 단어를 고친 뒤 분석해요.",
  },
  analyze: {
    title: "대본을 분석하고 있어요",
    desc: "막힌 구간과 그 이유, 다듬을 표현을 찾는 중이에요.",
  },
};

// 서버 요청 중 화면. step: 녹음 → 대본(transcribe) / 대본 → 분석(analyze)
export default function AnalyzingView({ step = "transcribe" }: { step?: keyof typeof COPY }) {
  const copy = COPY[step];
  return (
    <div className="flex flex-1 animate-enter flex-col items-center justify-center gap-5 text-center">
      <span className="loading loading-dots loading-lg text-primary" />
      <div>
        <p className="text-lg font-semibold">{copy.title}</p>
        <p className="mt-2 text-sm leading-relaxed text-secondary">
          {copy.desc}
          <br />
          보통 30초 안팎 걸려요.
        </p>
      </div>
    </div>
  );
}
