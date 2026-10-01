import type { Question } from "../../types/api";

// 토익 스피킹 모의시험: 실제 시험 Part 1~5에서 한 문제씩 (Part마다 여러 세트 중 무작위)
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
  serverPrompt?: string; // 서버가 만든 질문 문자열 (Part 2는 기본 사진용). 있으면 분석에 그대로 보낸다
  pictureReq?: NonNullable<Question["picture"]>; // 서버 문제의 Part 2: 사진을 따로 생성한다
};

// 실제 시험의 Part별 형식·시간을 따르고, 자주 나오는 상황(공지·광고 읽기, 전화 설문, 일정표 문의,
// 찬반 의견)에 맞춰 새로 쓴 문항. 기출을 옮긴 것이 아니다. 시험마다 Part별로 한 세트씩 무작위로 낸다
const DIRECTIONS = {
  1: "In this part of the test, you will read aloud the text on the screen. You will have 45 seconds to prepare and 45 seconds to read the text aloud.",
  2: "In this part of the test, you will describe the picture on your screen in as much detail as you can. You will have 45 seconds to prepare and 30 seconds to speak about the picture.",
  3: "In this part of the test, you will answer questions. You will have 3 seconds to prepare after you hear each question.",
  4: "In this part of the test, you will answer questions based on the information provided. You will have 45 seconds to read the information before the question begins.",
  5: "In this part of the test, you will give your opinion about a specific topic. You will have 45 seconds to prepare and 60 seconds to speak.",
} as const;

const readAloud = (prompt: string): ToeicSpeakingItem => ({
  part: 1,
  name: "지문 읽기",
  directions: DIRECTIONS[1],
  prompt,
  phases: [
    { kind: "prep", sec: 45 },
    { kind: "speak", sec: 45 },
  ],
});

const answer = (context: string, prompt: string): ToeicSpeakingItem => ({
  part: 3,
  name: "질문에 답하기",
  directions: DIRECTIONS[3],
  context,
  prompt,
  listenText: prompt,
  phases: [{ kind: "listen" }, { kind: "prep", sec: 3 }, { kind: "speak", sec: 30 }],
});

const info = (
  schedule: NonNullable<ToeicSpeakingItem["schedule"]>,
  greeting: string,
  prompt: string,
): ToeicSpeakingItem => ({
  part: 4,
  name: "정보 보고 답하기",
  directions: DIRECTIONS[4],
  schedule,
  prompt,
  listenText: `${greeting} ${prompt}`,
  phases: [
    { kind: "read", sec: 45 },
    { kind: "listen" },
    { kind: "prep", sec: 3 },
    { kind: "speak", sec: 30 },
  ],
});

const opinion = (statement: string): ToeicSpeakingItem => {
  const prompt = `Do you agree or disagree with the following statement? ${statement} Use specific reasons and examples to support your answer.`;
  return {
    part: 5,
    name: "의견 제시하기",
    directions: DIRECTIONS[5],
    prompt,
    listenText: prompt,
    phases: [{ kind: "listen" }, { kind: "prep", sec: 45 }, { kind: "speak", sec: 60 }],
  };
};

const PART1 = [
  readAloud(
    "Attention, students. The main library will extend its opening hours during the final exam period. From December first to December nineteenth, the reading rooms on the second and third floors will stay open until two a.m. Please bring your student ID card, keep your voice down, and take all of your belongings with you when you leave. Thank you for your cooperation.",
  ),
  readAloud(
    "Are you looking for fresh, affordable groceries? Green Basket Market is now open on Maple Avenue! This week only, all fruits, vegetables, and baked goods are twenty percent off. Our friendly staff, convenient parking, and free home delivery make shopping easy. Visit Green Basket Market today and see why our neighbors keep coming back.",
  ),
  readAloud(
    "Thank you for calling Riverside Dental Clinic. Our office is open Monday through Friday from nine a.m. to six p.m., and on Saturdays until one p.m. To make or change an appointment, please press one. For billing questions, press two. If this is an emergency, please stay on the line, and a member of our staff will be with you shortly.",
  ),
  readAloud(
    "Good evening, passengers, and welcome aboard the express train to Busan. Our first stop will be Daejeon, followed by Dongdaegu. Food, drinks, and snacks are available in car number five. Please keep your luggage on the overhead racks, and remember to set your phones to silent mode. We hope you have a pleasant and relaxing trip.",
  ),
];

// Part 2 사진은 코드로 그린 장면이라 지금은 하나다 (CafeteriaScene.tsx)
const PART2: ToeicSpeakingItem[] = [
  {
    part: 2,
    name: "사진 묘사하기",
    directions: DIRECTIONS[2],
    prompt: "Describe the picture in as much detail as you can.",
    picture: "cafeteria",
    phases: [
      { kind: "prep", sec: 45 },
      { kind: "speak", sec: 30 },
    ],
  },
];

