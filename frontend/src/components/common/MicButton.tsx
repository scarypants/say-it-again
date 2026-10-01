import { useEffect, useState } from "react";

type Props = {
  recording: boolean;
  onClick: () => void;
  disabled?: boolean;
  size?: "md" | "lg"; // md: 발표 자료를 띄워 둘 때처럼 공간이 좁을 때
};

const STOP_LOCK_MS = 1000; // 녹음을 켠 직후 이 시간 동안은 끌 수 없다 (두 번 눌러 바로 꺼지는 실수 방지)

// 녹음 화면·어학 질문 화면에서 같이 쓰는 원형 마이크 버튼
export default function MicButton({ recording, onClick, disabled, size = "lg" }: Props) {
  const box = size === "lg" ? "h-24 w-24" : "h-16 w-16";
  const icon = size === "lg" ? "h-10 w-10" : "h-7 w-7";
  const stopIcon = size === "lg" ? "h-7 w-7" : "h-5 w-5";

  // 녹음이 막 켜졌으면 1초 동안 끄기 버튼을 막는다. 흐리게 보이다가 부드럽게 또렷해진다.
  // 질문이 바로 이어지는 화면은 녹음이 꺼졌다 켜지는 순간이 안 보일 수 있어 key={질문 번호}로 새로 그린다
  const [wasRecording, setWasRecording] = useState(recording);
  const [locked, setLocked] = useState(recording);
  if (recording !== wasRecording) {
    setWasRecording(recording);
    setLocked(recording);
  }
  useEffect(() => {
    if (!locked) return;
    const t = window.setTimeout(() => setLocked(false), STOP_LOCK_MS);
    return () => clearTimeout(t);
  }, [locked]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || locked}
      aria-label={recording ? "녹음 정지" : "녹음 시작"}
      className={`btn btn-circle btn-primary ${box} transition-[box-shadow,opacity] duration-500 ${
        recording ? "ring-8 ring-primary/15" : ""
      } ${locked ? "disabled:bg-primary disabled:text-primary-content disabled:opacity-50" : ""}`}
    >
      {recording ? (
        <span className={`${stopIcon} rounded-sm bg-current`} />
      ) : (
        <svg viewBox="0 0 24 24" className={icon} fill="currentColor" aria-hidden>
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
        </svg>
      )}
    </button>
  );
}
