# API 계약 (주인: 윤화영)

> 변경 시 PR 설명 첫 줄에 `[API 변경]`을 적고 팀에 알린다.
> 프론트는 아래 예시 JSON을 `frontend/src/mocks/`에 복사해 서버 없이 개발한다.

Base URL: `http://localhost:8080/api`

## 1. 모드와 입력

| | 발표 (`presentation`) | 어학 스피킹 (`speaking`) |
|---|---|---|
| 언어 | `ko` 또는 `en` | `en` 고정 |
| 세부 | `level`: `assignment` \| `exam` \| `keynote` | `exam`: `TOEIC-Speaking` \| `opic` |
| 녹음 | 5분 단위로 나눈 파일, 1~5개 | 질문별 답변 파일, 1~5개 |
| 추가 입력 | - | `questions` (질문 문자열 배열) |

- 파일 하나가 결과의 `parts` 하나가 된다. `audio`를 보낸 순서 = `parts` 순서.
- `level`은 발표의 성격이다: 과제 발표(`assignment`), 시험 발표(`exam`), 큰 강연(`keynote`).

## 2. API 목록

| 순서 | 엔드포인트 | 요청 | 응답 |
|---|---|---|---|
| 1 | `POST /api/transcribe` | multipart: 녹음 파일 + 모드 정보 | 파트별 문장 단위 대본 (`TranscribeResponse`) |
| 2 | `POST /api/analyze` | JSON: 모드 정보 + 사용자가 고친 대본 | 분석 결과 (`AnalyzeResponse`) |
| 3 | `POST /api/retry` | JSON: 2와 같음 + 이전 결과 요약(`previous`) | 재도전 결과 + 전후 비교 (`RetryResponse`) |

```
녹음 → [1] transcribe → 대본을 사용자에게 보여 주고 전사 오류 수정 → [2] analyze → 대본 하이라이트·총평 화면
재도전 → [1] transcribe → 전사 오류 수정 → [3] retry → 전후 비교·재도전 총평
```

- 서버는 아무것도 저장하지 않는다. 그래서 2단계 요청에 1단계 응답의 `parts`를 다시 보낸다 (녹음 파일은 다시 보내지 않는다).
- 사용자가 고칠 수 있는 것은 **문장 안의 `words`뿐**이다. `start`·`end`·`wordTimes`·pause 줄은 받은 그대로 돌려보낸다.
- 수정 화면에는 "전사가 틀린 부분만 고쳐 주세요. 음·어 같은 말버릇은 지우지 마세요" 같은 안내를 둔다. 지우면 분석에서 빠진다.
- 질문은 프론트가 가지고 있으므로 질문 생성 API는 없다.

## 3. `POST /api/transcribe` (multipart/form-data)

### 요청

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `mode` | `"presentation"` \| `"speaking"` | O | 발표 / 어학 스피킹 |
| `language` | `"ko"` \| `"en"` | O | 발표는 `ko` 또는 `en`, 스피킹은 `en` |
| `audio` | File[] (1~5개) | O | 보낸 순서대로. 발표는 5분 단위로 나눈 파일, 스피킹은 질문별 답변 |
| `level` | `"assignment"` \| `"exam"` \| `"keynote"` | 발표만 | 발표 성격 |
| `exam` | `"TOEIC-Speaking"` \| `"opic"` | 스피킹만 | 시험 종류 |
| `questions` | string (JSON 배열) | 스피킹만 | 질문 문자열 배열. `audio`와 같은 순서·같은 개수 |

- 예시 — 발표: `audio=part1-recording.webm`, `mode=presentation`, `language=ko`, `level=exam` / 스피킹: `mode=speaking`, `language=en`, `exam=opic`, `questions=[…]`, `audio=q1-recording.webm`
- `audio`는 같은 필드 이름으로 여러 번 붙인다. 서버는 파일 이름이 아니라 **붙인 순서**를 파트 순서로 쓴다. webm과 mp4(Safari)를 허용한다.
- 발표 자료(PDF)는 받지 않는다. `audio` 외의 파일 필드(예: `material`)가 오면 400이다.

