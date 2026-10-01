// 고르거나 펼친 곳이 항상 잘 보이게: 펼침(Collapse 260ms)이 끝난 뒤 요소가 화면에 다 들어오는지 보고,
// 잘려 있으면(위로 넘치거나 아래 고정 버튼에 가리면) 부드럽게 스크롤한다. 이미 다 보이면 움직이지 않는다.
// 아래 고정 버튼 높이는 styles/index.css의 scroll-padding으로 맞춘다 (scrollIntoView도 그 값을 따른다).
// 사용: useEffect(() => revealSoon(ref.current, "center"), [selected]);  (반환값이 정리 함수)
export function revealSoon(el: HTMLElement | null, block: ScrollLogicalPosition = "nearest") {
  if (!el) return () => {};
  let done = false;
  const check = () => {
    if (done || !el.isConnected) return;
    const root = getComputedStyle(document.documentElement);
    const top = parseFloat(root.scrollPaddingTop) || 0;
    const bottom = parseFloat(root.scrollPaddingBottom) || 0;
    const r = el.getBoundingClientRect();
    if (r.top >= top && r.bottom <= window.innerHeight - bottom) return; // 다 보임
    done = true;
    // 기기에서 동작 줄이기를 켰으면 부드럽게 미끄러지지 않고 바로 옮긴다
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block, behavior: still ? "instant" : "smooth" });
  };
  // 펼침이 끝난 뒤 한 번, 느린 기기에서 늦게 펼쳐질 때를 대비해 한 번 더
  const timers = [300, 700].map((ms) => window.setTimeout(check, ms));
  return () => timers.forEach(clearTimeout);
}
