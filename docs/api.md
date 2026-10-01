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

| 엔드포인트 | 용도 |
|---|---|
| `POST /api/analyze` | 녹음 1~5개 분석 (발표·스피킹 공용) |

질문은 프론트가 가지고 있으므로 질문 생성 API는 없다. 하이라이트 클릭 시 보여 줄 이유와 개선 표현, 최종 대본은 `analyze` 응답에 이미 들어 있다.

## 3. 요청 (`POST /api/analyze`, multipart/form-data)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `mode` | `"presentation"` \| `"speaking"` | O | 발표 / 어학 스피킹 |
| `language` | `"ko"` \| `"en"` | O | 발표는 `ko` 또는 `en`, 스피킹은 `en` |
| `audio` | File[] (1~5개) | O | 보낸 순서대로. 발표는 5분 단위로 나눈 파일, 스피킹은 질문별 답변 |
| `level` | `"assignment"` \| `"exam"` \| `"keynote"` | 발표만 | 발표 성격 |
| `exam` | `"TOEIC-Speaking"` \| `"opic"` | 스피킹만 | 시험 종류 |
| `questions` | string (JSON 배열) | 스피킹만 | 질문 문자열 배열. `audio`와 같은 순서·같은 개수 |

### 요청 예시
- 발표: `audio=part1-recording.webm`, `mode=presentation`, `language=ko`, `level=exam`
- 스피킹: `mode=speaking`, `language=en`, `exam=opic`, `questions=[…]`, `audio=q1-recording.webm`

### 오디오 파일
- `audio`는 같은 필드 이름으로 여러 번 붙인다. 파일 이름은 `part1-recording.webm`, `part2-recording.webm`… (발표), `q1-recording.webm`, `q2-recording.webm`… (스피킹)이고 Safari는 `.mp4`다.
- 서버는 파일 이름이 아니라 **붙인 순서**를 파트 순서로 쓴다. webm과 mp4를 모두 허용한다.

### `questions`
- 프론트가 `JSON.stringify(questions)`로 보낸다. 서버는 `JSON.parse(req.body.questions)`로 꺼내 `string[]`로 쓴다. `questions[i]`의 답이 `audio[i]`이고 두 배열의 길이는 같아야 한다.
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
- `level`은 발표에서, `exam`·`questions`는 스피킹에서 필수. 스피킹은 `questions` 개수 = `audio` 개수.
- 오디오는 webm·mp4만 허용한다.
- 정해진 필드(`audio` 외 파일)가 오면 400이다. 발표 자료(PDF)는 받지 않으므로 `material`을 보내면 안 된다.

### 길이 제한 (서버는 +5초 여유로 검증)

| 대상 | 서버 상한 |
|---|---|
| 발표 | 파일당 5분, 최대 5개 (합계 최대 25분) |
| 오픽 | 답변당 2분 |
| 토익 스피킹 | 답변당 60초 (가장 긴 문항 기준) |

토익은 파트마다 답변 시간이 다르지만(읽기 45초 · 사진 묘사 30초 · 질문 답하기 15~30초 · 정보 보고 답하기 15~30초 · 의견 60초) 요청에 파트 번호 필드가 없어서 서버는 파트별 검증을 하지 않고 위 상한만 확인한다. 정확한 파트별 시간 제한은 프론트 녹음 타이머가 담당한다.

## 4. 처리 흐름

```
검증 → 녹음마다 병렬 STT(whisper) → 파트별 코드 분석(줄 분할, 필러, 중복)
     → 파트별 LLM 병렬(하이라이트, 최종 대본) → 총평 LLM 1회 → 합산 → 응답
```

- 파트는 서로 독립이다. 파일 사이를 이어 붙이지 않으므로 가짜 패닉존이 생기지 않는다.
- 파트별 LLM: 패닉 원인(`panic`), 표현 개선(`expression`), 문법(`grammar`, 스피킹만), 최종 대본.
  - 발표는 `level` 값을 LLM 프롬프트에 함께 전달한다. 서버 코드에서 `level`로 분기하지 않는다.
  - 스피킹은 해당 파트의 질문 문자열과 `exam`을 함께 넘긴다.
- 총평 LLM: 파트별 요약본만 받아 `summary`를 쓴다 (원문 전체를 다시 넣지 않는다).
- 필러·중복은 코드가 찾고, `reason`/`fixed`도 코드가 채운다.
- 토익 Part 1(지문 읽기)은 지문을 그대로 읽는 문제라 최종 대본을 만들지 않는다. LLM이 질문 문자열의 파트 이름을 보고 `final`을 빈 배열로 돌려준다. 지문과 전사의 비교는 일반 분석(하이라이트·총평)에 이미 포함된다.

## 5. 응답 200

