// 분석 응답과 원본 Blob을 짝짓는다. 기존 녹음 화면의 URL은 화면 이동 시 해제된다.
const recordings = new WeakMap<object, readonly Blob[]>();

export function rememberRecordings(result: object, audio: readonly Blob[]) {
  recordings.set(result, [...audio]);
  return result;
}

export function getRecordings(result: object | null): readonly Blob[] {
  return result ? (recordings.get(result) ?? []) : [];
}
