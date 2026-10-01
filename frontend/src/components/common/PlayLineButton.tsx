type Props = { playing: boolean; disabled?: boolean; label: string; onClick: () => void };

// 문장 하나 재생/정지 버튼 (대본 검토·스크립트 화면)
export default function PlayLineButton({ playing, disabled, label, onClick }: Props) {
  return (
    <button
      type="button"
      className={`btn btn-circle btn-ghost btn-sm shrink-0 ${playing ? "text-accent" : "text-secondary"}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={playing ? `${label} 정지` : `${label} 듣기`}
      aria-pressed={playing}
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
        {playing ? (
          <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="currentColor" />
        ) : (
          <path
            d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.4-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5Z"
            fill="currentColor"
          />
        )}
      </svg>
    </button>
  );
}
