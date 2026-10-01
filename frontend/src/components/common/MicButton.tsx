type Props = {
  recording: boolean;
  onClick: () => void;
  disabled?: boolean;
};

// 녹음 화면·어학 질문 화면에서 같이 쓰는 원형 마이크 버튼
export default function MicButton({ recording, onClick, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={recording ? "녹음 정지" : "녹음 시작"}
      className={`btn btn-circle btn-primary h-24 w-24 transition-shadow ${recording ? "ring-8 ring-primary/15" : ""}`}
    >
      {recording ? (
        <span className="h-7 w-7 rounded-sm bg-current" />
      ) : (
        <svg viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor" aria-hidden>
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
        </svg>
      )}
    </button>
  );
}