### 응답 200

```ts
type TranscribeResponse = {
  mode: "presentation" | "speaking";
  level?: "assignment" | "exam" | "keynote";
  exam?: "TOEIC-Speaking" | "opic";
  language: "ko" | "en";
  parts: { duration: number; script: Line[] }[];   // 녹음 파일 하나당 하나
};

// 대본의 한 줄 = 한 문장. 2초 이상 정지는 pause 줄로 따로 들어간다.
type Line = {
  start: number;                   // 초. 해당 파트 녹음 파일의 처음을 0초로 잰 시간
  end: number;
  offset: number;                  // 이 줄 첫 단어의 파트 전체 단어 번호 (하이라이트 from/to 기준)
  words: string[];                 // pause 줄은 빈 배열
  wordTimes?: [number, number][];  // 단어별 [start, end]. 프론트는 받은 그대로 돌려보낸다
  pause?: boolean;                 // true면 패닉존 (길이 = end - start)
};
```

- 문장은 whisper의 문장 경계에서 끊고, 2초 이상 멈춘 곳에서는 문장 중간이라도 끊고 pause 줄을 넣는다.
- 단어 `i`의 파트 전체 번호는 `offset + i`다.
- 시간(`start`, `end`, `wordTimes`)은 파트마다 따로 잰다. 문장 재생은 프론트가 해당 파트의 녹음 파일에서 `start`~`end` 구간을 재생하면 된다 (서버는 오디오를 자르거나 저장하지 않는다). whisper 시간은 조금 어긋날 수 있어 앞뒤 0.2초 정도 여유를 두는 것을 권한다.

```json
{
  "mode": "presentation",
  "level": "exam",
  "language": "ko",
  "parts": [
    {
      "duration": 14.2,
      "script": [
        { "start": 0.3, "end": 2.9, "offset": 0, "words": ["오늘은", "음", "캠퍼스", "식당", "문제를"],
          "wordTimes": [[0.3, 0.8], [1.0, 1.3], [1.4, 1.9], [2.0, 2.4], [2.5, 2.9]] },
        { "start": 2.9, "end": 6.1, "offset": 5, "words": [], "pause": true },
        { "start": 6.1, "end": 9.4, "offset": 5, "words": ["어", "그러니까", "식당이", "약간", "붐비는", "것", "같아요"],
          "wordTimes": [[6.1, 6.3], [6.35, 6.9], [7.4, 7.9], [8.0, 8.3], [8.4, 8.8], [8.85, 9.0], [9.05, 9.4]] }
      ]
    }
  ]
}
```

## 4. `POST /api/analyze` (application/json)

### 요청

```ts
type AnalyzeRequest = {
  mode: "presentation" | "speaking";
  level?: "assignment" | "exam" | "keynote";   // 발표
  exam?: "TOEIC-Speaking" | "opic";            // 스피킹
  language: "ko" | "en";
  questions?: string[];                        // 스피킹. JSON 배열 그대로 (문자열로 바꾸지 않는다)
  parts: { duration: number; script: Line[] }[];  // transcribe 응답의 parts에서 words만 고쳐서 보낸다
};
```

- 위 transcribe 응답 예시에 `"parts"`의 `words`만 고친 것이 그대로 요청 예시다.
- 한 칸에 여러 단어를 적어도 된다 (`"AI 쓰는"`). 서버가 공백으로 다시 나누고 `offset`을 다시 계산한다.
- 단어 수가 바뀐 문장은 `wordTimes`가 맞지 않아 서버가 그 문장의 시간을 단어 수로 균등하게 나눠 추정한다. 고치지 않은 문장은 원래 시간을 쓴다.

### 응답 200

