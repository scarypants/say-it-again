import { lazy, Suspense } from "react";

// pdf.js가 커서 자료를 올렸을 때만 불러온다
const PdfViewer = lazy(() => import("./PdfViewer"));

type Props = { file: File; locked: boolean; onRemove: () => void };

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)}KB`
    : `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// 와이어프레임 "자료 업로드 시 이 화면": 녹음 전에 올린 발표 자료를 보면서 녹음한다
export default function MaterialPreview({ file, locked, onRemove }: Props) {
  return (
    <figure className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-box border border-base-300 bg-base-200">
      <div className="flex min-h-72 flex-1">
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center">
              <span
                className="loading loading-spinner text-secondary"
                aria-label="자료 불러오는 중"
              />
            </div>
          }
        >
          <PdfViewer file={file} />
        </Suspense>
      </div>
      <figcaption className="flex items-center justify-between gap-3 border-t border-base-300 bg-base-100 px-3 py-2 text-sm">
        <span className="truncate">
          {file.name} <span className="text-secondary">{formatSize(file.size)}</span>
        </span>
        {!locked && (
          <button type="button" className="btn btn-ghost btn-xs shrink-0" onClick={onRemove}>
            바꾸기
          </button>
        )}
      </figcaption>
    </figure>
  );
}
