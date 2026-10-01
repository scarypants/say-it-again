// 막대 표시 + "다시, 말해" 글자 로고 (public/logo.png, 잉크색 #1e2b4f).
// 어두운 바탕 위에는 tone="light" (public/logo-light.png, 종이색 #fcfcfd)
type Props = { className?: string; tone?: "ink" | "light" };

export default function Logo({ className = "h-10 w-auto", tone = "ink" }: Props) {
  return (
    <img
      src={tone === "light" ? "/logo-light.png" : "/logo.png"}
      alt="다시, 말해"
      width={834}
      height={453}
      className={className}
    />
  );
}
