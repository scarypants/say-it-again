import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useRef, useState } from "react";

GlobalWorkerOptions.workerSrc = workerUrl;

type Props = { file: File };

// 발표 자료 PDF를 한 장씩 보여 준다. 버튼, ← → 키, 좌우 스와이프로 넘김
export default function PdfViewer({ file }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const touchX = useRef<number | null>(null);
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });

  // 상자 크기가 바뀌면(화면 회전, PC 레이아웃 전환) 다시 맞춰 그린다
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBoxSize((prev) =>
        Math.abs(prev.w - width) < 2 && Math.abs(prev.h - height) < 2
          ? prev
          : { w: width, h: height },
      );
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, [doc]);

  // 파일 → 문서
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof getDocument> | null = null;
    file
      .arrayBuffer()
      .then((buf) => {
        if (cancelled) return null;
        task = getDocument({ data: buf });
        return task.promise;
      })
      .then((d) => {
        if (!d || cancelled) return;
        setDoc(d);
        setPage(1);
        setError(null);
      })
      .catch(() => !cancelled && setError("PDF를 열지 못했어요. 다른 파일로 바꿔 주세요."));
    return () => {
      cancelled = true;
      task?.destroy();
    };
  }, [file]);

  // 현재 페이지 → 캔버스 (상자 폭·높이에 맞춰 선명하게)
  useEffect(() => {
    if (!doc || !canvasRef.current || !boxRef.current) return;
    let task: { cancel: () => void } | null = null;
    let cancelled = false;
    doc.getPage(page).then((p) => {
      if (cancelled || !canvasRef.current || !boxRef.current) return;
      const base = p.getViewport({ scale: 1 });
      const box = boxRef.current.getBoundingClientRect();
      const byW = box.width / base.width;
      const fit = box.height > 0 ? Math.min(byW, box.height / base.height) : byW;
      const dpr = window.devicePixelRatio || 1;
      const viewport = p.getViewport({ scale: fit * dpr });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;
      const t = p.render({ canvas, viewport });
      task = t;
      t.promise.catch(() => {}); // 페이지를 빨리 넘기면 이전 렌더는 취소된다
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page, boxSize]);

  const total = doc?.numPages ?? 0;
  const prev = () => setPage((n) => Math.max(1, n - 1));
  const next = () => setPage((n) => Math.min(total, n + 1));

  // 노트북 시연용 키보드 넘김
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowLeft") setPage((n) => Math.max(1, n - 1));
      if (e.key === "ArrowRight") setPage((n) => Math.min(total, n + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  if (error) {
    return <p className="p-4 text-center text-sm text-error">{error}</p>;
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div
        ref={boxRef}
        className="flex min-h-0 flex-1 items-center justify-center p-2"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (dx > 40) prev();
          if (dx < -40) next();
          touchX.current = null;
        }}
      >
        {doc ? (
          <canvas
            ref={canvasRef}
            className="bg-white shadow-sm"
            aria-label={`발표 자료 ${page}쪽`}
          />
        ) : (
          <span className="loading loading-spinner text-secondary" />
        )}
      </div>
      {total > 0 && (
        <div className="flex items-center justify-between border-t border-base-300 bg-base-100 px-2 py-1.5">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={prev}
            disabled={page <= 1}
            aria-label="이전 페이지"
          >
            ‹ 이전
          </button>
          <span className="text-sm tabular-nums text-secondary" aria-live="polite">
            {page} / {total}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={next}
            disabled={page >= total}
            aria-label="다음 페이지"
          >
            다음 ›
          </button>
        </div>
      )}
    </div>
  );
}