```ts
type AnalyzeResponse = {
  mode: "presentation" | "speaking";
  level?: "assignment" | "exam" | "keynote";
  exam?: "TOEIC-Speaking" | "opic";
  language: "ko" | "en";
  parts: Part[];          // 요청 parts와 같은 순서
  charts: Charts;         // 모든 파트 합산
  analysis: Analysis;     // 모든 파트 합산, 하나
  warnings?: string[];    // 예: ["llm_failed"]
};

type Part = {
  comment?: string;       // 파트별 한 줄 코멘트 (질문 적합성 등). 스피킹에만 있다
  duration: number;       // 초
  script: Line[];         // 고친 대본 (offset 다시 계산됨)
  highlight: Highlight[];
  final: { words: string[] }[];   // 문장 단위 최종 대본. 빈 배열이면 없음 (토익 Part 1)
};

type Highlight = {
  from: number;           // 파트 전체 단어 번호 (pause 줄 제외, 0부터) = line.offset + 줄 안 번호
  to: number;             // 포함
  category: "panic" | "filler" | "repeat" | "expression" | "grammar";
  reason?: string;
  fixed?: string;         // 개선된 표현. 삭제 권장이면 빈 문자열
  pauseSec?: number;      // category가 panic일 때 정지 시간(초)
};

type Charts = {
  categoryRatio: { panic: number; filler: number; repeat: number; expression: number; grammar: number; normal: number };
  repeatTop: { word: string; count: number }[];
  fillerTop: { word: string; count: number }[];
};

type Analysis = {
  score: number;          // 0~100. charts.categoryRatio.normal과 같은 값
  stats: {
    wpm: number;
    fillerCount: number;
    panicCount: number;
    panicTotalSec: number;
    repeatCount: number;
    expressionCount: number;
    grammarCount: number;
  };
  summary: { headline: string; topPriorities: string[]; comment: string };
};
```

- 응답에는 질문 문자열을 다시 담지 않는다 (`parts[i]`는 `questions[i]`에 대응).

### 규칙
- 하이라이트는 단어 번호 범위라서 문장을 넘는 구·절도 표시할 수 있다. 겹치는 구간은 그대로 두고, 색 우선순위(빨강 > 노랑 > 보라 > 파랑 > 초록)는 프론트가 적용한다.
- `panic` 하이라이트는 pause 줄 직전 문장의 **마지막 3단어**에 붙는다. 이유와 대안 대본(`fixed`)은 LLM이 채운다.
- 필러는 코드가 찾는다. 확실한 군말(어, 음, um, uh)은 항상, 애매한 말(그, 이제, 그러니까, like, so)은 바로 뒤에 멈칫했거나 다른 필러 바로 뒤일 때만 필러로 본다.
- 중복 단어(`repeat`)도 코드가 찾는다. ① 같은 말(1~3단어)을 바로 반복("하지만 하지만", "every day every day", "정말 정말 정말")하면 반복된 범위를 묶고 `fixed`에 한 번만 쓴 표현을 넣는다. ② 5문장 안에서 같은 어간(조사를 뗀 형태)이 3번 이상이면 각 단어를 표시한다. 필러와 흔한 말("저는", "있습니다", "the" 등)은 제외한다. `repeatTop`은 어간 기준으로 센다.
- `categoryRatio`는 단어 기준 비율이다. 한 단어가 여러 카테고리에 걸리면 우선순위가 높은 하나만 세고, 6개 합은 100이다. 발표 모드에서 `grammar`는 항상 0이다.
- `repeatTop`·`fillerTop`은 전체 파트의 합산이다(최대 10개).
- `stats`는 모든 파트의 합산이다. `wpm` = 전체 단어 수 ÷ 발화 시간(분, pause 줄과 문장 사이 간격 제외, 필러 포함). `fillerCount`·`panicCount`·`repeatCount`·`expressionCount`·`grammarCount` = 해당 category의 하이라이트 수. `panicTotalSec` = `pauseSec`의 합.
- `summary.comment`는 총평 LLM이 쓰는 전체 코멘트이고, `parts[].comment`는 파트별 코멘트(스피킹만)다.
- 용어: 서버가 쓰는 설명 글(`reason`, `comment`, `summary`, `retry`)은 화면과 같은 이름만 쓴다 — 패닉존(`panic`), 군말(`filler`), 반복(`repeat`), 표현 개선(`expression`), 문법(`grammar`), 정상(`normal`). LLM 프롬프트에도 같은 지시가 들어 있다.
- 총평 화면 5개와의 대응: 카테고리 비율 = `charts.categoryRatio`, 중복 차트 = `charts.repeatTop`, 필러 차트 = `charts.fillerTop`, 분석 총평 = `analysis`, 최종 대본 = `parts[].final`.

