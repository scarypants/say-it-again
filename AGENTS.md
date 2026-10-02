# AGENTS.md — "다시, 말해" (say-it-again) 팀 규칙

이 파일이 팀 규칙의 유일한 원본이다. Claude는 `CLAUDE.md`를 통해, Codex는 이 파일을 직접 읽는다.
규칙을 바꿀 때는 이 파일만 고치고, PR로 올려 팀원 모두에게 알린다.

## 1. 프로젝트

- 대학생의 말하기 연습(강의 발표 / 어학 스피킹 / 면접)을 AI가 진단하는 모바일 우선 반응형 웹.
- 녹음 → STT(Whisper, 단어 타임스탬프) → 서버가 줄 분할 + 패닉존(2초 이상 침묵) 계산 → 필러워드/중복 탐지 → OpenAI LLM 1회 호출로 원인 진단·대안 대본·총평 → 스크립트 하이라이트 + 총평 화면.
- 상세 기획: `docs/plan.md` / 화면 설계: `docs/wireframe.webp` / API 계약: `docs/api.md`
- 기술 스택
  - frontend: React(Vite) + TypeScript + TailwindCSS + DaisyUI, MediaRecorder API, recharts
  - backend: Node.js + Express + TypeScript(tsx), multer, cors, dotenv, `openai`(whisper-1 + LLM 분석 + 이미지 생성 gpt-image-2.5-flare)
- 저장소 구조: npm workspaces 모노레포 `frontend/` + `backend/` (루트 `package.json`). DB 없음.
- backend 구조: `backend/src/` 아래 `server.ts`(진입점), `config.ts`(튜닝 상수), `types/`(API·내부 타입), `http/`(라우트·요청 검증), `pipeline/`(전사·줄 분할·통계), `detectors/`(필러·중복 탐지), `llm/`(OpenAI 호출·프롬프트)

## 2. 팀과 소유권 (가장 중요)

| 사람 | GitHub | AI | 역할 | 소유 경로 |
|---|---|---|---|---|
| 윤화영 | scarypants | Claude | 백엔드 | `backend/**`, `docs/api.md` |
| 고민준 | KO-HOJINI | Claude | 프론트 전체 | `frontend/**` (모든 페이지 + 아래 프론트 공용 파일 + `frontend/src/mocks/`) |
| 김왁수 | kimwaksoo | Codex | (10/2 리허설부터 프론트 담당 해제) | 없음. 프론트 수정이 필요하면 고민준에게 요청 |

- 루트 `package.json`·루트 `package-lock.json`(workspaces)은 공동 관리: 의존성 추가는 각자 자기 workspace에 `npm install <pkg> -w frontend|backend`로 하고, lock 충돌이 나면 `npm install`로 재생성한다.
- 프론트 공용 파일(주인: 고민준): `frontend/package.json`, `frontend/vite.config.ts`, tailwind/DaisyUI 설정, `frontend/src/main.tsx`, `frontend/src/App.tsx`(라우터), `frontend/src/components/common/`, `frontend/src/api/`, `frontend/src/types/`, `frontend/src/store/`(페이지 간 공유 상태), `frontend/src/styles/`
- 페이지 전용 컴포넌트는 각자 페이지 폴더 안에 둔다 (예: `pages/script/components/Highlight.tsx`). 공용으로 올리고 싶으면 고민준에게 요청한다.
- 루트 파일(`AGENTS.md`, `CLAUDE.md`, `README.md`, `.github/`, 설정 파일)은 팀 합의 후 수정한다. 단, README의 "외부 API·오픈소스" 목록에 한 줄 추가하는 것은 누구나 가능.
- **남의 소유 경로는 읽기만 한다.** 수정이 필요하면 이슈를 만들거나 팀 채팅으로 주인에게 요청한다.

## 3. 계약 우선 (프론트·백엔드 분리 작업)

- 백엔드는 `docs/api.md`에 엔드포인트와 요청/응답 예시 JSON을 먼저 확정한다.
- 프론트는 그 예시를 `frontend/src/mocks/`에 두고 서버 없이 개발한다. 결과 화면은 mock JSON만으로 시작할 수 있다.
- 응답 타입은 `frontend/src/types/api.ts`에 `docs/api.md`와 동일하게 둔다. 계약이 바뀌면 백엔드가 `docs/api.md`를 고치고, PR 설명 첫 줄에 `[API 변경]`을 쓰고, 팀 채팅에 알린다.
- API 키는 서버에만 둔다. 클라이언트에서 OpenAI를 직접 호출하지 않는다.

## 4. 브랜치 · 커밋 · PR

