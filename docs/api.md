# API 계약 (주인: 윤화영)

> **초안.** 백엔드가 확정하면 이 줄을 지운다. 변경 시 PR 설명 첫 줄에 `[API 변경]`을 적고 팀에 알린다.
> 프론트는 아래 예시 JSON을 `frontend/src/mocks/`에 복사해 서버 없이 개발한다.

Base URL: `http://localhost:8080/api`

## POST /api/analyze

녹음 파일을 받아 STT → 줄 분할 → 필러/중복 탐지 → LLM 분석까지 한 번에 수행한다.

### 요청 (multipart/form-data)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `audio` | File (webm) | O | MediaRecorder 녹음 파일 |
| `mode` | `lecture` \| `language` \| `interview` | O | 분석 모드 |
| `language` | `ko` \| `en` | O | STT 언어 |
| `keywords` | string (쉼표 구분) | X | 발표 키워드 |
| `material` | File | X | 발표 자료 (스트레치) |

### 응답 200

```ts
type AnalyzeResponse = {
  duration: number;            // 전체 녹음 길이(초)
  lines: Line[];               // 줄 단위 스크립트. pause=true 줄이 패닉존
  fillers: { [lineIdx: number]: number[] };           // 필러워드 단어 인덱스
  repeats: { [lineIdx: number]: number[] };           // 중복 단어 인덱스
  panic: { [lineIdx: number]: { reason: string; altScript: string } }; // 키 = pause 줄 번호
  highlight: { [lineIdx: number]: HighlightItem[] };  // 표현 개선 (최대 8개)
  stats: { wpm: number; fillerCount: number; panicCount: number; panicTotalSec: number; score: number };
  fillerTop: { word: string; count: number }[];
  summary: { headline: string; topPriorities: string[]; modeComment: string };
};

type Line = {
  start: number;               // 초
  end: number;
  words: string[];             // pause 줄은 빈 배열
  pause?: boolean;             // true면 패닉존 (길이 = end - start)
};

// [시작단어idx, 끝단어idx, 이유, 개선된 표현, 유형]
type HighlightItem = [number, number, string, string, "vague" | "register" | "wrongWord" | "grammar"];
```

### 예시

```json
{
  "duration": 14.2,
  "lines": [
    { "start": 0.3, "end": 2.9, "words": ["오늘은", "음", "캠퍼스", "식당", "문제를"] },
    { "start": 2.9, "end": 6.1, "words": [], "pause": true },
    { "start": 6.1, "end": 9.4, "words": ["어", "그러니까", "식당이", "약간", "붐비는", "것", "같아요"] }
  ],
  "fillers": { "0": [1], "2": [0, 1] },
  "repeats": {},
  "panic": {
    "1": { "reason": "주제를 꺼낸 직후 근거로 넘어가는 연결 문장이 준비되지 않았습니다.", "altScript": "오늘은 캠퍼스 식당 문제를 이야기하려 합니다. 점심시간 대기 시간이 평균 20분입니다." }
  },
  "highlight": {
    "2": [[3, 6, "모호한 표현", "식당이 붐빕니다", "vague"]]
  },
  "stats": { "wpm": 92, "fillerCount": 3, "panicCount": 1, "panicTotalSec": 3.2, "score": 71 },
  "fillerTop": [{ "word": "음", "count": 1 }, { "word": "어", "count": 1 }, { "word": "그러니까", "count": 1 }],
  "summary": {
    "headline": "내용은 명확하지만 도입 직후 연결이 끊깁니다.",
    "topPriorities": ["주제 → 근거 연결 문장 준비", "'어/그러니까' 줄이기", "'~것 같아요' 대신 단정형"],
    "modeComment": "강의 발표는 첫 30초 구조가 중요합니다."
  }
}
```

### 에러

`{ "error": "메시지" }` + 4xx/5xx