```ts
type AnalyzeResponse = {
  mode: "presentation" | "speaking";
  level?: "assignment" | "exam" | "keynote";   // 발표
  exam?: "TOEIC-Speaking" | "opic";            // 스피킹
  language: "ko" | "en";
  parts: Part[];          // 녹음 파일 하나당 하나, audio 순서와 같다
  charts: Charts;         // 모든 파트 합산
  analysis: Analysis;     // 모든 파트 합산, 하나
  warnings?: string[];    // 예: ["llm_failed"]
};

type Part = {
  comment?: string;       // 파트별 한 줄 코멘트 (질문 적합성 등). 스피킹에만 있다
  duration: number;       // 초
  script: Line[];
  highlight: Highlight[];
  final: { words: string[] }[];   // 문장 단위 최종 대본. 빈 배열이면 없음 (토익 Part 1)
};

type Line = {
  start: number;          // 초
  end: number;
  words: string[];        // pause 줄은 빈 배열
  pause?: boolean;        // true면 패닉존 (길이 = end - start)
};

type Highlight = {
  from: number;           // 파트 안의 전체 단어 번호 (pause 줄 제외, 0부터)
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
  score: number;          // 0~100. charts.categoryRatio.normal을 반올림한 값
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

- 응답에는 질문 문자열을 다시 담지 않는다 (`parts[i]`는 요청의 `questions[i]`에 대응). 토익 질문은 지문 전체가 들어 있어 길고, 프론트가 이미 가지고 있기 때문이다.

### 규칙
- 하이라이트는 단어 번호 범위라서 줄을 넘는 문장·구·절도 표시할 수 있다. 겹치는 구간은 그대로 두고, 색 우선순위(빨강 > 노랑 > 보라 > 파랑 > 초록)는 프론트가 적용한다.
- `panic` 하이라이트는 pause 줄 **직전** 단어 구간에 붙는다. 이유와 대안 대본(`fixed`)을 담는다.
- `categoryRatio`는 단어 기준 비율이다. 한 단어가 여러 카테고리에 걸리면 우선순위가 높은 하나만 세고, 6개 합은 100이다. 발표 모드에서 `grammar`는 항상 0이다.
- `repeatTop`·`fillerTop`은 전체 파트의 합산이다. 중복 단어는 파트 안에서 5줄 윈도우에서 같은 어간 3회 이상일 때 표시한다.
- 점수(`score`)는 정상 단어 비율(`categoryRatio.normal`)을 반올림한 값이다. 점수가 높을수록 하이라이트에 걸리지 않은 단어가 많다.
- `stats`는 모든 파트의 합산이다. `wpm` = 전체 단어 수 ÷ 발화 시간(분, 앞뒤·중간 침묵 제외, 필러 포함). `fillerCount` = 필러 단어 수. `panicCount` = panic 하이라이트 수, `panicTotalSec` = `pauseSec`의 합. `repeatCount`·`expressionCount`·`grammarCount` = 해당 category의 하이라이트 수. 발표 모드에서 `grammarCount`는 0이다.
- `summary.comment`는 총평 LLM이 쓰는 전체 코멘트이고, `parts[].comment`는 파트별 코멘트(스피킹만)다.
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
        { "start": 0.3, "end": 2.9, "words": ["오늘은", "음", "캠퍼스", "식당", "문제를"] },
        { "start": 2.9, "end": 6.1, "words": [], "pause": true },
        { "start": 6.1, "end": 9.4, "words": ["어", "그러니까", "식당이", "약간", "붐비는", "것", "같아요"] }
      ],
      "highlight": [
        { "from": 1, "to": 1, "category": "filler", "reason": "군말입니다", "fixed": "" },
        { "from": 0, "to": 4, "category": "panic", "pauseSec": 3.2, "reason": "주제를 꺼낸 직후 근거로 넘어가는 연결 문장이 준비되지 않았습니다.", "fixed": "오늘은 캠퍼스 식당 문제를 이야기하려 합니다. 점심시간 대기 시간이 평균 20분입니다." },
        { "from": 8, "to": 11, "category": "expression", "reason": "모호한 표현", "fixed": "식당이 붐빕니다" }
      ],
      "final": [
        { "words": ["오늘은", "캠퍼스", "식당", "문제를", "이야기하려", "합니다"] },
        { "words": ["점심시간", "대기", "시간이", "평균", "20분입니다"] }
      ]
    }
  ],
  "charts": {
    "categoryRatio": { "panic": 8, "filler": 8, "repeat": 0, "expression": 12, "grammar": 0, "normal": 72 },
    "repeatTop": [],
    "fillerTop": [{ "word": "음", "count": 1 }, { "word": "어", "count": 1 }]
  },
  "analysis": {
    "score": 72,
    "stats": {
      "wpm": 92,
      "fillerCount": 2,
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

(위 예시의 `from`/`to` 숫자는 설명용이며 실제 단어 번호와 정확히 일치하지 않을 수 있다.)

## 6. 에러

`{ "error": "메시지" }` + 상태 코드

| 상황 | 코드 |
|---|---|
| 요청 조합이 틀림 (모드·언어·level·exam 불일치, `questions`·`audio` 개수 불일치), 길이·개수·형식 초과 | 400 |
| 음성이 감지되지 않음 (몇 번째 녹음인지 포함) | 422 |
| STT 실패 (1회 재시도 후, 몇 번째인지 포함) | 502 |
| LLM 실패 | 200. `final`은 빈 배열, `summary`는 빈 문자열·빈 배열로 내려가고 `warnings: ["llm_failed"]`가 붙는다 |

## 확인이 필요한 항목

- 토익 스피킹의 파트별 시간 검증을 서버가 할지 (질문 문자열의 `Part N` 표기를 읽는 방식). 지금은 서버 상한 60초 + 프론트 타이머.
- whisper가 "음/어"를 실제로 받아 적는지 실측 (필러 탐지의 전제).
- 점수가 정상 단어 비율만으로 충분한지 (패닉 길이, 속도 반영 여부는 샘플을 본 뒤 판단).