- `main`에 직접 push 금지. 이슈 1개 = 브랜치 1개 = PR 1개.
- 브랜치: `feat/<이슈번호>-<짧은설명>` (예: `feat/12-record-ui`), 그 외 `fix/`, `chore/`, `docs/`.
- 커밋: `type(scope): 설명 (#이슈)` — type은 feat/fix/chore/docs/refactor/style. 예: `feat(record): 녹음 시작/정지 버튼 (#12)`
- 작업 시작 전과 PR 올리기 전에 `git pull origin main` (또는 `git rebase origin/main`).
- PR은 작게(가능하면 300줄 이하), 본인이 squash merge. 리뷰 승인은 필수 아님. 단 `[API 변경]`이나 공용 파일 변경 PR은 관련자가 확인 후 merge.
- merge 후 브랜치 삭제.
- 누가 무엇을 했는지는 커밋 작성자·이슈·PR 번호로 추적한다. 진행 상황 공유용 공동 md 파일은 만들지 않는다 (충돌 원인). GitHub Issues/PR을 사용한다.

## 5. AI 에이전트 행동 규칙 (Claude, Codex 공통)

작업을 시작하기 전에:
1. 이 파일과 `docs/api.md`를 읽는다.
2. 지시한 사람이 누구인지, 그 사람의 소유 경로가 어디인지 확인한다. 모르면 묻는다.

해도 되는 것:
- 소유 경로 안에서 파일 생성·수정, 로컬 빌드/실행/테스트.
- 현재 작업 브랜치에 커밋·push, PR 생성.

하지 말 것:
- 소유 경로 밖 파일 수정 (필요하면 사람에게 "○○ 파일 변경 필요"라고 보고만 한다).
- 의존성 추가·삭제, `package.json`/lock 파일 수정 — 사람(해당 파일 주인)에게 먼저 묻는다.
- 요청 범위를 넘는 리팩터링, 파일 이동·이름 변경, 전체 포맷 일괄 적용.
- `main` 직접 push, force push, 다른 사람 브랜치 수정, 브랜치/태그 삭제(본인 merge된 브랜치 제외).
- `.env`나 API 키를 출력·커밋·로그에 남기기.
- 테스트/빌드가 깨진 상태로 커밋.

커밋 기준:
- 기능 단위가 완결되고 frontend는 `npm run build -w frontend`, backend는 `npm run build -w backend`가 통과하면 커밋한다.
- 커밋 메시지는 4절 형식을 따른다.

## 6. 코드 스타일

- TypeScript strict. `any`는 최소화. (frontend, backend 공통)
- 포맷은 Prettier(`.prettierrc`), 줄바꿈 LF, 들여쓰기 2칸. 자기 소유 파일에만 포맷을 적용한다.
- 파일명: 컴포넌트 `PascalCase.tsx`, 그 외 `camelCase.ts`.
- 서버 튜닝 상수는 `backend/src/config.ts` 한곳에 모은다: `PANIC_GAP=2.0`, `MAX_WORDS=40`, `PANIC_TAIL_WORDS=3`, `AMBIGUOUS_FILLER_GAP=0.3` 등.
- UI: DaisyUI 컴포넌트 우선. 하이라이트 5색 규칙은 `docs/plan.md` 6-1절을 따른다. 이모지 남발·의미 없는 카드 중첩 금지.

## 7. 비밀값 · 환경 변수

- `.env`는 커밋 금지(.gitignore 등록됨). 대신 `backend/.env.example`에 키 이름만 적는다.
  - `OPENAI_API_KEY=`, `OPENAI_LLM_MODEL=`, `OPENAI_IMAGE_MODEL=`(토익 Part 2 사진 생성, `gpt-image-2.5-flare`), `PORT=8080`, `CORS_ORIGIN=`(추가 허용 출처. localhost·사설 IP·ngrok은 기본 허용) (frontend는 `frontend/.env.example`에 `VITE_USE_MOCK`)
- 키는 각자 로컬 `.env`에 넣는다. 채팅·이슈·PR에 키를 붙여넣지 않는다.

## 8. 대회 규칙 준수

- 개발 시간: 10/1(목) 19:30 ~ 10/2(금) 11:30. 기능 코드는 이 시간 안에서만 커밋한다.
- 외부 API·오픈소스를 추가하면 README의 "외부 API·오픈소스" 표에 바로 한 줄 추가한다 (발표 시 공개 의무).
- 표절·대리 개발 금지.

## 9. 우선순위 (이 순서를 지킨다)

1. 녹음 → STT → 스크립트 분할 파이프라인
2. 필러워드 + 패닉존 표시
3. LLM 원인 분석 연동 (데모 핵심)
4. 스크립트 하이라이트 UI (패닉존 클릭 → 원인 + 대안)
5. 총평 화면
6. 스트레치: 표현 개선(파랑/초록), 모드 전환, 중복 단어(보라)
7. 데모 준비: 사전 처리 샘플, 백업 영상, 리허설

시간이 부족하면 총평 화면 장식부터 줄이고, LLM 원인 분석은 끝까지 지킨다.
