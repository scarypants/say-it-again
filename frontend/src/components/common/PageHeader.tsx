import type { ReactNode } from "react";

type Props = { title: ReactNode; description?: ReactNode; action?: ReactNode };

// 페이지 맨 위 제목 줄. 모든 화면이 같은 크기·여백을 쓰도록 공용으로 둔다 (홈 히어로 제외)
// action: 오른쪽 버튼 자리 (예: "설정 바꾸기")
export default function PageHeader({ title, description, action }: Props) {
  return (
    <section className="flex flex-wrap items-start justify-between gap-3 pt-4 pb-5 sm:pt-2">
      <div className="min-w-0">
        <h1 className="text-xl leading-snug font-bold tracking-tight break-keep">{title}</h1>
        {description && <p className="mt-2 max-w-prose text-sm leading-relaxed text-secondary">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </section>
  );
}
