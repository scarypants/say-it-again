import { OPIC_HARD_LEVEL } from '../config';
import { requestFollowUps, requestOpicQuestions, requestToeicQuestions, type FollowUpOutput } from '../llm/requests';
import type {
  FollowUpQuestionsRequest,
  InitialQuestionsRequest,
  OpicTopic,
  Question,
  QuestionsRequest,
  QuestionsResponse,
  QuestionType,
} from '../types/api';
import { generateInterviewQuestions } from './interview';

// 질문 생성 (docs/api.md 6절). 질문 문자열(prompt)의 형식은 7절, 지금까지 프론트가 만들던 형식과 같다.

/** POST /api/questions: kind·mode에 따라 처음 질문 또는 꼬리질문을 만든다. */
export async function generateQuestions(input: QuestionsRequest): Promise<QuestionsResponse> {
  return input.kind === 'initial' ? initialQuestions(input) : followUpQuestions(input);
}

/** LLM 실패: 빈 목록 + llm_failed (면접 처음 질문만 기본 질문이 있다) */
function failed(base: Omit<QuestionsResponse, 'questions'>, err: unknown, what: string): QuestionsResponse {
  console.error(`[llm] ${what} 실패`, err);
  return { ...base, questions: [], warnings: ['llm_failed'] };
}

async function initialQuestions(input: InitialQuestionsRequest): Promise<QuestionsResponse> {
  if (input.mode === 'interview') return interviewInitial(input.language, input.job);

  const base = { kind: 'initial' as const, mode: input.mode, language: input.language, exam: input.exam };
  try {
    const questions =
      input.exam === 'opic' ? await opicInitial(input.opic.topics, input.opic.level) : await toeicInitial();
    return { ...base, questions };
  } catch (err) {
    return failed(base, err, `${input.exam} 처음 질문 생성`);
  }
}

// ---- 면접 ----

const INTERVIEW_TYPE_EN: Record<string, string> = {
  intro: 'Self-introduction',
  motivation: 'Motivation',
  job: 'Job knowledge',
  experience: 'Past experience (STAR)',
  closing: 'Closing',
};

/** 면접 처음 질문: 기존 질문 생성(실패 시 기본 질문)에 prompt만 붙인다 */
async function interviewInitial(language: 'ko' | 'en', job: string): Promise<QuestionsResponse> {
  const res = await generateInterviewQuestions({ language, job });
  return {
    kind: 'initial',
    mode: 'interview',
    language,
    job: res.job,
    questions: res.questions.map((q, i) => ({
      ...q,
      prompt: `Interview Q${i + 1} (${INTERVIEW_TYPE_EN[q.type]})\nJob: ${res.job}\nQuestion: ${q.text}`,
    })),
    ...(res.warnings && { warnings: res.warnings }),
  };
}

// ---- 토익 스피킹 ----

const TOEIC_NAME = { 1: '지문 읽기', 2: '사진 묘사하기', 3: '질문에 답하기', 4: '정보 보고 답하기', 5: '의견 제시하기' } as const;
const TOEIC_SPEAK_SEC = { 1: 45, 2: 30, 3: 30, 4: 30, 5: 60 } as const;
type ToeicPart = keyof typeof TOEIC_NAME;

const READ_ALOUD_TEXT = 'Read the text on the screen aloud.';
const PICTURE_QUESTION = 'Describe the picture in as much detail as you can.';
/** 프론트 기본 사진(CafeteriaScene.tsx)의 설명. 프론트가 지금까지 보내던 문장과 같다 */
const CAFETERIA_SCENE =
  'a campus cafeteria. A staff member behind the counter hands a cup of coffee to a student in a red shirt. A menu board hangs above the counter. At a table on the right, one student works on a laptop and another reads a book with a coffee cup. Trees are visible through the window, and there is a potted plant.';

/** 매번 다른 문항이 나오도록 LLM에 주는 주제 힌트 (무작위 하나) */
const TOEIC_THEMES = [
  'campus library', 'local grocery store', 'train travel', 'dental clinic', 'fitness center', 'career fair',
  'art museum', 'community festival', 'coffee shop', 'online shopping', 'public transportation', 'hotel stay',
  'music concert', 'job training workshop', 'apartment move', 'restaurant opening',
];

