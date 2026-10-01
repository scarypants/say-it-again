# 오픽 모의시험 문항 데이터

오픽 화면(`../../OpicExam.tsx`)은 이 폴더의 JSON만 읽어 문제를 만든다. 문항을 늘리거나 고칠 때는 코드 말고 여기만 고친다. 형식은 `../../opicItems.ts`의 타입과 같아야 한다 (틀리면 `npm run build`에서 걸린다).

| 파일 | 내용 | 쓰이는 문항 |
|---|---|---|
| `intro.json` | 자기소개 질문 | Q1 |
| `survey.json` | Background Survey 주제별 콤보 (묘사 → 루틴 → 과거 경험) | Q2~Q4 |
| `rolePlays.json` | 롤플레이 상황 (질문하기 / 문제 해결 / 관련 경험) | Q5 |
| `selfAssessment.json` | Self Assessment 1~6단계 설명 | 시작 화면 |

## 실제 시험과 이 모의시험

| | 실제 오픽 | 이 모의시험 |
|---|---|---|
| 문항 수 | 12문항(난이도 1~2) / 15문항(3~6) | 5문항 (서버가 답변 파일을 최대 5개 받음) |
| 구성 | 1 자기소개, 2~4 서베이 콤보, 5~7 서베이·돌발 콤보, 8~10 돌발 콤보, 11~13 롤플레이, 14~15 어드밴스 | 1 자기소개, 2~4 서베이 콤보, 5 롤플레이 |
| 질문 | Ava가 소리로만 읽어 줌, 글은 안 보임 | 같음 (브라우저 TTS). 시험이 끝나면 글로 보여 줌 |
| 다시 듣기 | 처음 들은 뒤 5초 안에 1번 | 같음 |
| 답변 시간 | 문항별 제한 없음, 전체 40분, 문항당 2분 안팎 권장 | 2분 권장, 3분이 되면 자동으로 다음 문제 |
| 난이도 | Self Assessment로 정하고 7번 뒤 한 번 더 조정 | 5~6단계를 고르면 롤플레이가 "문제 해결"형으로 바뀜 |

## 문항 출처

- 시험 구조와 진행 규칙은 아래 공개 자료에서 확인했다.
  - ACTFL, [OPIc Report Part A: General Test Information](https://www.actfl.org/uploads/files/general/Documents/assessments/acereports/OPIc_Report_Part_A_General_Information_2023.pdf)
  - [OPIc - 나무위키](https://namu.wiki/w/OPIc)
  - 링커리어, [오픽 시험 구성 총정리](https://community.linkareer.com/employment_data/5949985)
  - 오픽만수르, [오픽 문제 유형 6가지](https://opicmansur.com/%EC%98%A4%ED%94%BD-%EB%AC%B8%EC%A0%9C-%EC%9C%A0%ED%98%95-6%EA%B0%80%EC%A7%80/)
- 질문 문장은 이 구조와 자주 나오는 주제(서베이 항목, 돌발·롤플레이 상황)에 맞춰 **새로 쓴 것**이다. 오픽 실제 문항은 공개되지 않고, 인터넷의 "기출"은 응시자가 기억으로 복원해 학원·블로그가 정리한 저작물이라 그대로 옮기지 않았다.
