import { useSyncExternalStore } from "react";

// PC 레이아웃 기준 (Tailwind lg)
export const DESKTOP_QUERY = "(min-width: 1024px)";

// CSS 클래스로 못 바꾸는 값(컴포넌트 크기 prop 등)을 화면 폭에 맞출 때 쓴다
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
  );
}