const PART3 = [
  answer(
    "Imagine that a marketing firm is doing research on campus dining. You have agreed to participate in a telephone interview.",
    "If a new café opened on your campus, what would make you want to visit it often? Why?",
  ),
  answer(
    "Imagine that a marketing firm is doing research in your area. You have agreed to participate in a telephone interview about smartphones.",
    "When you buy a new smartphone, what is the most important thing you consider, such as price, camera, or battery life? Why?",
  ),
  answer(
    "Imagine that a friend is moving to your neighborhood. You are having a telephone conversation about your area.",
    "What is the best way to get around in your neighborhood, and how long does it usually take to get downtown?",
  ),
  answer(
    "Imagine that a local newspaper is doing research on reading habits. You have agreed to participate in a telephone interview.",
    "Do you prefer reading books on paper or on an electronic device? Why?",
  ),
];

const PART4 = [
  info(
    {
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
    "Hi, I'm interested in the career fair.",
    "I heard there are sessions about job interviews. Could you tell me about all the sessions related to interviews?",
  ),
  info(
    {
      title: "Hanbit Library Book Club — Room 204, Spring Season",
      rows: [
        { time: "Mar 7, 7:00 p.m.", session: "Novel: The Silent River", speaker: "Grace Kim" },
        { time: "Mar 21, 7:00 p.m.", session: "Essays: Small Days", speaker: "Tom Rivera" },
        { time: "Apr 4, 7:00 p.m.", session: "Author Talk (online)", speaker: "Hana Yoo" },
        { time: "Apr 18, 7:00 p.m.", session: "Novel: Winter Garden", speaker: "Grace Kim" },
      ],
    },
    "Hello, I'm thinking about joining the book club this spring.",
    "Which meetings is Grace Kim leading, and when are they?",
  ),
  info(
    {
      title: "Bright Tech Co. — New Employee Orientation, Monday, June 2",
      rows: [
        { time: "9:00 – 9:30", session: "Welcome and Company Overview", speaker: "Paul Han, CEO" },
        { time: "9:30 – 10:30", session: "Security and Computer Setup", speaker: "IT Team" },
        { time: "10:45 – 12:00", session: "Team Introductions", speaker: "Department Heads" },
        { time: "12:00 – 1:00", session: "Lunch (Cafeteria, 3rd floor)", speaker: "" },
        { time: "1:00 – 2:30", session: "Benefits and Payroll", speaker: "HR Team" },
      ],
    },
    "Hi, I'm a new employee starting next week.",
    "What will happen in the afternoon, and where will we have lunch?",
  ),
];

const PART5 = [
  opinion(
    "University students should be required to take at least one online course before graduating.",
  ),
  opinion("It is better to work for a large company than a small company."),
  opinion("Students learn more effectively in groups than by studying alone."),
  opinion("Companies should allow employees to work from home at least two days a week."),
];

function pick<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

// 시험 한 번에 Part 1~5에서 한 문제씩
export function buildToeicExam(): ToeicSpeakingItem[] {
  return [pick(PART1), pick(PART2), pick(PART3), pick(PART4), pick(PART5)];
}

// 서버가 만든 문제(POST /api/questions) → 시험 문항. 시간·안내문은 Part 번호로 프론트가 정한다 (docs/api.md 6절)
export function toeicItemFromServer(q: Question): ToeicSpeakingItem {
  const base: ToeicSpeakingItem =
    q.part === 1
      ? readAloud(q.context ?? q.text)
      : q.part === 2
        ? { ...PART2[0], pictureReq: q.picture }
        : q.part === 3
          ? answer(q.context ?? "", q.text)
          : q.part === 4 && q.schedule
            ? { ...info(q.schedule, "", q.text), listenText: q.text }
            : { ...opinion(""), prompt: q.text, listenText: q.text };
  // Part 2는 어떤 사진을 낼지 정해진 뒤에 prompt를 고른다. 그 전까지는 기본 사진용
  return {
    ...base,
    serverPrompt: q.part === 2 ? (q.picture?.fallback.prompt ?? q.prompt) : q.prompt,
  };
}

// 백엔드(LLM)에 넘길 질문 문장. 사진·자료처럼 화면에만 있는 정보도 글로 풀어 넣는다
export function toeicSpeakingQuestionText(item: ToeicSpeakingItem) {
  if (item.serverPrompt) return item.serverPrompt;
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
  // 시간이 끝나도 녹음은 계속되므로, 제한 시간을 넘긴 부분을 구분할 수 있게 알려 준다
  const speak = item.phases.find((ph) => ph.kind === "speak");
  if (speak && "sec" in speak)
    parts.push(`Answer time limit: ${speak.sec} seconds (recording continues after the limit)`);
  return parts.join("\n");
}