/** 토익 질문 문자열: 머리말 → 자료 줄 → 지문/질문 → 답변 시간 (프론트 toeicSpeakingQuestionText와 같은 형식) */
function toeicPrompt(part: ToeicPart, lines: string[]): string {
  return [
    `TOEIC Speaking Part ${part} (${TOEIC_NAME[part]})`,
    ...lines,
    `Answer time limit: ${TOEIC_SPEAK_SEC[part]} seconds (recording continues after the limit)`,
  ].join('\n');
}

const opinionText = (statement: string) =>
  `Do you agree or disagree with the following statement? ${statement} Use specific reasons and examples to support your answer.`;

/** 비어 있으면 실패로 본다 (질문 하나라도 비면 시험이 성립하지 않으므로 전체를 llm_failed로) */
function required(value: string | undefined, what: string): string {
  const v = value?.trim();
  if (!v) throw new Error(`LLM 응답에 ${what}이(가) 비어 있습니다.`);
  return v;
}

async function toeicInitial(): Promise<Question[]> {
  const out = await requestToeicQuestions(pick(TOEIC_THEMES));
  const passage = required(out.part1?.passage, 'Part 1 지문');
  const scene = out.part2?.scene?.trim() || CAFETERIA_SCENE; // 장면 설명이 비면 기본 사진 장면으로 생성
  const situation = required(out.part3?.situation, 'Part 3 상황');
  const p3 = required(out.part3?.question, 'Part 3 질문');
  const title = required(out.part4?.title, 'Part 4 제목');
  const rows = (out.part4?.rows ?? []).filter((r) => r.time?.trim() && r.session?.trim());
  if (rows.length === 0) throw new Error('LLM 응답에 Part 4 일정표가 비어 있습니다.');
  const p4 = required(out.part4?.question, 'Part 4 질문');
  const p5 = opinionText(required(out.part5?.statement, 'Part 5 진술'));

  const schedule = rows.map((r) => `${r.time} ${r.session}${r.speaker ? ` (${r.speaker})` : ''}`).join('; ');
  const picturePrompt = (desc: string) => toeicPrompt(2, [`Picture: ${desc}`, `Question: ${PICTURE_QUESTION}`]);

  return [
    {
      type: 'readAloud',
      part: 1,
      text: READ_ALOUD_TEXT,
      context: passage,
      prompt: toeicPrompt(1, [`Text to read aloud: ${passage}`]),
    },
    {
      type: 'describePicture',
      part: 2,
      text: PICTURE_QUESTION,
      prompt: picturePrompt(scene),
      picture: {
        scene,
        prompt: picturePrompt(scene),
        fallback: { id: 'cafeteria', prompt: picturePrompt(CAFETERIA_SCENE) },
      },
    },
    {
      type: 'respond',
      part: 3,
      text: p3,
      context: situation,
      prompt: toeicPrompt(3, [`Situation: ${situation}`, `Question: ${p3}`]),
    },
    {
      type: 'information',
      part: 4,
      text: p4,
      schedule: { title, rows },
      prompt: toeicPrompt(4, [`Information: ${title}. ${schedule}`, `Question: ${p4}`]),
    },
    { type: 'opinion', part: 5, text: p5, prompt: toeicPrompt(5, [`Question: ${p5}`]) },
  ];
}

// ---- 오픽 ----

const OPIC_TYPE_EN: Record<string, string> = {
  intro: 'Self-introduction',
  description: 'Description',
  routine: 'Routine',
  experience: 'Past experience',
  rolePlayAsk: 'Role-play: ask the interviewer 3-4 questions',
  rolePlaySolve: 'Role-play: explain the problem and suggest alternatives',
};

/** 오픽 질문 문자열 (프론트 opicQuestionText와 같은 형식) */
function opicPrompt(index: number, type: QuestionType, level: number, text: string, topic?: OpicTopic): string {
  const head = `OPIc Q${index + 1} (${OPIC_TYPE_EN[type]}${topic ? `, topic: ${topic.id}` : ''})`;
  return `${head}\nSelf-assessment level: ${level}\nQuestion: ${text}`;
}

