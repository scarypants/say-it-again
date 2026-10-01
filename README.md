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
# 루트에서 한 번만 (워크스페이스 전체 설치)
npm install
cp backend/.env.example backend/.env   # 키 입력

# 각각 실행 (터미널 2개)
npm run dev:back
npm run dev:front
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
| React, Vite, TypeScript | 프론트엔드 |
| TailwindCSS, DaisyUI | 스타일 |
| recharts | 총평 차트 |
| Express, multer, cors, dotenv | 백엔드 |
