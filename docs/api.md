# API 계약 (주인: 윤화영)

> 변경 시 PR 설명 첫 줄에 `[API 변경]`을 적고 팀에 알린다.
> 프론트는 아래 예시 JSON을 `frontend/src/mocks/`에 복사해 서버 없이 개발한다.

Base URL: `http://localhost:8080/api`

## 1. 모드와 입력

| | 발표 (`presentation`) | 어학 스피킹 (`speaking`) | 면접 (`interview`) |
|---|---|---|---|
| 언어 | `ko` 또는 `en` | `en` 고정 | `ko` 또는 `en` (질문·답변 언어) |
| 세부 | `level`: `assignment` \| `exam` \| `keynote` | `exam`: `TOEIC-Speaking` \| `opic` | - (지원 직무는 `questions` 문자열 안에) |
| 녹음 | 5분 단위로 나눈 파일, 1~5개 | 질문별 답변 파일, 1~5개 | 질문별 답변 파일, 1~5개 (보통 5개) |
| 추가 입력 | 예상 질문 답변이면 `questions` (`Presentation Q&A N`) | `questions` (질문 문자열 배열) | `questions` (질문 문자열 배열) |

- 파일 하나가 결과의 `parts` 하나가 된다. `audio`를 보낸 순서 = `parts` 순서.
- `level`은 발표의 성격이다: 과제 발표(`assignment`), 시험 발표(`exam`), 큰 강연(`keynote`).
- 스피킹·면접 질문은 `POST /api/questions`(6절)로 서버가 LLM으로 만든다 (면접은 지원 직무에 맞춰). 그 뒤 흐름(질문별 녹음 → transcribe → 검토 → analyze)은 같다.
- 결과 화면에서 버튼을 누르면 모든 모드에서 꼬리질문을 최대 3개 받을 수 있다 (6절).
- **발표 예상 질문 답변**은 `mode: "presentation"` + `level` + `questions`로 보낸다(질문마다 답변 파일 하나). `questions`가 있으면 서버는 발표 본편이 아니라 **발표 질의응답**으로 평가한다: 질문의 핵심에 먼저 답했는지, 발표 내용·근거로 뒷받침했는지, 모르면 인정했는지, 간결한지. `parts[i].comment`(질문별 한 줄, 면접 표현 없음), `accuracy`·`scoreDetail`(정확성 비중 0.7)이 붙고, 응답 `mode`는 `"presentation"` 그대로다.

## 2. API 목록

| 순서 | 엔드포인트 | 요청 | 응답 |
|---|---|---|---|
| 0 | `POST /api/questions` | JSON: `kind`(처음 질문 / 꼬리질문) + 모드 정보 | 질문 목록 (`QuestionsResponse`) |
| 0-1 | `POST /api/questions/image` | JSON: 토익 Part 2 장면 설명 | 사진 1장 (data URL) |
| 1 | `POST /api/transcribe` | multipart: 녹음 파일 + 모드 정보 | 파트별 문장 단위 대본 (`TranscribeResponse`) |
| 2 | `POST /api/analyze` | JSON: 모드 정보 + 사용자가 고친 대본 | 분석 결과 (`AnalyzeResponse`) |
| 3 | `POST /api/retry` | JSON: 2와 같음 + 이전 결과 요약(`previous`) | 재도전 결과 + 전후 비교 (`RetryResponse`) |

```
(스피킹·면접) [0] questions(initial) → 질문마다 답변 녹음 ↓   (토익은 [0-1] questions/image를 뒤에서 함께)
녹음 → [1] transcribe → 대본을 사용자에게 보여 주고 전사 오류 수정 → [2] analyze → 대본 하이라이트·총평 화면
재도전 → [1] transcribe → 전사 오류 수정 → [3] retry → 전후 비교·재도전 총평
결과 화면 → (버튼) [0] questions(followUp) → 꼬리질문 1~3개 (스피킹·면접은 그 질문으로 다시 연습)
```

- 서버는 아무것도 저장하지 않는다. 그래서 2단계 요청에 1단계 응답의 `parts`를 다시 보낸다 (녹음 파일은 다시 보내지 않는다).
- 사용자가 고칠 수 있는 것은 **문장 안의 `words`뿐**이다. `start`·`end`·`wordTimes`·pause 줄은 받은 그대로 돌려보낸다.
- 수정 화면에는 "전사가 틀린 부분만 고쳐 주세요. 음·어 같은 말버릇은 지우지 마세요" 같은 안내를 둔다. 지우면 분석에서 빠진다.
- 스피킹·면접 질문은 서버가 만든다 ([0]). 프론트는 응답의 `prompt`를 그대로 `questions`로 보낸다.

## 3. `POST /api/transcribe` (multipart/form-data)

### 요청

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `mode` | `"presentation"` \| `"speaking"` \| `"interview"` | O | 발표 / 어학 스피킹 / 면접 |
| `language` | `"ko"` \| `"en"` | O | 발표·면접은 `ko` 또는 `en`, 스피킹은 `en` |
| `audio` | File[] (1~5개) | O | 보낸 순서대로. 발표는 5분 단위로 나눈 파일, 스피킹·면접은 질문별 답변 |
| `level` | `"assignment"` \| `"exam"` \| `"keynote"` | 발표만 | 발표 성격 |
| `exam` | `"TOEIC-Speaking"` \| `"opic"` | 스피킹만 | 시험 종류 |
| `questions` | string (JSON 배열) | 스피킹·면접 (발표는 예상 질문 답변일 때만) | 질문 문자열 배열. `audio`와 같은 순서·같은 개수 |

