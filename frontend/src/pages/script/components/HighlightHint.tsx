import type { ReactNode } from "react";
import { categories } from "../feedback";

export default function HighlightHint({
  category,
  children,
}: {
  category: keyof typeof categories;
  children: ReactNode;
}) {
  const hover = category === "panic" || category === "filler";
  return hover ? (
    <span className="tooltip tooltip-top inline" data-tip={categories[category].description}>
      {children}
    </span>
  ) : (
    children
  );
}