### 예시 (발표, 파트 1개)

```json
{
  "mode": "presentation",
  "level": "exam",
  "language": "ko",
  "parts": [
    {
      "duration": 14.2,
      "script": [
        { "start": 0.3, "end": 2.9, "offset": 0, "words": ["오늘은", "음", "캠퍼스", "식당", "문제를"],
          "wordTimes": [[0.3, 0.8], [1.0, 1.3], [1.4, 1.9], [2.0, 2.4], [2.5, 2.9]] },
        { "start": 2.9, "end": 6.1, "offset": 5, "words": [], "pause": true },
        { "start": 6.1, "end": 9.4, "offset": 5, "words": ["어", "그러니까", "식당이", "약간", "붐비는", "것", "같아요"],
          "wordTimes": [[6.1, 6.3], [6.35, 6.9], [7.4, 7.9], [8.0, 8.3], [8.4, 8.8], [8.85, 9.0], [9.05, 9.4]] }
      ],
      "highlight": [
        { "from": 2, "to": 4, "category": "panic", "pauseSec": 3.2, "reason": "주제를 꺼낸 직후 근거로 넘어가는 연결 문장이 준비되지 않았습니다.", "fixed": "오늘은 캠퍼스 식당 문제를 이야기하려 합니다. 점심시간 대기 시간이 평균 20분입니다." },
        { "from": 1, "to": 1, "category": "filler", "reason": "군말입니다. 빼고 말해 보세요.", "fixed": "" },
        { "from": 5, "to": 5, "category": "filler", "reason": "군말입니다. 빼고 말해 보세요.", "fixed": "" },
        { "from": 6, "to": 6, "category": "filler", "reason": "군말입니다. 빼고 말해 보세요.", "fixed": "" },
        { "from": 8, "to": 11, "category": "expression", "reason": "모호한 표현", "fixed": "식당이 붐빕니다" }
      ],
      "final": [
        { "words": ["오늘은", "캠퍼스", "식당", "문제를", "이야기하려", "합니다"] },
        { "words": ["점심시간", "대기", "시간이", "평균", "20분입니다"] }
      ]
    }
  ],
  "charts": {
    "categoryRatio": { "panic": 25, "filler": 25, "repeat": 0, "expression": 33, "grammar": 0, "normal": 17 },
    "repeatTop": [],
    "fillerTop": [{ "word": "음", "count": 1 }, { "word": "어", "count": 1 }, { "word": "그러니까", "count": 1 }]
  },
  "analysis": {
    "score": 17,
    "stats": {
      "wpm": 122,
      "fillerCount": 3,
      "panicCount": 1,
      "panicTotalSec": 3.2,
      "repeatCount": 0,
      "expressionCount": 1,
      "grammarCount": 0
    },
    "summary": {
      "headline": "내용은 명확하지만 도입 직후 연결이 끊깁니다.",
      "topPriorities": ["주제 → 근거 연결 문장 준비", "'어/그러니까' 줄이기", "'~것 같아요' 대신 단정형"],
      "comment": "시험 발표에서는 첫 30초의 구조가 중요합니다. 도입 후 근거로 넘어가는 연결 문장을 미리 준비해 보세요."
    }
  }
}
```

## 5. `POST /api/retry` (application/json) — "다시, 말해" 재도전

총평 화면의 "다시, 말해"로 같은 설정에서 **전체를 다시 녹음**한 결과를 이전 결과와 비교한다.