/** 자기소개 → 묘사·루틴·경험(같은 주제) → 롤플레이(다른 주제가 있으면 다른 주제). 단계가 높으면 문제 해결형 */
async function opicInitial(topics: OpicTopic[], level: number): Promise<Question[]> {
  const topic = pick(topics);
  const others = topics.filter((t) => t.id !== topic.id);
  const rolePlayTopic = others.length > 0 ? pick(others) : topic;
  const solve = level >= OPIC_HARD_LEVEL;

  const out = await requestOpicQuestions(topic.label, rolePlayTopic.label, level, solve);
  const items: { type: QuestionType; text: string; topic?: OpicTopic }[] = [
    { type: 'intro', text: required(out.intro, '자기소개 질문') },
    { type: 'description', text: required(out.description, '묘사 질문'), topic },
    { type: 'routine', text: required(out.routine, '루틴 질문'), topic },
    { type: 'experience', text: required(out.experience, '경험 질문'), topic },
    { type: solve ? 'rolePlaySolve' : 'rolePlayAsk', text: required(out.rolePlay, '롤플레이 질문'), topic: rolePlayTopic },
  ];
  return items.map((q, i) => ({ ...q, prompt: opicPrompt(i, q.type, level, q.text, q.topic) }));
}

// ---- 꼬리질문 ----

/** 모드(스피킹은 시험)별로 LLM이 쓸 수 있는 type */
const FOLLOW_UP_TYPES: Record<string, QuestionType[]> = {
  presentation: ['expected'],
  'TOEIC-Speaking': ['respond', 'opinion'],
  opic: ['followUp'],
  interview: ['followUp'],
};

async function followUpQuestions(input: FollowUpQuestionsRequest): Promise<QuestionsResponse> {
  const base = {
    kind: 'followUp' as const,
    mode: input.mode,
    language: input.language,
    ...(input.exam && { exam: input.exam }),
    ...(input.job && { job: input.job }),
  };
  const key = input.mode === 'speaking' ? (input.exam ?? 'opic') : input.mode;
  const types = FOLLOW_UP_TYPES[key];

  let out: FollowUpOutput;
  try {
    out = await requestFollowUps(input, types);
  } catch (err) {
    return failed(base, err, '꼬리질문 생성');
  }

  // 빈 질문, 허용하지 않은 type, 이미 받은 질문·중복은 버리고 count개까지
  const seen = new Set(input.asked.map((q) => q.trim()));
  const picked = (out.questions ?? []).filter((q) => {
    const t = q.text?.trim();
    if (!t || !types.includes(q.type as QuestionType) || seen.has(t)) return false;
    if (q.type === 'respond' && !q.situation?.trim()) return false; // 토익 Part 3은 상황이 있어야 한다
    seen.add(t);
    return true;
  });
  const questions = picked.slice(0, input.count).map((q, i) => toFollowUp(input, q, i));
  if (questions.length === 0) return failed(base, new Error('쓸 수 있는 꼬리질문이 없습니다.'), '꼬리질문 생성');
  return { ...base, questions };
}

function toFollowUp(input: FollowUpQuestionsRequest, q: FollowUpOutput['questions'][number], i: number): Question {
  const text = q.text.trim();
  const hint = q.hint?.trim() || undefined;
  const about = Number.isInteger(q.about) && q.about >= 0 && q.about < input.answers.length ? q.about : undefined;
  const n = i + 1;
  const extra = { ...(hint && { hint }), ...(about !== undefined && { about }) };

  if (input.mode === 'presentation') {
    return { type: 'expected', text, prompt: `Presentation Q&A ${n}\nQuestion: ${text}`, ...extra };
  }
  if (input.mode === 'interview') {
    const head = `Interview Follow-up ${n}${about !== undefined ? ` (about Q${about + 1})` : ''}`;
    const prompt = [head, input.job ? `Job: ${input.job}` : '', `Question: ${text}`].filter(Boolean).join('\n');
    return { type: 'followUp', text, prompt, ...extra };
  }
  if (input.exam === 'TOEIC-Speaking') {
    if (q.type === 'opinion') {
      const p5 = opinionText(text);
      return { type: 'opinion', part: 5, text: p5, prompt: toeicPrompt(5, [`Question: ${p5}`]), ...extra };
    }
    const situation = q.situation.trim();
    return {
      type: 'respond',
      part: 3,
      text,
      context: situation,
      prompt: toeicPrompt(3, [`Situation: ${situation}`, `Question: ${text}`]),
      ...extra,
    };
  }
  // 오픽: 이어지는 답변의 질문 문자열에 주제 id가 있으면 머리말에 넣는다
  const question = about !== undefined ? (input.answers[about].question ?? '') : '';
  const topicId = /topic: ([^),\n]+)/.exec(question)?.[1]?.trim();
  const head = `OPIc Follow-up ${n}${topicId ? ` (topic: ${topicId})` : ''}`;
  return { type: 'followUp', text, prompt: `${head}\nQuestion: ${text}`, ...extra };
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}
