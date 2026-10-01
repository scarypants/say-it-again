# 다시, 말해 (say-it-again)

대학생의 말하기 연습을 AI가 진단해주는 서비스. 어디서 버벅였는지, 왜 막혔는지, 어떻게 다시 말하면 좋은지까지 알려준다.

2026 제1회 컴퓨터공학과 해커톤 L/NKerthon 출품작 · 주제 "우리가 바꾸는 캠퍼스의 하루"

## 팀

| 이름 | 역할 |
|---|---|
| 윤화영 | 백엔드 |
| 고민준 | 프론트엔드 |
| 김왁수 | 프론트엔드 |

## 실행

```bash
# 루트에서 한 번에 설치 (npm workspaces)
npm install

# backend — backend/.env 에 키 입력
npm run dev:back

# frontend — 서버 없이 보려면 frontend/.env 에 VITE_USE_MOCK=true
npm run dev:front                    # http://localhost:5173
```

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