```
이전 결과 보관 → 이전 최종 대본을 보며 다시 녹음 → [1] transcribe → 전사 오류 수정 → [3] retry → 전후 비교 + 재도전 총평
```

- analyze와 달리 **파트별 LLM을 부르지 않는다.** 패닉존·필러·중복은 코드가 찾고, LLM은 재도전 총평 1회만 부른다. 그래서 analyze보다 빠르다.
- 서버는 이전 결과를 저장하지 않으므로 프론트가 `previous`로 다시 보낸다.

### 요청

```ts
type RetryRequest = {
  // AnalyzeRequest와 같다: 새 녹음을 transcribe → 사용자가 고친 대본
  mode: "presentation" | "speaking";
  level?: "assignment" | "exam" | "keynote";
  exam?: "TOEIC-Speaking" | "opic";
  language: "ko" | "en";
  questions?: string[];
  parts: { duration: number; script: Line[] }[];

  // 이전 AnalyzeResponse에서 그대로 복사한다
  previous: {
    durationSec: number;                  // 이전 parts[].duration의 합
    stats: Analysis["stats"];             // 이전 analysis.stats
    categoryRatio: Charts["categoryRatio"];  // 이전 charts.categoryRatio
    topPriorities: string[];              // 이전 analysis.summary.topPriorities
    final: { words: string[] }[];         // 이전 parts[].final을 파트 순서대로 이어 붙인 것. 없으면 []
  };
};
```

- 새 녹음의 파일 개수가 이전과 달라도 된다 (비교는 전체 합산으로 한다).

### 응답 200

```ts
type RetryResponse = {
  mode: "presentation" | "speaking";
  level?: "assignment" | "exam" | "keynote";
  exam?: "TOEIC-Speaking" | "opic";
  language: "ko" | "en";
  parts: Part[];          // 새 녹음. 아래 "analyze와 다른 점" 참고
  charts: Charts;         // 새 녹음. expression·grammar는 항상 0
  analysis: Analysis;     // 새 녹음. score = compare.after.score
  compare: Compare;       // 전후 비교 (서버가 같은 기준으로 계산)
  retry?: Retry;          // 재도전 총평. LLM 실패 시 없음
  warnings?: string[];    // "llm_failed", "script_mismatch"
};

type Compare = {
  scriptMatch: number | null;  // 0~100. 이전 최종 대본 중 실제로 말한 비율. previous.final이 비었으면 null
  before: CompareStats;        // 이전 결과
  after: CompareStats;         // 새 녹음
};

type CompareStats = {
  score: number;          // 코드 기준 점수: 100 − (panic + filler + repeat 비율)
  durationSec: number;    // 녹음 길이 합 (초)
  wpm: number;
  fillerCount: number;
  panicCount: number;
  panicTotalSec: number;
  repeatCount: number;
  fillerPerMin: number;   // 녹음 1분당 횟수 (소수 첫째 자리)
  panicPerMin: number;
  repeatPerMin: number;
};

type Retry = {
  improved: string[];     // 개선된 점 1~3개
  remaining: string[];    // 아직 개선할 점 1~3개
  comment: string;        // 재도전 한 줄 총평
};
```

#### analyze와 다른 점

| 항목 | analyze | retry |
|---|---|---|
| `highlight` | panic·filler·repeat·expression·grammar | panic·filler·repeat만 |
| panic 하이라이트 | `reason`·`fixed`·`pauseSec` | `pauseSec`만 (원인·대안 없음) |
| `parts[].final` | 최종 대본 | 항상 `[]` (이전 결과의 최종 대본을 그대로 쓴다) |
| `parts[].comment` | 스피킹만 | 없음 |
| `analysis.summary` | 총평 LLM | `retry`로 채운다: `headline` = `retry.comment`, `topPriorities` = `retry.remaining`, `comment` = `""` |
| LLM 호출 | 파트 수 + 1회 | 재도전 총평 1회 |

- `analysis.summary`는 기존 스크립트·총평 컴포넌트가 깨지지 않도록 채워 두는 것이다. 재도전 화면은 `compare`와 `retry`를 보여 준다.

