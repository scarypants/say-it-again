import { useEffect, useRef, useState } from "react";
import { LEVEL_LABEL } from "../../api/presentationLevels";
import { canRetry, useOpenRecord, useRetryFrom } from "../../store/analysis";
import { clearRecords, deleteRecord, listRecords, type HistoryRecord } from "../../store/history";
import type { InputMode } from "../../types/api";
import { mmss, totalDuration } from "./scriptFormat";

type Props = { open: boolean; onClose: () => void };

const EXAM_LABEL = { "TOEIC-Speaking": "토익 스피킹", opic: "오픽" } as const;

const when = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function kind(r: HistoryRecord["result"]) {
  // 면접(#76)은 아직 응답 타입(Mode)에 없어서 InputMode로 넓혀 비교한다
  if ((r.mode as InputMode) === "interview") return r.language === "en" ? "영어 면접" : "면접";
  if (r.mode === "speaking") return r.exam ? EXAM_LABEL[r.exam] : "어학 스피킹";
  return r.level ? LEVEL_LABEL[r.level] : "발표";
}

const clampScore = (n: number) => Math.round(Math.min(100, Math.max(0, n)));

// 헤더 "기록": 지난 연습 목록. 폰에선 아래에서 올라오는 시트, PC(lg)에선 오른쪽 패널
export default function HistoryPanel({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const openRecord = useOpenRecord();
  const retryFrom = useRetryFrom();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setRecords(listRecords());
      setConfirmClear(false);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function go(action: () => void) {
    onClose();
    action();
  }

  function remove(id: string) {
    deleteRecord(id);
    setRecords(listRecords());
  }

  function removeAll() {
    clearRecords();
    setRecords([]);
    setConfirmClear(false);
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal modal-bottom lg:modal-end"
      onClose={onClose}
      aria-labelledby="history-title"
    >
      <div className="modal-box flex max-h-[85svh] flex-col p-0 lg:h-svh lg:max-h-none lg:w-[26rem]">
        <header className="flex items-start justify-between gap-3 border-b border-base-300 px-5 pt-5 pb-4">
          <div>
            <h2 id="history-title" className="text-lg font-bold">
              기록
            </h2>
            <p className="mt-0.5 text-xs text-secondary">
              이 기기에만 저장돼요 · 최근 {records.length}개
            </p>
          </div>
          <form method="dialog">
            <button className="btn btn-circle btn-ghost btn-sm" aria-label="닫기">
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </form>
        </header>

        {records.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 px-5 py-14 text-center">
            <p className="font-medium">아직 기록이 없어요</p>
            <p className="text-sm text-secondary">분석을 마치면 결과와 녹음이 여기에 남아요.</p>
          </div>
        ) : (
          <ol className="min-h-0 flex-1 divide-y divide-base-300 overflow-y-auto">
            {records.map((rec) => (
              <HistoryItem
                key={rec.id}
                record={rec}
                onOpen={(to) => go(() => openRecord(rec, to))}
                onRetry={() => go(() => retryFrom(rec.result, rec.questions))}
                onDelete={() => remove(rec.id)}
              />
            ))}
          </ol>
        )}

        {records.length > 0 && (
          <footer className="flex items-center justify-end gap-2 border-t border-base-300 px-5 py-3">
            {confirmClear ? (
              <>
                <span className="mr-auto text-sm">기록과 녹음을 모두 지울까요?</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmClear(false)}>
                  취소
                </button>
                <button className="btn btn-error btn-sm" onClick={removeAll}>
                  모두 지우기
                </button>
              </>
            ) : (
              <button
                className="btn btn-ghost btn-sm text-secondary"
                onClick={() => setConfirmClear(true)}
              >
                전체 삭제
              </button>
            )}
          </footer>
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="기록 닫기">닫기</button>
      </form>
    </dialog>
  );
}

type ItemProps = {
  record: HistoryRecord;
  onOpen: (to: "/summary" | "/script") => void;
  onRetry: () => void;
  onDelete: () => void;
};

function HistoryItem({ record, onOpen, onRetry, onDelete }: ItemProps) {
  const r = record.result;
  const compare = r.compare;
  const headline = r.analysis.summary.headline;
  const score = clampScore(compare ? compare.after.score : r.analysis.score);

  return (
    <li className="px-5 py-4">
      <button
        type="button"
        className="group block w-full text-left"
        onClick={() => onOpen("/summary")}
        aria-label={`${when.format(record.savedAt)} ${kind(r)} 총평 보기`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-secondary">
            <span>
              {when.format(record.savedAt)} · {kind(r)} · {mmss(totalDuration(r.parts))}
            </span>
            {compare && (
              <span className="badge shrink-0 badge-xs border-0 bg-primary text-primary-content">
                재도전
              </span>
            )}
          </p>
          <p className="shrink-0 tabular-nums">
            {compare && (
              <span className="mr-1 text-sm text-secondary">
                {clampScore(compare.before.score)} →
              </span>
            )}
            <span className="text-xl font-bold">{score}</span>
            <span className="text-xs text-secondary">점</span>
          </p>
        </div>
        <p className="mt-1 line-clamp-2 text-[0.9375rem] leading-snug font-medium group-hover:underline group-hover:decoration-base-300 group-hover:underline-offset-4">
          {headline || "총평 없이 저장된 결과예요"}
        </p>
      </button>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <button className="btn btn-outline btn-xs" onClick={() => onOpen("/script")}>
          스크립트
        </button>
        {canRetry(r, record.questions) && (
          <button className="btn btn-primary btn-xs" onClick={onRetry}>
            다시, 말해
          </button>
        )}
        {!record.audioTypes && <span className="text-xs text-secondary">녹음 없이 저장됨</span>}
        <button
          className="btn ml-auto btn-outline btn-xs border-error/40 text-error hover:border-error hover:bg-error hover:text-error-content"
          onClick={onDelete}
          aria-label="이 기록 삭제"
        >
          <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true">
            <path
              d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          삭제
        </button>
      </div>
    </li>
  );
}
