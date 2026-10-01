import { useEffect, useState, type ReactNode } from "react";

const DURATION_MS = 260; // styles/index.css .collapse-area의 260ms와 같게

type Props = { open: boolean; children: ReactNode; className?: string };

// 펼치고 접히는 영역. 높이가 0 ↔ 내용 높이로 부드럽게 바뀌어 아래 내용이 튀지 않는다.
// 접는 동안에는 마지막 내용을 그대로 보여 주고, 다 접힌 뒤에 뺀다.
// 사용: <Collapse open={selected}>{selected && <Detail />}</Collapse>
export default function Collapse({ open, children, className = "" }: Props) {
  const [mounted, setMounted] = useState(open);
  const [kept, setKept] = useState(children);
  if (open && !mounted) setMounted(true);
  if (open && kept !== children) setKept(children);

  useEffect(() => {
    if (open || !mounted) return;
    const t = window.setTimeout(() => setMounted(false), DURATION_MS);
    return () => clearTimeout(t);
  }, [open, mounted]);

  if (!mounted) return null;
  return (
    <div
      className={`collapse-area grid ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      aria-hidden={!open || undefined}
      inert={!open || undefined}
    >
      <div className="min-h-0 overflow-hidden">
        <div className={className}>{open ? children : kept}</div>
      </div>
    </div>
  );
}
