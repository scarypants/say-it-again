import { useRef, useState } from "react";

// [임시] 테스트용: 녹음 대신 오디오 파일을 올려 바로 대본 만들기로 보낸다. 데모 전에 지운다.
// 파일 하나 = 파트 하나 (서버 상한: 파일당 5분, 최대 5개)
const MAX_FILES = 5;

export default function TestAudioUpload({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function pick(list: FileList | null) {
    const files = [...(list ?? [])];
    if (inputRef.current) inputRef.current.value = "";
    if (files.length === 0) return;
    if (files.length > MAX_FILES) {
      setError(`파일은 ${MAX_FILES}개까지 올릴 수 있어요.`);
      return;
    }
    if (files.some((f) => !f.type.startsWith("audio/") && !f.type.startsWith("video/"))) {
      setError("오디오 파일만 올릴 수 있어요.");
      return;
    }
    setError(null);
    // 이름순으로 정렬해 part1, part2 … 순서를 지킨다
    onFiles(files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
  }

  return (
    <div className="rounded-box border border-dashed border-base-300 p-3 text-center">
      <p className="text-xs text-secondary">
        테스트용 (임시) · 녹음 파일을 올리면 바로 대본을 만들어요. 여러 개면 이름순으로 이어 붙여요.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,video/webm,video/mp4"
        multiple
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
      <button
        type="button"
        className="btn btn-ghost btn-sm mt-1"
        onClick={() => inputRef.current?.click()}
      >
        테스트 녹음 파일 올리기
      </button>
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}