### 규칙
- **점수 비교**: 이전 `analysis.score`는 표현 개선(`expression`)·문법(`grammar`)까지 감점한 값이라 그대로 비교하면 재도전 점수가 부풀려진다. 그래서 양쪽 모두 패닉·필러·중복만 반영한 점수로 비교한다. 우선순위가 panic > filler > repeat > expression > grammar라서 앞의 세 비율은 expression 유무와 상관없이 같다.
  - `before.score` = `previous.categoryRatio`의 `normal + expression + grammar`
  - `after.score` = 새 녹음의 `100 − (panic + filler + repeat)` (= 새 `charts.categoryRatio.normal`)
- **길이 보정**: 다시 녹음하면 길이가 달라지므로 필러·패닉·중복은 `*PerMin`(녹음 1분당 횟수 = 횟수 ÷ `durationSec` × 60)으로 비교하는 것을 권한다. 횟수는 보조로 쓴다. `before`의 횟수·`wpm`·`panicTotalSec`은 `previous.stats` 값 그대로다.
- **대본 일치율(`scriptMatch`)**: 새 녹음이 이전 최종 대본을 얼마나 따라갔는지를 코드로 잰다 (LLM 없음).
  - 양쪽 모두 모든 파트·문장을 이어 붙이고 공백·문장부호를 지운 뒤(영어는 소문자로), 두 글자 단위(bigram)로 나눈다.
  - `scriptMatch` = 이전 최종 대본의 bigram 중 새 녹음에도 있는 것의 비율(같은 bigram은 나온 횟수만큼만 센다) × 100, 정수 반올림.
  - 기준이 이전 대본 쪽이라 일부만 읽으면 낮게 나온다.
  - `scriptMatch`가 `RETRY_MATCH_LOW`(서버 `config.ts`, 기본 40) 미만이면 `warnings`에 `"script_mismatch"`를 붙인다. 결과는 그대로 돌려준다 (녹음을 거절하지 않는다). 프론트는 "이전과 내용이 많이 달라 비교는 참고용이에요" 같은 안내를 둔다.
- **재도전 총평 LLM 입력**: `compare` 전체, `previous.topPriorities`, 새 녹음의 패닉존 문맥(pause 직전 문장 + 정지 시간), 새 `fillerTop`·`repeatTop`. `script_mismatch`면 "대본을 따라서" 같은 표현을 쓰지 않도록 지시한다.

### 예시 (발표, 위 analyze 예시 결과로 재도전)

요청:

```json
{
  "mode": "presentation",
  "level": "exam",
  "language": "ko",
  "parts": [
    {
      "duration": 7.0,
      "script": [
        { "start": 0.3, "end": 3.0, "offset": 0, "words": ["오늘은", "캠퍼스", "식당", "문제를", "이야기하려", "합니다"],
          "wordTimes": [[0.3, 0.7], [0.8, 1.2], [1.3, 1.6], [1.7, 2.1], [2.2, 2.7], [2.75, 3.0]] },
        { "start": 3.3, "end": 6.6, "offset": 6, "words": ["음", "점심시간", "대기", "시간이", "평균", "20분입니다"],
          "wordTimes": [[3.3, 3.6], [3.8, 4.4], [4.5, 4.8], [4.9, 5.3], [5.4, 5.8], [5.9, 6.6]] }
      ]
    }
  ],
  "previous": {
    "durationSec": 14.2,
    "stats": { "wpm": 122, "fillerCount": 3, "panicCount": 1, "panicTotalSec": 3.2, "repeatCount": 0, "expressionCount": 1, "grammarCount": 0 },
    "categoryRatio": { "panic": 25, "filler": 25, "repeat": 0, "expression": 33, "grammar": 0, "normal": 17 },
    "topPriorities": ["주제 → 근거 연결 문장 준비", "'어/그러니까' 줄이기", "'~것 같아요' 대신 단정형"],
    "final": [
      { "words": ["오늘은", "캠퍼스", "식당", "문제를", "이야기하려", "합니다"] },
      { "words": ["점심시간", "대기", "시간이", "평균", "20분입니다"] }
    ]
  }
}
```