- 예시 — 발표: `audio=part1-recording.webm`, `mode=presentation`, `language=ko`, `level=exam` / 스피킹: `mode=speaking`, `language=en`, `exam=opic`, `questions=[…]`, `audio=q1-recording.webm` / 면접: `mode=interview`, `language=ko`, `questions=[…]`, `audio=q1-recording.webm` …
- `audio`는 같은 필드 이름으로 여러 번 붙인다. 서버는 파일 이름이 아니라 **붙인 순서**를 파트 순서로 쓴다. webm과 mp4(Safari)를 허용한다.
- 발표 자료(PDF)는 받지 않는다. `audio` 외의 파일 필드(예: `material`)가 오면 400이다.

### 응답 200

```ts
type TranscribeResponse = {
  mode: "presentation" | "speaking" | "interview";
  level?: "assignment" | "exam" | "keynote";
  exam?: "TOEIC-Speaking" | "opic";
  language: "ko" | "en";
  parts: { duration: number; script: Line[] }[];   // 녹음 파일 하나당 하나
};

// 대본의 한 줄 = 한 문장. 2초(스피킹 1.5초) 이상 정지는 pause 줄로 따로 들어간다.
type Line = {
  start: number;                   // 초. 해당 파트 녹음 파일의 처음을 0초로 잰 시간
  end: number;
  offset: number;                  // 이 줄 첫 단어의 파트 전체 단어 번호 (하이라이트 from/to 기준)
  words: string[];                 // pause 줄은 빈 배열
  wordTimes?: [number, number][];  // 단어별 [start, end]. 프론트는 받은 그대로 돌려보낸다
  pause?: boolean;                 // true면 패닉존 (길이 = end - start)
};
```

- 문장은 whisper의 문장 경계에서 끊고, 2초(스피킹은 1.5초) 이상 멈춘 곳에서는 문장 중간이라도 끊고 pause 줄을 넣는다.
- 스피킹·면접은 첫마디 전 침묵이 3초 이상이면 대본 **맨 앞**에도 pause 줄을 넣는다(`start` = 0, 질문을 듣고 말문이 막힌 것). 발표는 맨 앞 침묵을 무시한다. 녹음 맨 뒤 침묵은 모든 모드에서 무시한다.
- whisper 힌트: `questions[i]`가 있으면 그 질문의 `Question:`·`Job:`·`Situation:`·`Information:` 줄 내용을 군말 예시 앞에 넣어 고유명사·전문용어를 맞게 받아 적게 한다 (400자까지). 토익 Part 1 지문은 넣지 않는다: 잘못 읽은 부분까지 지문대로 받아 적으면 지문 읽기 정확성이 부풀려진다.
- whisper는 멈춘 시간을 앞뒤 단어에 붙이곤 해서(특히 영어에서 um을 지울 때), 1.5초보다 긴 단어는 1.5초로 잘라 멈춤을 잰다. 첫 단어나 문장 첫 단어는 앞쪽을, 그 외는 뒤쪽을 자른다. 잘린 시간이 `wordTimes`·`start`·`end`에 그대로 들어간다.
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
  mode: "presentation" | "speaking" | "interview";
  level?: "assignment" | "exam" | "keynote";   // 발표
  exam?: "TOEIC-Speaking" | "opic";            // 스피킹
  language: "ko" | "en";
  questions?: string[];                        // 스피킹·면접, 발표 예상 질문 답변. JSON 배열 그대로 (문자열로 바꾸지 않는다)
  parts: { duration: number; script: Line[] }[];  // transcribe 응답의 parts에서 words만 고쳐서 보낸다
};
```

- 위 transcribe 응답 예시에 `"parts"`의 `words`만 고친 것이 그대로 요청 예시다.
- 한 칸에 여러 단어를 적어도 된다 (`"AI 쓰는"`). 서버가 공백으로 다시 나누고 `offset`을 다시 계산한다.
- 단어 수가 바뀐 문장은 `wordTimes`가 맞지 않아 서버가 그 문장의 시간을 단어 수로 균등하게 나눠 추정한다. 고치지 않은 문장은 원래 시간을 쓴다.

### 응답 200

```ts
type AnalyzeResponse = {
  mode: "presentation" | "speaking" | "interview";
  level?: "assignment" | "exam" | "keynote";
  exam?: "TOEIC-Speaking" | "opic";
  language: "ko" | "en";
  parts: Part[];          // 요청 parts와 같은 순서
  charts: Charts;         // 모든 파트 합산
  analysis: Analysis;     // 모든 파트 합산, 하나
  warnings?: string[];    // 예: ["llm_failed"]
};

