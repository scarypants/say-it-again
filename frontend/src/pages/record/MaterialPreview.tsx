import { useEffect, useMemo } from "react";

type Props = { file: File; onRemove: () => void };

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)}KB`
    : `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// 와이어프레임 "자료 업로드 시 이 화면": 녹음 버튼 위에 발표 자료를 띄워 보며 연습
export default function MaterialPreview({ file, onRemove }: Props) {
  const isImage = file.type.startsWith("image/");
  const url = useMemo(() => (isImage ? URL.createObjectURL(file) : null), [file, isImage]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  return (
    <figure className="overflow-hidden rounded-box border border-base-300 bg-base-200">
      {url ? (
        <img src={url} alt="발표 자료 미리보기" className="max-h-56 w-full object-contain" />
      ) : (
        <div className="flex h-32 items-center justify-center px-4 text-center text-sm text-secondary">
          {file.name}
        </div>
      )}
      <figcaption className="flex items-center justify-between gap-3 border-t border-base-300 bg-base-100 px-3 py-2 text-sm">
        <span className="truncate">
          {file.name} <span className="text-secondary">{formatSize(file.size)}</span>
        </span>
        <button type="button" className="btn btn-ghost btn-xs shrink-0" onClick={onRemove}>
          빼기
        </button>
      </figcaption>
    </figure>
  );
}
