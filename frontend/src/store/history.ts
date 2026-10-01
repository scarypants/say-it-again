import type { AnalyzeResponse, TranscribeResponse } from "../types/api";

// 기록: 분석이 끝난 연습을 이 브라우저의 localStorage에 남긴다 (서버 DB 없음)
// - 목록(분석 결과)은 키 하나에 JSON 배열로, 녹음은 파일마다 base64로 따로 둔다
// - localStorage는 5MB 안팎이라 녹음은 몇 개만 들어간다. 자리가 없으면 오래된 기록의 녹음부터 지우고,
//   그래도 없으면 이번 녹음은 빼고 결과만 남긴다

const LIST_KEY = "dasi:history";
const audioKey = (id: string, i: number) => `dasi:audio:${id}:${i}`;
export const MAX_RECORDS = 20;

export type HistoryRecord = {
  id: string;
  savedAt: number; // ms
  questions?: string[]; // 스피킹·면접
  result: AnalyzeResponse;
  audioTypes: string[] | null; // 녹음 파일별 MIME. null이면 녹음 없이 저장됨
};

function readList(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(LIST_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as HistoryRecord[]) : [];
  } catch {
    return [];
  }
}

function removeAudio(r: HistoryRecord) {
  r.audioTypes?.forEach((_, i) => localStorage.removeItem(audioKey(r.id, i)));
}

// 목록 저장. 자리가 모자라면 가장 오래된 기록부터 통째로 지운다
function writeList(list: HistoryRecord[]) {
  const next = [...list];
  for (;;) {
    try {
      localStorage.setItem(LIST_KEY, JSON.stringify(next));
      return next;
    } catch (err) {
      const oldest = next.length > 1 ? next.pop() : undefined;
      if (!oldest) throw err;
      removeAudio(oldest);
    }
  }
}

// 최신순
export function listRecords(): HistoryRecord[] {
  return readList().sort((a, b) => b.savedAt - a.savedAt);
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// 녹음 한 파일 저장. 자리가 없으면 다른 기록의 녹음을 오래된 것부터 지우고 다시 시도한다
function putAudio(key: string, data: string, keepId: string): boolean {
  for (;;) {
    try {
      localStorage.setItem(key, data);
      return true;
    } catch {
      const list = listRecords();
      const victim = [...list].reverse().find((r) => r.id !== keepId && r.audioTypes);
      if (!victim) return false;
      removeAudio(victim);
      writeList(list.map((r) => (r.id === victim.id ? { ...r, audioTypes: null } : r)));
    }
  }
}

// 분석이 끝나면 부른다. 실패해도 연습 흐름은 막지 않는다
export async function saveRecord(
  audio: Blob[],
  questions: string[] | undefined,
  result: AnalyzeResponse,
): Promise<void> {
  const record: HistoryRecord = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt: Date.now(),
    questions,
    result,
    audioTypes: null,
  };
  try {
    const list = [record, ...listRecords()];
    list.slice(MAX_RECORDS).forEach(removeAudio);
    writeList(list.slice(0, MAX_RECORDS));
    if (!audio.length) return;

    const data = await Promise.all(audio.map(toBase64));
    const saved = data.every((d, i) => putAudio(audioKey(record.id, i), d, record.id));
    if (!saved) {
      data.forEach((_, i) => localStorage.removeItem(audioKey(record.id, i)));
      return;
    }
    const types = audio.map((b) => b.type || "audio/webm");
    writeList(listRecords().map((r) => (r.id === record.id ? { ...r, audioTypes: types } : r)));
  } catch {
    // 시크릿 창·저장소 차단 등: 기록 없이 계속한다
  }
}

// 저장된 녹음을 Blob으로. 하나라도 없으면 빈 배열 (문장 재생만 꺼진다)
export function loadAudio(r: HistoryRecord): Blob[] {
  if (!r.audioTypes) return [];
  try {
    const blobs: Blob[] = [];
    for (const [i, type] of r.audioTypes.entries()) {
      const b64 = localStorage.getItem(audioKey(r.id, i));
      if (b64 === null) return [];
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
      blobs.push(new Blob([bytes], { type }));
    }
    return blobs;
  } catch {
    return [];
  }
}

// 결과 화면(스크립트)이 쓰는 세션 모양으로 되돌린다. 대본은 결과의 parts에 이미 있다
export function recordTranscript(r: HistoryRecord): TranscribeResponse {
  const { mode, level, exam, language, parts } = r.result;
  return {
    mode,
    level,
    exam,
    language,
    parts: parts.map((p) => ({ duration: p.duration, script: p.script })),
  };
}

export function deleteRecord(id: string) {
  try {
    const list = listRecords();
    const target = list.find((r) => r.id === id);
    if (target) removeAudio(target);
    writeList(list.filter((r) => r.id !== id));
  } catch {
    // 무시
  }
}

export function clearRecords() {
  try {
    listRecords().forEach(removeAudio);
    localStorage.removeItem(LIST_KEY);
  } catch {
    // 무시
  }
}