type Part = {
  comment?: string;       // 파트별 한 줄 코멘트 (질문 적합성 등). 스피킹·면접·발표 예상 질문 답변에만 있다
  accuracy?: number;      // 스피킹·면접·발표 예상 질문 답변만: 답변 정확성 0~100 (LLM). 이 파트의 LLM이 실패하면 없음
  duration: number;       // 초
  script: Line[];         // 고친 대본 (offset 다시 계산됨)
  highlight: Highlight[];
  final: { words: string[] }[];   // 문장 단위 최종 대본(면접은 모범 답안). 빈 배열이면 없음 (토익 Part 1)
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
  score: number;          // 0~100. scoreDetail이 있으면 round(habit^(1−w) × accuracy^w), 없으면 habit (아래 규칙)
  scoreDetail?: {         // 스피킹·면접·발표 예상 질문 답변만. 발표 본편은 없음
    habit: number;        // 말하기 습관 점수 = 100 − (panic + filler + repeat 비율)
    accuracy: number;     // 파트별 accuracy의 평균(반올림)
    accuracyWeight: number; // w = 정확성 비중. 스피킹 0.5, 면접·발표 예상 질문 답변 0.7
  };
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
- `expression`·`grammar` 하이라이트의 `fixed`는 **고친 완성 대본(`final`)에 글자 그대로 들어 있는 구절**이다. LLM이 `final`과 다른 표현을 주면 서버가 그 하이라이트를 버린다 (공백·문장부호·대소문자는 무시하고 비교, `final`이 비었으면 검사하지 않음). 그래서 대본 화면의 고친 표현과 "고친 완성 대본" 탭이 항상 같다.
- `panic` 하이라이트는 pause 줄 직전 문장의 **마지막 3단어**에 붙는다. 맨 앞 pause 줄(첫마디 전 침묵)은 바로 뒤 문장의 **처음 3단어**에 붙는다. 이유와 대안 대본(`fixed`)은 LLM이 채운다 (맨 앞이면 바로 꺼낼 수 있는 첫 문장).
- 필러는 코드가 찾는다. 확실한 군말(어, 음, um, uh)은 항상, 애매한 말(그, 이제, 그러니까, like, so)은 바로 뒤에 멈칫했거나 다른 필러 바로 뒤일 때만 필러로 본다.
- 중복 단어(`repeat`)도 코드가 찾는다. ① 같은 말(1~3단어)을 바로 반복("하지만 하지만", "every day every day", "정말 정말 정말")하면 반복된 범위를 묶고 `fixed`에 한 번만 쓴 표현을 넣는다. ② 5문장 안에서 같은 어간(조사를 뗀 형태)이 3번 이상이면 각 단어를 표시한다. ①로 묶인 말은 한 번만 센다("school school"은 school 1번). 이어지는 표시(서로 5문장 안)는 한 묶음이고, 묶음의 모든 단어 `reason`에 같은 횟수(= 그 묶음의 하이라이트 수)가 들어간다. 필러와 흔한 말("저는", "있습니다", "the" 등)은 제외한다. `repeatTop`은 어간 기준으로 센다.
- `categoryRatio`는 단어 기준 비율이다. 한 단어가 여러 카테고리에 걸리면 우선순위가 높은 하나만 세고, 6개 합은 100이다. `grammar`는 스피킹과 영어 면접(`interview` + `en`)에서만 나오고, 발표와 한국어 면접에서는 항상 0이다.
- `repeatTop`·`fillerTop`은 전체 파트의 합산이다(최대 10개).
- **점수(`score`)** = 100 − (`categoryRatio`의 panic + filler + repeat). 코드가 찾는 말하기 습관(패닉존·군말·반복)만 반영한다. 표현 개선·문법은 LLM이 정해서 실행마다 달라질 수 있으므로 감점하지 않고 하이라이트·비율로만 보여 준다. 그래서 같은 대본이면 점수는 항상 같다.
  - **질문에 답하는 모드는 답변 정확성을 섞는다** (가중 기하평균): `score` = round(`habit`^(1−w) × `accuracy`^w). 평균과 달리 한쪽이 무너지면 크게 깎인다. 질문과 상관없는 답은 말하기 습관이 깨끗해도 점수가 낮다.

    | 범위 | w (`accuracyWeight`) | 이유 | 습관 100 · 정확성 10 | 습관 80 · 정확성 80 | 습관 90 · 정확성 60 |
    |---|---|---|---|---|---|
    | 스피킹 (토익·오픽) | 0.5 (= √(습관 × 정확성)) | 시험은 유창성과 내용이 같은 비중 | 32 | 80 | 73 |
    | 면접, 발표 예상 질문 답변 | 0.7 | 질문에 맞는 내용이 더 중요 | 20 | 80 | 68 |
    | 발표 본편 (questions 없음) | 없음 (습관 점수만) | 질문이 없어 정답 기준이 없음 | 100 | 80 | 90 |

  - 파트 `accuracy`는 LLM이 범위별 기준으로 매긴다. 스피킹은 시험 채점 기준(질문에 맞게 답했는지, 이유·예시로 전개했는지, 문법·어휘), 면접은 면접 평가 기준(질문 의도·두괄식·STAR·구체성·직무), 발표 예상 질문 답변은 질의응답 기준(실제로 답했는지·근거·모르면 인정·간결함)이다. **토익 Part 1(지문 읽기)은 LLM이 아니라 코드가 잰다**: 질문 문자열의 `Text to read aloud:` 지문과 읽은 대본의 일치율(재도전 `scriptMatch`와 같은 두 글자 비교, 0~100). 그래서 Part 1 정확성은 같은 대본이면 항상 같고, LLM이 실패해도 나온다. LLM 채점 공통 눈금: 질문과 상관없으면 30점 이하, 답했지만 아쉬우면 60~80점, 모범 답변에 가까우면 90점 이상. 말하기 습관은 `accuracy`에 넣지 않는다.
  - 정확성은 LLM 점수라 같은 대본이어도 실행마다 조금 달라질 수 있다. 모든 파트의 LLM이 실패하면 `scoreDetail` 없이 `score` = 습관 점수다.
  - **프론트 표시**: 총평 점수 아래에 산출 방식을 한 줄로 밝힌다. `scoreDetail`이 있으면 습관·정확성 점수와 비중(예: "말하기 습관 90점 · 답변 정확성 60점, 정확성 비중 70%로 계산 — 한쪽이 낮으면 크게 깎여요"), 없으면 "패닉존·군말·반복 기준".
  - `categoryRatio.normal`(정상 비율)은 다섯 항목을 모두 뺀 값이라 점수와 다를 수 있다 (점수 ≥ 정상 비율). 화면에서 점수 옆에 "패닉존·군말·반복 기준"이라고 밝혀 둔다.
- `stats`는 모든 파트의 합산이다. `wpm` = 전체 단어 수 ÷ 발화 시간(분, pause 줄과 문장 사이 간격 제외, 필러 포함). `fillerCount`·`panicCount`·`repeatCount`·`expressionCount`·`grammarCount` = 해당 category의 하이라이트 수. `panicTotalSec` = `pauseSec`의 합.
- `summary.comment`는 총평 LLM이 쓰는 전체 코멘트이고, `parts[].comment`는 파트별 코멘트(스피킹·면접만)다.
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
    "score": 50,
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
  mode: "presentation" | "speaking" | "interview";
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
    accuracy?: number;                    // 이전 analysis.scoreDetail.accuracy (있을 때만). 보내면 정확성까지 비교한다
  };
};
```

- 새 녹음의 파일 개수가 이전과 달라도 된다 (비교는 전체 합산으로 한다).
- 면접도 재도전할 수 있다. 같은 질문(`questions`)으로 다시 답하고, 면접의 `previous.final`은 이전 모범 답안이다.

### 응답 200

```ts
type RetryResponse = {
  mode: "presentation" | "speaking" | "interview";
  level?: "assignment" | "exam" | "keynote";
  exam?: "TOEIC-Speaking" | "opic";
  language: "ko" | "en";
  parts: Part[];          // 새 녹음. 아래 "analyze와 다른 점" 참고
  charts: Charts;         // 새 녹음. expression·grammar는 항상 0
  analysis: Analysis;     // 새 녹음. score = compare.after.score. 정확성까지 비교하면 scoreDetail도 있다
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
  score: number;          // habit·accuracy가 있으면 analyze와 같은 공식의 총점, 없으면 습관 점수(100 − panic − filler − repeat)
  habit?: number;         // 정확성까지 비교할 때만: 습관 점수
  accuracy?: number;      // 정확성까지 비교할 때만: before = previous.accuracy, after = 새로 채점한 파트별 평균
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
| `parts[].comment` | 스피킹·면접만 | 없음 |
| `analysis.summary` | 총평 LLM | `retry`로 채운다: `headline` = `retry.comment`, `topPriorities` = `retry.remaining`, `comment` = `""` |
| `parts[].accuracy` | 스피킹·면접·발표 질의응답 | `previous.accuracy`를 보냈을 때만 (정확성만 가볍게 채점) |
| LLM 호출 | 파트 수 + 1회 | 재도전 총평 1회 (+ 정확성 비교 시 파트 수만큼 가벼운 채점) |

- `analysis.summary`는 기존 스크립트·총평 컴포넌트가 깨지지 않도록 채워 두는 것이다. 재도전 화면은 `compare`와 `retry`를 보여 준다.

### 규칙
- **점수 비교**: 양쪽 모두 analyze와 같은 점수 기준(100 − panic − filler − repeat)이다. 그래서 `before.score`는 이전 총평 화면의 `analysis.score`와 같고, `after.score`는 이 응답의 `analysis.score`와 같다.
  - **정확성까지 비교 (스피킹·면접·발표 질의응답)**: 프론트가 `previous.accuracy`(= 이전 `analysis.scoreDetail.accuracy`)를 보내면, 서버가 새 녹음의 파트별 정확성만 가볍게 다시 매겨(토익 Part 1은 코드로) analyze와 같은 공식으로 양쪽 총점을 낸다. 이때 `before.score`는 이전 `analysis.score`와 같고, `before/after`에 `habit`·`accuracy`가 붙고, `analysis.scoreDetail`도 온다. 화면은 "점수"로 표시하고 습관·정확성을 나눠 보여 줄 수 있다.
  - `previous.accuracy`를 안 보내거나(예전 기록, 발표 본편) 정확성 채점이 모두 실패하면 양쪽 모두 **습관 점수**로 비교한다. 이때 스피킹·면접의 `before.score`는 이전 `scoreDetail.habit`과 같고, 화면에서 "말하기 습관 점수"로 표시한다.
  - `before.score`는 `previous.categoryRatio`로 다시 계산한다. 예전 기준(표현 개선·문법까지 감점)으로 저장된 기록을 보내도 같은 기준으로 비교된다. 우선순위가 panic > filler > repeat > expression > grammar라서 앞의 세 비율은 expression 유무와 상관없이 같다.
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

## 6. `POST /api/questions` (application/json) — 질문 생성 (처음 질문 · 꼬리질문)

모드별 질문을 LLM으로 만든다. 두 종류가 있다.

| `kind` | 언제 | 모드 | 개수 |
|---|---|---|---|
| `initial` (처음 질문) | 녹음 전, 질문 화면에 들어올 때 | 스피킹(토익·오픽), 면접 | 5개 |
| `followUp` (꼬리질문) | 결과 화면에서 **사용자가 버튼을 눌렀을 때만** | 발표, 스피킹, 면접 | 1~3개 (기본 3, 최대 3) |

- 발표는 처음 질문이 없다 (`initial` + `presentation`은 400).
- 꼬리질문은 모드마다 성격이 다르다.
  - 발표: 발표를 마친 뒤 **청중(학우·교수님 등 누구나)에게 받을 법한 예상 질문**과 답변 방향(`hint`)
  - 스피킹: 같은 시험 형식의 **추가 연습 질문** (토익은 그림·표가 필요 없는 Part 3·5 형식, 오픽은 같은 주제의 연관 질문)
  - 면접: 답변 내용을 파고드는 **꼬리질문** (어느 답변에서 나온 질문인지 `about`)
- 예전 `POST /api/interview/questions`는 이 API(`kind: "initial"`, `mode: "interview"`)로 대체되어 삭제했다.

### 요청

```ts
type QuestionsRequest = InitialQuestionsRequest | FollowUpQuestionsRequest;

// 처음 질문 (녹음 전)
type InitialQuestionsRequest =
  | { kind: "initial"; mode: "speaking"; language: "en"; exam: "TOEIC-Speaking" }
  | { kind: "initial"; mode: "speaking"; language: "en"; exam: "opic";
      opic: {
        topics: { id: string; label: string }[];  // 서베이에서 고른 주제 (1~3개)
        level: number;                            // 자가 평가 단계 1~6. 5 이상이면 롤플레이가 문제 해결형
      } }
  | { kind: "initial"; mode: "interview"; language: "ko" | "en"; job: string };  // job: 1~50자

// 꼬리질문 (결과 화면의 버튼)
type FollowUpQuestionsRequest = {
  kind: "followUp";
  mode: "presentation" | "speaking" | "interview";
  language: "ko" | "en";
  level?: "assignment" | "exam" | "keynote";   // 발표
  exam?: "TOEIC-Speaking" | "opic";            // 스피킹
  job?: string;                                // 면접 (처음 질문 응답의 job)
  count?: 1 | 2 | 3;                           // 받을 꼬리질문 개수. 기본 3
  answers: {                                   // 꼬리질문을 만들 재료: 원래 연습의 녹음(파트)마다 하나씩, 파트 순서대로 1~5개 (꼬리질문 개수와 무관)
    question?: string;                         // 그 파트의 questions[i] (발표는 없음)
    text: string;                              // 실제로 말한 대본: 분석 결과 parts[i].script의 words를 공백으로 이어 붙인 것
  }[];
  asked?: string[];                            // 이미 받은 꼬리질문 text (다시 받을 때 중복을 피한다)
};
```

- `answers[].text`는 모범 답안(`final`)이 아니라 **실제로 말한 대본**이다. 꼬리질문은 사용자가 한 말에서 나와야 한다.
- `answers[].text` 합계는 20,000자 이하.

### 응답 200

```ts
type QuestionsResponse = {
  kind: "initial" | "followUp";
  mode: "presentation" | "speaking" | "interview";
  language: "ko" | "en";
  exam?: "TOEIC-Speaking" | "opic";
  job?: string;              // 면접: 공백을 정리한 직무
  questions: Question[];
  warnings?: string[];       // "llm_failed"
};

type Question = {
  type: QuestionType;        // 아래 표
  text: string;              // 화면에 보여 주는(토익·오픽은 TTS로 읽어 주는) 질문 한 문장
  prompt: string;            // transcribe·analyze·retry의 questions[i]로 그대로 보내는 문자열 (7절 형식)

  // 토익 스피킹
  part?: 1 | 2 | 3 | 4 | 5;
  context?: string;          // Part 1 읽을 지문(이때 text는 "Read the text on the screen aloud."), Part 3 상황 설명
  picture?: {                // Part 2 사진 문제에만 있다. 사진은 POST /api/questions/image로 따로 받는다
    scene: string;           // 생성할 사진의 장면 설명 (영어). /api/questions/image에 그대로 보낸다
    prompt: string;          // 생성한 사진으로 출제했을 때 보내는 questions[i] (= 이 문항의 prompt)
    fallback: {              // Part 2 차례까지 사진이 오지 않았거나 실패했을 때
      id: "cafeteria";       // 프론트 기본 사진 id
      prompt: string;        // 기본 사진으로 출제했을 때 보내는 questions[i]
    };
  };
  schedule?: { title: string; rows: { time: string; session: string; speaker: string }[] };  // Part 4 자료 (LLM이 만든다). 아래 표 참고
  // 오픽
  topic?: { id: string; label: string };  // 처음 질문의 묘사·루틴·경험·롤플레이
  // 꼬리질문
  hint?: string;             // 발표: 답변 방향 한 줄 / 면접: 이 질문의 의도 한 줄 (한국어)
  about?: number;            // 면접·스피킹 꼬리질문: 이어지는 답변 번호(answers 기준, 0부터). 면접 prompt 머리말의 QM은 이 답변의 원래 질문 번호
};
```

- 토익 Part 4 `schedule`은 서버가 아래 자료 종류 중 하나를 무작위로 골라 만든다. 세 칸 이름은 그대로이고 의미만 다르다 (프론트 기본 문항과 같은 종류).

  | 자료 | `time` | `session` | `speaker` |
  |---|---|---|---|
  | 행사·학회 일정표 | 시간 | 세션 이름 | 발표자 (없으면 `""`) |
  | 출장 일정표 | 날짜·시간 | 일정 (항공편·회의 등) | 장소 |
  | 면접 일정표 | 시간 | 지원자 (취소면 `(canceled)`) | 면접 장소 |
  | 주문·배송 내역 | 날짜 | 주문·배송 상태 | 금액·메모 |

- **`prompt`를 서버가 만들어 준다.** 프론트는 질문 문자열 형식(7절)을 직접 조립하지 않고 `prompt`를 그대로 `questions[i]`로 보낸다. analyze·retry는 형식 변경 없음.
- 토익의 시간(준비·답변 초), 안내문(directions)은 지금처럼 프론트가 Part 번호로 정한다.

#### `type` 목록

| 요청 | `type` | 개수·순서 |
|---|---|---|
| initial · 면접 | `intro` → `motivation` → `job` → `experience` → `closing` | 5개, 순서 고정 |
| initial · 토익 | `readAloud`(Part 1) → `describePicture`(Part 2) → `respond`(Part 3) → `information`(Part 4) → `opinion`(Part 5) | 5개, 순서 고정 |
| initial · 오픽 | `intro` → `description` → `routine` → `experience` → `rolePlayAsk` 또는 `rolePlaySolve`(level 5 이상) | 5개, 순서 고정. 묘사·루틴·경험은 같은 주제 |
| followUp · 발표 | `expected` (+ `hint`) | 1~3개 |
| followUp · 토익 | `respond` 또는 `opinion` | 1~3개 |
| followUp · 오픽 | `followUp` (+ `about`. 이어지는 답변의 주제 id는 `prompt` 머리말에) | 1~3개 |
| followUp · 면접 | `followUp` (+ `about`, `hint`) | 1~3개 |

- **토익 Part 2 사진은 이미지 생성 모델로 만들고, 질문과 따로 받는다.** 사진 문제는 처음 질문(`initial` · 토익)의 Part 2 **한 문항뿐**이고, 꼬리질문에는 사진 문제를 넣지 않는다.
  - `/api/questions`는 사진을 기다리지 않고 질문 5개를 바로 돌려준다. Part 2에는 사진 대신 `picture`(장면 설명 + 두 가지 `prompt`)가 들어 있다.
  - 장면 설명은 LLM이 질문과 함께 쓴다 (사람·사물·배경, 영어 2~3문장). `picture.prompt`의 `Picture:` 줄에 들어가 analyze가 묘사의 정확성을 판단하는 근거가 된다.
  - 질문 문장은 고정("Describe the picture in as much detail as you can.").
  - 사진 받는 순서는 아래 "사진 생성"을 따른다.

### 사진 생성: `POST /api/questions/image` (application/json)

토익 Part 2 사진 1장을 만든다. 프론트가 `/api/questions` 응답을 받자마자 **뒤에서** 부르고, 사용자는 기다리지 않고 Part 1을 시작한다.

```
① POST /api/questions (토익 initial)        → 질문 5개 바로 응답. Part 2는 picture.scene만
② 바로 뒤에서 POST /api/questions/image     → 사진 생성 (10~30초)
③ 사용자는 Part 1 진행 (준비 45초 + 답변 45초. 준비를 건너뛰면 더 짧다)
④ Part 2 차례가 되면
   - 사진이 도착함        → 바로 생성 사진으로 출제, questions[i] = picture.prompt
   - 아직 생성 중         → "사진을 준비하고 있어요" 화면을 최대 5초 보여 준다
                            · 그 사이 도착 → 생성 사진으로 출제
                            · 5초가 지나거나 사용자가 "기본 사진으로 시작"을 누름 → 기본 사진으로 출제
   - 이미 실패(400·502)   → 바로 기본 사진으로 출제
   기본 사진 출제: picture.fallback.id, questions[i] = picture.fallback.prompt
```

- Part 1 준비 시간을 건너뛰면 사진이 Part 2 전에 도착하지 못할 수 있어서 ④에서 최대 5초를 기다린다 (프론트 상수, 실제 생성 시간을 재 보고 조정).
- 기다리는 동안은 Part 2 준비 시간 타이머를 시작하지 않는다. 사진이 화면에 나온 순간부터 준비 45초를 센다.
- 한 번 출제한 사진은 바꾸지 않는다. 출제한 뒤에 도착한 사진은 버린다 (준비 도중 사진이 바뀌면 혼란스럽다).

요청:

```ts
type QuestionImageRequest = {
  scene: string;   // /api/questions 응답의 picture.scene 그대로 (1~1000자)
};
```

응답 200:

```ts
type QuestionImageResponse = {
  image: string;   // "data:image/jpeg;base64,..." (data URL, 수백 KB~1MB 정도)
};
```

- **사진과 `questions[i]`는 반드시 짝을 맞춘다.** 화면에 보여 준 사진의 설명이 들어간 `prompt`를 보내야 analyze가 묘사를 맞게 평가한다.
- 모델은 환경 변수 `OPENAI_IMAGE_MODEL=gpt-image-2.5-flare`, API 키는 `OPENAI_API_KEY` 그대로. 가로형 1장, 속도를 위해 낮은 품질 설정을 쓴다.
- 서버는 사진을 저장하지 않는다.
- 실패: `scene`이 비었거나 1000자를 넘으면 400, 이미지 생성 실패·시간 초과(서버 상한 60초)는 502. 프론트는 어느 경우든 기본 사진으로 출제한다.
- 사용자가 Part 1 도중 나가면 이 요청의 결과는 버린다.
- 꼬리질문으로 답변을 연습할 때(스피킹·면접): 받은 질문의 `prompt`를 `questions`로 해서 같은 모드로 녹음 → transcribe → analyze. 질문 수 = 녹음 수 (1~3개).

### LLM 실패 시

| 요청 | 응답 |
|---|---|
| initial · 면접 | 200. 직무를 넣은 기본 질문 5개 + `warnings: ["llm_failed"]` (아래 기본 질문) |
| initial · 스피킹 | 200. `questions: []` + `warnings: ["llm_failed"]` → 프론트는 지금 가진 문항 데이터로 낸다 |
| followUp | 200. `questions: []` + `warnings: ["llm_failed"]` → "질문을 만들지 못했어요. 다시 시도해 주세요" |

- 면접 기본 질문(ko): "1분 동안 자기소개를 해 주세요." / "{job} 직무에 지원한 이유는 무엇인가요?" / "{job} 직무에서 가장 중요한 역량은 무엇이고, 본인은 그 역량을 어떻게 갖췄나요?" / "팀으로 일하며 갈등이나 어려움을 해결한 경험을 말해 주세요." / "마지막으로 하고 싶은 말이 있나요?" (en도 같은 구성)
- LLM이 일부 질문을 빈 문자열로 주면: 면접 처음 질문은 그 칸만 기본 질문으로 채우고, 나머지는 빈 질문을 빼고 돌려준다 (`warnings` 없음).

### 예시

면접 처음 질문 — 요청: `{ "kind": "initial", "mode": "interview", "language": "ko", "job": "백엔드 개발자" }`

```json
{
  "kind": "initial",
  "mode": "interview",
  "language": "ko",
  "job": "백엔드 개발자",
  "questions": [
    { "type": "intro", "text": "1분 동안 자기소개를 해 주세요.",
      "prompt": "Interview Q1 (Self-introduction)\nJob: 백엔드 개발자\nQuestion: 1분 동안 자기소개를 해 주세요." },
    { "type": "motivation", "text": "백엔드 개발자 직무에 지원한 이유는 무엇인가요?",
      "prompt": "Interview Q2 (Motivation)\nJob: 백엔드 개발자\nQuestion: 백엔드 개발자 직무에 지원한 이유는 무엇인가요?" }
  ]
}
```
(5개 중 2개만 표시)

발표 꼬리질문(예상 질문) — 요청:

```json
{
  "kind": "followUp",
  "mode": "presentation",
  "language": "ko",
  "level": "exam",
  "count": 3,
  "answers": [{ "text": "오늘은 음 캠퍼스 식당 문제를 … 점심시간 대기 시간이 평균 20분입니다 …" }]
}
```

응답:

```json
{
  "kind": "followUp",
  "mode": "presentation",
  "language": "ko",
  "questions": [
    { "type": "expected",
      "text": "대기 시간 20분이라는 수치는 어떤 방법으로 조사했나요?",
      "hint": "조사 기간·표본 수·측정 방법을 짧게 밝히고 한계도 인정하세요.",
      "prompt": "Presentation Q&A 1\nQuestion: 대기 시간 20분이라는 수치는 어떤 방법으로 조사했나요?" },
    { "type": "expected",
      "text": "제안한 해결책을 실제로 적용하려면 비용이 얼마나 드나요?",
      "hint": "정확한 금액이 없으면 비용이 드는 항목과 우선순위로 답하세요.",
      "prompt": "Presentation Q&A 2\nQuestion: 제안한 해결책을 실제로 적용하려면 비용이 얼마나 드나요?" }
  ]
}
```
(3개 중 2개만 표시)

면접 꼬리질문 — 요청의 `answers`는 `[{ "question": "Interview Q4 (Past experience (STAR))\nJob: 백엔드 개발자\nQuestion: …", "text": "저는 팀 프로젝트에서 …" }, …]`, 응답 질문 예:

```json
{ "type": "followUp", "about": 3,
  "text": "그때 팀원과 의견이 갈린 기술 선택은 구체적으로 무엇이었고, 왜 그 방법을 골랐나요?",
  "hint": "의사결정 근거와 본인의 역할을 확인하려는 질문입니다.",
  "prompt": "Interview Follow-up 1 (about Q4)\nJob: 백엔드 개발자\nQuestion: 그때 팀원과 의견이 갈린 기술 선택은 구체적으로 무엇이었고, 왜 그 방법을 골랐나요?" }
```

## 7. 공통 규칙

### `questions` (스피킹·면접)
- 아래 형식의 문자열은 `POST /api/questions` 응답의 `prompt`로 서버가 만들어 준다. 프론트는 그대로 보낸다.
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
- 면접은 질문 번호·유형, 지원 직무, 질문 문장을 한 문자열에 넣는다 (`job`은 별도 필드로 보내지 않는다). 유형 영어 이름: `intro`=Self-introduction, `motivation`=Motivation, `job`=Job knowledge, `experience`=Past experience (STAR), `closing`=Closing
  ```json
  [
    "Interview Q1 (Self-introduction)\nJob: 백엔드 개발자\nQuestion: 1분 동안 자기소개를 해 주세요.",
    "Interview Q2 (Motivation)\nJob: 백엔드 개발자\nQuestion: 백엔드 개발자 직무에 지원한 이유는 무엇인가요?"
  ]
  ```
- 꼬리질문은 머리말만 다르다: 면접 `Interview Follow-up N (about QM)` (M은 `answers[about].question`의 원래 질문 번호. 없으면 `about + 1`), 오픽 `OPIc Follow-up N (topic: …)`, 토익 `TOEIC Speaking Part 3/5 (…)` (처음 질문과 같은 형식), 발표 예상 질문 `Presentation Q&A N`.
- 발표 예상 질문 답변(`Presentation Q&A N`)은 `mode: "presentation"` + `questions`로 보낸다 (1절). 서버는 **발표 질의응답 기준**(바로 답하기·근거·모르면 인정·간결함)으로 코멘트·모범 답변·총평을 쓰고, 면접 기준(직무·STAR)은 쓰지 않는다. 예전처럼 `mode: "interview"`로 보내도 머리말을 보고 같은 기준으로 평가한다 (프론트가 옮길 때까지 호환).

### 검증
- `mode`와 `language` 조합: 발표·면접은 `ko`·`en`, 스피킹은 `en`만 허용한다.
- `level`은 발표에서, `exam`은 스피킹에서, `questions`는 스피킹·면접에서 필수. 스피킹·면접은 `questions` 개수 = 녹음(파트) 개수.
- questions: `kind`·`mode`·`language`·`exam` 조합이 표(6절)와 다르면(예: initial + presentation), 면접 `job`이 비었거나 50자를 넘으면, 오픽 `topics`가 1~3개가 아니거나 `level`이 1~6이 아니면, followUp `answers`가 1~5개가 아니거나 합계 20,000자를 넘으면, `count`가 1~3이 아니면 400.
- retry는 위 규칙에 더해 `previous`가 필수다. `previous.final`은 빈 배열이어도 된다.

### 길이 제한 (서버는 +5초 여유로 검증)

| 대상 | 서버 상한 |
|---|---|
| 발표 | 파일당 5분, 최대 5개 (합계 최대 25분) |
| 오픽 | 답변당 2분 |
| 토익 스피킹 | 답변당 60초 (가장 긴 문항 기준) |
| 면접 | 답변당 2분 |

토익은 파트마다 답변 시간이 다르지만 요청에 파트 번호 필드가 없어서 서버는 위 상한만 확인한다. 정확한 파트별 시간 제한은 프론트 녹음 타이머가 담당한다.

### 처리 흐름

```
transcribe: 검증 → 녹음마다 병렬 STT(whisper, 질문 내용을 힌트로) → 문장 단위 분할 + pause 줄
analyze:    검증 → 파트별 코드 분석(패닉존, 필러, 중복) → 파트별 LLM 병렬(패닉 원인, 표현 개선, 문법, 최종 대본)
            → 총평 LLM 1회 → 합산
retry:      검증 → 파트별 코드 분석(패닉존, 필러, 중복) → (previous.accuracy가 있으면 파트별 정확성 채점 병렬)
            → 합산 + 전후 비교·대본 일치율 → 재도전 총평 LLM 1회
questions:  검증 → 질문 생성 LLM 1회 (initial 면접은 실패 시 기본 질문, 나머지는 빈 목록)
            (토익 initial은 Part 2 장면 설명까지 같은 LLM 호출로)
questions/image: 검증 → 이미지 생성 1회 (실패·60초 초과 시 502 → 프론트가 기본 사진)
```

- 파트는 서로 독립이다. 파일 사이를 이어 붙이지 않으므로 가짜 패닉존이 생기지 않는다.
- 발표는 `level` 값을, 스피킹은 해당 파트의 질문 문자열과 `exam`을, 면접은 해당 파트의 질문 문자열(직무 포함)을 LLM 프롬프트에 함께 전달한다.
- 면접 평가 기준: 질문 의도에 맞는 답인지, 결론 먼저(두괄식)인지, 경험 질문은 STAR(상황·과제·행동·결과)를 갖췄는지, 숫자·사례로 구체적인지, 지원 직무와 이어지는지. `parts[].comment`에 질문별 한 줄로 쓰고, `final`은 이 기준으로 다시 짠 모범 답안이다.
- 토익 Part 1(지문 읽기)은 최종 대본을 만들지 않는다. LLM이 질문 문자열의 파트 이름을 보고 `final`을 빈 배열로 돌려준다.

## 8. 에러

`{ "error": "메시지" }` + 상태 코드

| 상황 | 코드 |
|---|---|
| 요청 조합이 틀림 (모드·언어·level·exam 불일치, 질문·녹음 개수 불일치), 길이·개수·형식 초과, 잘못된 JSON | 400 |
| whisper가 읽을 수 없는 오디오 형식 (transcribe) | 400 |
| 음성이 감지되지 않음 (transcribe, 몇 번째 녹음인지 포함) | 422 |
| STT 실패 (transcribe, 1회 재시도 후, 몇 번째인지 포함) | 502 |
| LLM 실패 (analyze) | 200. `final`은 빈 배열, `summary`는 빈 문자열·빈 배열로 내려가고 `warnings: ["llm_failed"]`가 붙는다 |
| LLM 실패 (questions) | 200. 면접 처음 질문은 기본 질문 5개, 나머지는 `questions: []`. 둘 다 `warnings: ["llm_failed"]` (6절) |
| 이미지 생성 실패·시간 초과 (questions/image) | 502. 프론트는 기본 사진(`picture.fallback`)으로 출제 |
| LLM 실패 (retry) | 200. `retry`가 없고 `summary`는 빈 문자열·빈 배열, `warnings: ["llm_failed"]`. `compare`는 그대로 온다 |

## 확인이 필요한 항목

- 토익 스피킹의 파트별 시간 검증을 서버가 할지 (질문 문자열의 `Part N` 표기를 읽는 방식). 지금은 서버 상한 60초 + 프론트 타이머.
- 점수에 패닉 길이·말 속도를 반영할지 (지금은 패닉존·군말·반복 단어 비율만. 샘플을 본 뒤 판단).
- retry의 `RETRY_MATCH_LOW`(기본 40)가 적절한지 (대본을 보고 읽은 샘플과 즉흥 샘플을 녹음해 본 뒤 조정).
- 이미지 모델 `gpt-image-2.5-flare`: 구현 후 실제 키로 호출해 동작·지원 크기·품질 옵션을 확인한다. 구현할 때 `backend/.env.example`에 키 이름 추가, README "외부 API·오픈소스" 표에 한 줄 추가.
- 이미지 생성 서버 상한 60초가 적절한지 실제 응답 시간을 재 보고 조정한다 (실제 출제 여부는 Part 2 시작 시점에 프론트가 정한다).
- 발표 예상 질문에 답하는 연습을 할지: 하려면 발표 모드에서도 `questions`를 받도록 analyze를 바꿔야 한다. 지금은 질문과 `hint`를 보여 주기만 한다.
- 오픽 처음 질문을 LLM으로 만들면 서베이 주제 목록(`data/opic/survey.json`)의 문항 예시는 실패 시 대체용으로만 쓰인다.
