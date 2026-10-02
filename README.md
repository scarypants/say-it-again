# 다시, 말해 (say-it-again)

대학생의 말하기 연습을 AI가 진단해주는 서비스. 어디서 버벅였는지, 왜 막혔는지, 어떻게 다시 말하면 좋은지까지 알려준다.

2026 제1회 컴퓨터공학과 해커톤 L/NKerthon 출품작 · 주제 "우리가 바꾸는 캠퍼스의 하루"

## 왜 만들었나

강의 발표, 어학 스피킹, 면접을 혼자 연습하면 피드백해줄 사람이 없다. 기존 말하기 앱은 "필러워드 몇 번" 같은 숫자에서 끝난다.
"다시, 말해"는 말이 끊긴 구간(**패닉존**, 2초 이상 침묵)을 타임스탬프로 잡고, AI가 그 앞뒤 문맥을 읽어 **왜 막혔는지** 진단하고 **대안 대본**까지 제시한다. 문제 지점은 대본 위에 직접 표시한다.

## 주요 기능

| 모드 | 언어 | 연습 방식 |
|---|---|---|
| 강의 발표 | 한국어 · 영어 | 과제·시험 발표·큰 강연 중 선택, 5분 단위 녹음(최대 5개) 또는 파일 업로드, 발표 자료(PDF) 보며 녹음 |
| 어학 스피킹 | 영어 | 토익 스피킹·오픽 실전처럼 질문별 준비·답변 녹음 (토익 Part 2 사진은 AI 생성) |
| 면접 | 한국어 · 영어 | 지원 직무를 적으면 AI가 맞춤 질문 5개를 만들고, 질문별 준비·답변 녹음 |

- **대본 검토**: 음성을 문장 단위 대본으로 바꿔 보여 주고, 잘못 들린 단어만 고친 뒤 분석한다.
- **대본 하이라이트**: 막힌 지점(빨강), 군말(노랑), 반복(보라), 표현 개선(파랑), 문법(초록, 스피킹). 패닉존을 누르면 원인과 대안 대본이 나온다.
- **총평**: 점수, 말 속도(WPM), 군말·반복 차트, 가장 먼저 고칠 3가지, 고친 완성 대본.
- **"다시, 말해" 재도전**: 같은 내용을 다시 녹음하면 이전 결과와 전후 비교.
- **꼬리질문**: 결과 화면에서 실제로 말한 내용을 바탕으로 추가 질문 1~3개를 받아 바로 이어서 연습.

## 동작 흐름

```
(스피킹·면접) 질문 생성 → 질문마다 답변 녹음
녹음 → [STT] 단어 타임스탬프 → 문장 분할 + 패닉존 계산 → 대본 검토(전사 오류 수정)
     → 군말·반복 탐지(코드) → LLM 원인 진단·표현 개선·총평 → 하이라이트 + 총평 화면
```

서버는 아무것도 저장하지 않는다 (DB 없음). 자세한 요청·응답은 [docs/api.md](docs/api.md).

## 실행

Node.js 20 이상.

```bash
# 루트에서 한 번에 설치 (npm workspaces)
npm install

# backend — backend/.env.example 을 backend/.env 로 복사하고 OPENAI_API_KEY 등 입력
npm run dev:back                     # http://localhost:8080

# frontend — 서버 없이 보려면 frontend/.env 에 VITE_USE_MOCK=true
npm run dev:front                    # http://localhost:5173
```

- 키 없이 시연하려면 `backend/.env`에 `MOCK_STT=true`, `MOCK_LLM=true` (저장된 응답 사용).
- 휴대폰으로 보려면 같은 와이파이에서 PC의 사설 IP로 접속하거나 ngrok(https)을 쓴다. 녹음(마이크)은 https 또는 localhost에서만 동작한다.
- 빌드: `npm run build -w frontend`, `npm run build -w backend`

## 폴더 구조

```
frontend/src/
  pages/home        모드 선택
  pages/question    스피킹·면접 질문별 녹음
  pages/record      발표 녹음·업로드·자료 보기
  pages/review      대본 검토(전사 오류 수정)
  pages/script      대본 하이라이트
  pages/summary     총평
  api/ types/ store/ components/common/   공용
backend/src/
  server.ts  config.ts(튜닝 상수)  http/(라우트)  pipeline/(전사·문장 분할)
  detectors/(군말·반복)  llm/(OpenAI 호출·프롬프트)  types/
```

## 팀

| 이름 | 역할 |
|---|---|
| 윤화영 | 백엔드 |
| 고민준 | 프론트엔드 (입력 화면 + 공용) |
| 김왁수 | 프론트엔드 (결과 화면) |

## 문서

- 팀 규칙: [AGENTS.md](AGENTS.md)
- 기획: [docs/plan.md](docs/plan.md) · 화면 설계: [docs/wireframe.webp](docs/wireframe.webp)
- API 계약: [docs/api.md](docs/api.md)

## 외부 API · 오픈소스

추가할 때마다 한 줄씩 적는다 (발표 시 공개 의무).

| 이름 | 용도 |
|---|---|
| OpenAI Whisper API (whisper-1) | 음성 → 텍스트, 단어 타임스탬프 |
| OpenAI API (LLM) | 막힌 구간 원인 진단, 대안 대본, 총평 |
| OpenAI Image API (gpt-image-2.5-flare) | 토익 스피킹 Part 2 사진 생성 |
| React, Vite, TypeScript | 프론트엔드 |
| TailwindCSS, DaisyUI | 스타일 |
| recharts | 총평 차트 |
| react-router | 화면 이동(라우팅) |
| pdfjs-dist (PDF.js) | 발표 자료 PDF 미리보기 |
| Express, multer, cors, dotenv | 백엔드 |
