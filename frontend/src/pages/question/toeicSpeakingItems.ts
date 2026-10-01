// 토익 스피킹 모의시험: 실제 시험 Part 1~5에서 한 문제씩 (현행 11문항 체계의 Part별 준비·답변 시간)
// read = 자료 읽기, listen = 질문 듣기(TTS), prep = 준비, speak = 답변(자동 녹음)
export type Phase =
  | { kind: "read"; sec: number }
  | { kind: "listen" }
  | { kind: "prep"; sec: number }
  | { kind: "speak"; sec: number };

export type ScheduleRow = { time: string; session: string; speaker: string };

export type ToeicSpeakingItem = {
  part: 1 | 2 | 3 | 4 | 5;
  name: string; // 화면 표시용 한글 이름
  directions: string;
  prompt: string; // 화면에 보이는 문제 (Part 1은 읽을 지문)
  listenText?: string; // TTS로 읽어 줄 문장
  context?: string; // Part 3 상황 설명
  picture?: "cafeteria"; // Part 2 사진
  schedule?: { title: string; rows: ScheduleRow[] }; // Part 4 자료
  phases: Phase[];
};

export const TOEIC_SPEAKING_ITEMS: ToeicSpeakingItem[] = [
  {
    part: 1,
    name: "지문 읽기",
    directions:
      "In this part of the test, you will read aloud the text on the screen. You will have 45 seconds to prepare and 45 seconds to read the text aloud.",
    prompt:
      "Attention, students. The main library will extend its opening hours during the final exam period. From December first to December nineteenth, the reading rooms on the second and third floors will stay open until two a.m. Please bring your student ID card, keep your voice down, and take all of your belongings with you when you leave. Thank you for your cooperation.",
    phases: [
      { kind: "prep", sec: 45 },
      { kind: "speak", sec: 45 },
    ],
  },
  {
    part: 2,
    name: "사진 묘사하기",
    directions:
      "In this part of the test, you will describe the picture on your screen in as much detail as you can. You will have 45 seconds to prepare and 30 seconds to speak about the picture.",
    prompt: "Describe the picture in as much detail as you can.",
    picture: "cafeteria",
    phases: [
      { kind: "prep", sec: 45 },
      { kind: "speak", sec: 30 },
    ],
  },
  {
    part: 3,
    name: "질문에 답하기",
    directions:
      "In this part of the test, you will answer questions. You will have 3 seconds to prepare after you hear each question.",
    context:
      "Imagine that a marketing firm is doing research on campus dining. You have agreed to participate in a telephone interview.",
    prompt: "If a new café opened on your campus, what would make you want to visit it often? Why?",
    listenText:
      "If a new café opened on your campus, what would make you want to visit it often? Why?",
    phases: [{ kind: "listen" }, { kind: "prep", sec: 3 }, { kind: "speak", sec: 30 }],
  },
  {
    part: 4,
    name: "정보 보고 답하기",
    directions:
      "In this part of the test, you will answer questions based on the information provided. You will have 45 seconds to read the information before the question begins.",
    schedule: {
      title: "Campus Career Fair — Student Union Hall, Friday, October 16",
      rows: [
        { time: "10:00 – 10:50", session: "Writing a Résumé That Stands Out", speaker: "Dana Lee" },
        { time: "11:00 – 11:50", session: "Job Interview Basics", speaker: "Mark Chen" },
        { time: "12:00 – 1:00", session: "Lunch Break", speaker: "" },
        {
          time: "1:00 – 1:50",
          session: "Mock Interviews with Recruiters",
          speaker: "Career Center",
        },
        { time: "2:00 – 2:50", session: "Internships Abroad", speaker: "Sofia Park" },
      ],
    },
    prompt:
      "I heard there are sessions about job interviews. Could you tell me about all the sessions related to interviews?",
    listenText:
      "Hi, I'm interested in the career fair. I heard there are sessions about job interviews. Could you tell me about all the sessions related to interviews?",
    phases: [
      { kind: "read", sec: 45 },
      { kind: "listen" },
      { kind: "prep", sec: 3 },
      { kind: "speak", sec: 30 },
    ],
  },
  {
    part: 5,
    name: "의견 제시하기",
    directions:
      "In this part of the test, you will give your opinion about a specific topic. You will have 45 seconds to prepare and 60 seconds to speak.",
    prompt:
      "Do you agree or disagree with the following statement? University students should be required to take at least one online course before graduating. Use specific reasons and examples to support your answer.",
    listenText:
      "Do you agree or disagree with the following statement? University students should be required to take at least one online course before graduating. Use specific reasons and examples to support your answer.",
    phases: [{ kind: "listen" }, { kind: "prep", sec: 45 }, { kind: "speak", sec: 60 }],
  },
];

// 백엔드(LLM)에 넘길 질문 문장. 사진·자료처럼 화면에만 있는 정보도 글로 풀어 넣는다
export function toeicSpeakingQuestionText(item: ToeicSpeakingItem) {
  const parts = [`TOEIC Speaking Part ${item.part} (${item.name})`];
  if (item.context) parts.push(`Situation: ${item.context}`);
  if (item.picture === "cafeteria")
    parts.push(
      "Picture: a campus cafeteria. A staff member behind the counter hands a cup of coffee to a student in a red shirt. A menu board hangs above the counter. At a table on the right, one student works on a laptop and another reads a book with a coffee cup. Trees are visible through the window, and there is a potted plant.",
    );
  if (item.schedule)
    parts.push(
      `Information: ${item.schedule.title}. ` +
        item.schedule.rows
          .map((r) => `${r.time} ${r.session}${r.speaker ? ` (${r.speaker})` : ""}`)
          .join("; "),
    );
  parts.push(item.part === 1 ? `Text to read aloud: ${item.prompt}` : `Question: ${item.prompt}`);
  return parts.join("\n");
}
