// 와이어프레임의 마름모 로고. 가운데 두 막대 = 말이 멈춘 자리(⏸)
export default function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect
        x="6"
        y="6"
        width="20"
        height="20"
        rx="3"
        transform="rotate(45 16 16)"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <rect x="12.6" y="11.5" width="2.4" height="9" rx="1.2" fill="currentColor" />
      <rect x="17" y="11.5" width="2.4" height="9" rx="1.2" fill="currentColor" />
    </svg>
  );
}