응답:

```json
{
  "mode": "presentation",
  "level": "exam",
  "language": "ko",
  "parts": [
    {
      "duration": 7.0,
      "script": [
        { "start": 0.3, "end": 3.0, "offset": 0, "words": ["오늘은", "캠퍼스", "식당", "문제를", "이야기하려", "합니다"],
          "wordTimes": [[0.3, 0.7], [0.8, 1.2], [1.3, 1.6], [1.7, 2.1], [2.2, 2.7], [2.75, 3.0]] },
        { "start": 3.3, "end": 6.6, "offset": 6, "words": ["음", "점심시간", "대기", "시간이", "평균", "20분입니다"],
          "wordTimes": [[3.3, 3.6], [3.8, 4.4], [4.5, 4.8], [4.9, 5.3], [5.4, 5.8], [5.9, 6.6]] }
      ],
      "highlight": [
        { "from": 6, "to": 6, "category": "filler", "reason": "군말입니다. 빼고 말해 보세요.", "fixed": "" }
      ],
      "final": []
    }
  ],
  "charts": {
    "categoryRatio": { "panic": 0, "filler": 8, "repeat": 0, "expression": 0, "grammar": 0, "normal": 92 },
    "repeatTop": [],
    "fillerTop": [{ "word": "음", "count": 1 }]
  },
  "analysis": {
    "score": 92,
    "stats": { "wpm": 120, "fillerCount": 1, "panicCount": 0, "panicTotalSec": 0, "repeatCount": 0, "expressionCount": 0, "grammarCount": 0 },
    "summary": {
      "headline": "연결 문장을 준비해 오니 도입 직후 막힘이 사라졌어요.",
      "topPriorities": ["두 번째 문장 앞 '음' 없애기"],
      "comment": ""
    }
  },
  "compare": {
    "scriptMatch": 97,
    "before": { "score": 50, "durationSec": 14.2, "wpm": 122, "fillerCount": 3, "panicCount": 1, "panicTotalSec": 3.2, "repeatCount": 0, "fillerPerMin": 12.7, "panicPerMin": 4.2, "repeatPerMin": 0 },
    "after":  { "score": 92, "durationSec": 7.0, "wpm": 120, "fillerCount": 1, "panicCount": 0, "panicTotalSec": 0, "repeatCount": 0, "fillerPerMin": 8.6, "panicPerMin": 0, "repeatPerMin": 0 }
  },
  "retry": {
    "improved": ["패닉존이 1번(3.2초)에서 0번으로 사라졌어요", "군말이 분당 12.7회에서 8.6회로 줄었어요"],
    "remaining": ["두 번째 문장 앞 '음' 없애기"],
    "comment": "연결 문장을 준비해 오니 도입 직후 막힘이 사라졌어요."
  }
}
```

## 6. 공통 규칙

### `questions` (스피킹)
- transcribe(multipart)에서는 `JSON.stringify(questions)` 문자열, analyze·retry(JSON)에서는 배열 그대로 보낸다. `questions[i]`의 답이 `audio[i]`(= `parts[i]`)이고 개수가 같아야 한다.
- 오픽은 질문 문장 그대로다.
  ```json
  ["Please introduce yourself in as much detail as possible.", "Tell me about the place where you live. What does it look like, and what do you like about it?"]
  ```
- 토익 스피킹은 파트 이름과 화면에만 있는 정보(지문, 사진 설명, 일정표)를 글로 풀어서 한 문자열에 넣는다 (일부만 표시).
  ```json
  [
    "TOEIC Speaking Part 1 (지문 읽기)\nText to read aloud: Attention, students. ...",
    "TOEIC Speaking Part 2 (사진 묘사하기)\nPicture: a campus cafeteria. ...\nQuestion: Describe the picture in as much detail as you can.",
    "TOEIC Speaking Part 3 (질문에 답하기)\nSituation: ...\nQuestion: ...",
    "TOEIC Speaking Part 4 (정보 보고 답하기)\nInformation: Campus Career Fair — ...\nQuestion: ...",
    "TOEIC Speaking Part 5 (의견 제시하기)\nQuestion: Do you agree or disagree with ..."
  ]
  ```
