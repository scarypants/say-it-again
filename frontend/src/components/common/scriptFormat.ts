import type { Mode } from "../../types/api";

export const PART_SEC = 300; // 발표 녹음은 5분마다 파일(파트)이 나뉜다

export function mmss(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// 파트 제목. 발표: 전체에서 몇 분 몇 초 구간인지 / 스피킹·면접: 몇 번째 질문인지.
// question(질문 문자열)에 "Q4"처럼 원래 번호가 있으면 그걸 쓴다 (면접에서 건너뛴 뒤에도 번호 유지)
export function partTitle(
  mode: Mode,
  index: number,
  duration: number,
  question?: string,
  startSec = index * PART_SEC,
) {
  if (mode !== "presentation") {
    // 꼬리질문 연습: "Interview Follow-up 2 (about Q4)" → 꼬리질문 2
    const follow = question?.match(/\bFollow-up (\d+)\b/)?.[1];
    if (follow) return `꼬리질문 ${follow}`;
    const n = question?.match(/\bQ(\d+)\b/)?.[1];
    return `질문 ${n ?? index + 1}`;
  }
  const from = startSec;
  return `${mmss(from)} – ${mmss(from + duration)}`;
}

// 스피킹 질문 문자열에서 화면에 보여 줄 질문 한 줄 (토익은 "Question:" 줄, 지문 읽기는 파트 이름)
export function questionLine(question: string | undefined) {
  if (!question) return undefined;
  const lines = question.split("\n");
  const q = lines.find((l) => l.startsWith("Question: "));
  if (q) return q.slice("Question: ".length);
  // 오픽 꼬리질문은 머리말 줄 다음이 질문이다
  return /\bFollow-up \d+/.test(lines[0]) && lines.length > 1 ? lines.slice(1).join(" ") : lines[0];
}

export function totalDuration(parts: { duration: number }[]) {
  return parts.reduce((sum, p) => sum + p.duration, 0);
}
