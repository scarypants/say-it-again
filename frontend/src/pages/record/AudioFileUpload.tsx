import { useRef, useState } from "react";

// 이미 녹음해 둔 파일로 바로 대본 만들기. 파일 하나 = 파트 하나 (서버 상한: 파일당 5분, 최대 5개)
const MAX_FILES = 5;
// 서버가 받는 형식만 (backend/src/http/validate.ts: webm·mp4·m4a)
const TYPE_BY_EXT: Record<string, string> = {
  webm: "audio/webm",
  mp4: "audio/mp4",
  m4a: "audio/mp4",
};
const SERVER_TYPES = ["audio/webm", "video/webm", "audio/mp4", "video/mp4", "audio/x-m4a"];

const extOf = (f: File) => f.name.match(/\.(\w+)$/)?.[1]?.toLowerCase() ?? "";

// 안드로이드 녹음 앱 파일은 type이 비어 있을 때가 있다. 비어 있으면 서버가 형식을 몰라 거절하므로 확장자로 채운다
function normalize(f: File): File | null {
  if (SERVER_TYPES.includes(f.type)) return f;
  const type = TYPE_BY_EXT[extOf(f)];
  return type ? new File([f], f.name, { type }) : null;
}

export default function AudioFileUpload({ onFiles }: { onFiles: (files: File[]) => void }) {
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
    const audio = files.map(normalize);
    if (audio.some((f) => !f)) {
      setError("m4a, mp4, webm 녹음 파일만 올릴 수 있어요.");
      return;
    }
    setError(null);
    // 이름순으로 정렬해 part1, part2 … 순서를 지킨다
    onFiles(
      (audio as File[]).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    );
  }

  return (
    <div className="text-center">
      <input
        ref={inputRef}
        type="file"
        accept=".m4a,.mp4,.webm,audio/mp4,audio/x-m4a,audio/webm,video/mp4,video/webm"
        multiple
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
      <p className="text-xs text-secondary">
        이미 녹음해 둔 파일이 있나요?{" "}
        <button
          type="button"
          className="link link-primary font-medium"
          onClick={() => inputRef.current?.click()}
        >
          파일로 분석하기
        </button>
      </p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}