- 서버는 질문 문자열을 그대로 LLM에 전달한다. 사진 설명과 정보표가 글로 들어 있어서 LLM이 내용의 정확성까지 판단할 수 있다.

### 검증
- `mode`와 `language` 조합: 발표는 `ko`·`en`, 스피킹은 `en`만 허용한다.
- `level`은 발표에서, `exam`·`questions`는 스피킹에서 필수. 스피킹은 `questions` 개수 = 녹음(파트) 개수.
- retry는 위 규칙에 더해 `previous`가 필수다. `previous.final`은 빈 배열이어도 된다.

### 길이 제한 (서버는 +5초 여유로 검증)

| 대상 | 서버 상한 |
|---|---|
| 발표 | 파일당 5분, 최대 5개 (합계 최대 25분) |
| 오픽 | 답변당 2분 |
| 토익 스피킹 | 답변당 60초 (가장 긴 문항 기준) |

토익은 파트마다 답변 시간이 다르지만 요청에 파트 번호 필드가 없어서 서버는 위 상한만 확인한다. 정확한 파트별 시간 제한은 프론트 녹음 타이머가 담당한다.

### 처리 흐름

```
transcribe: 검증 → 녹음마다 병렬 STT(whisper) → 문장 단위 분할 + pause 줄
analyze:    검증 → 파트별 코드 분석(패닉존, 필러, 중복) → 파트별 LLM 병렬(패닉 원인, 표현 개선, 문법, 최종 대본)
            → 총평 LLM 1회 → 합산
retry:      검증 → 파트별 코드 분석(패닉존, 필러, 중복) → 합산 + 전후 비교·대본 일치율 → 재도전 총평 LLM 1회
```

- 파트는 서로 독립이다. 파일 사이를 이어 붙이지 않으므로 가짜 패닉존이 생기지 않는다.
- 발표는 `level` 값을, 스피킹은 해당 파트의 질문 문자열과 `exam`을 LLM 프롬프트에 함께 전달한다.
- 토익 Part 1(지문 읽기)은 최종 대본을 만들지 않는다. LLM이 질문 문자열의 파트 이름을 보고 `final`을 빈 배열로 돌려준다.

## 7. 에러

`{ "error": "메시지" }` + 상태 코드

| 상황 | 코드 |
|---|---|
| 요청 조합이 틀림 (모드·언어·level·exam 불일치, 질문·녹음 개수 불일치), 길이·개수·형식 초과, 잘못된 JSON | 400 |
| whisper가 읽을 수 없는 오디오 형식 (transcribe) | 400 |
| 음성이 감지되지 않음 (transcribe, 몇 번째 녹음인지 포함) | 422 |
| STT 실패 (transcribe, 1회 재시도 후, 몇 번째인지 포함) | 502 |
| LLM 실패 (analyze) | 200. `final`은 빈 배열, `summary`는 빈 문자열·빈 배열로 내려가고 `warnings: ["llm_failed"]`가 붙는다 |
| LLM 실패 (retry) | 200. `retry`가 없고 `summary`는 빈 문자열·빈 배열, `warnings: ["llm_failed"]`. `compare`는 그대로 온다 |

## 확인이 필요한 항목

- 토익 스피킹의 파트별 시간 검증을 서버가 할지 (질문 문자열의 `Part N` 표기를 읽는 방식). 지금은 서버 상한 60초 + 프론트 타이머.
- 점수가 정상 단어 비율만으로 충분한지 (패닉 길이, 속도 반영 여부는 샘플을 본 뒤 판단).
- retry의 `RETRY_MATCH_LOW`(기본 40)가 적절한지 (대본을 보고 읽은 샘플과 즉흥 샘플을 녹음해 본 뒤 조정).
