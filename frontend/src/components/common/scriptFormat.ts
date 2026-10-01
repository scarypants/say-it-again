import type { Mode } from "../../types/api";

export const PART_SEC = 300; // 발표 녹음은 5분마다 파일(파트)이 나뉜다

export function mmss(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// 파트 제목. 발표: 전체에서 몇 분 몇 초 구간인지 / 스피킹: 몇 번째 질문인지
export function partTitle(mode: Mode, index: number, duration: number) {
  if (mode === "speaking") return `질문 ${index + 1}`;
  const from = index * PART_SEC;
  return `${mmss(from)} – ${mmss(from + duration)}`;
}

// 스피킹 질문 문자열에서 화면에 보여 줄 질문 한 줄 (토익은 "Question:" 줄, 지문 읽기는 파트 이름)
export function questionLine(question: string | undefined) {
  if (!question) return undefined;
  const lines = question.split("\n");
  const q = lines.find((l) => l.startsWith("Question: "));
  return q ? q.slice("Question: ".length) : lines[0];
}

export function totalDuration(parts: { duration: number }[]) {
  return parts.reduce((sum, p) => sum + p.duration, 0);
}
