import { LLM_MODEL, LLM_REASONING_EFFORT, LLM_TIMEOUT_MS, MAX_EXPRESSIONS, MOCK_LLM } from '../config';
import { mockDelay, readFixture } from '../mock';
import { checksGrammar } from '../modes';
import { toScreenTerms } from '../text';
import { getOpenAI } from '../openai';
import type {
  Analysis,
  Charts,
  Compare,
  FollowUpQuestionsRequest,
  Highlight,
  Language,
  Line,
  Part,
  Retry,
  ToeicSchedule,
} from '../types/api';
import type { AnalyzeInput, LlmPartResult, RetryInput } from '../types/internal';
import {
  followUpMessages,
  interviewQuestionMessages,
  opicQuestionMessages,
  partMessages,
  retryMessages,
  summaryMessages,
  toeicQuestionMessages,
} from './prompts';

// ---- 응답 JSON schema (Structured Outputs, strict) ----

const PART_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['panics', 'issues', 'final', 'comment'],
  properties: {
    panics: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['line', 'reason', 'fixed'],
        properties: { line: { type: 'integer' }, reason: { type: 'string' }, fixed: { type: 'string' } },
      },
    },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['line', 'from', 'to', 'category', 'reason', 'fixed'],
        properties: {
          line: { type: 'integer' },
          from: { type: 'integer' },
          to: { type: 'integer' },
          category: { type: 'string', enum: ['expression', 'grammar'] },
          reason: { type: 'string' },
          fixed: { type: 'string' },
        },
      },
    },
    final: { type: 'array', items: { type: 'string' } },
    comment: { type: 'string' },
  },
};

export type PartOutput = {
  panics: { line: number; reason: string; fixed: string }[];
  issues: { line: number; from: number; to: number; category: 'expression' | 'grammar'; reason: string; fixed: string }[];
  final: string[];
  comment: string;
};

const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'topPriorities', 'comment'],
  properties: {
    headline: { type: 'string' },
    topPriorities: { type: 'array', items: { type: 'string' } },
    comment: { type: 'string' },
  },
};

const RETRY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['improved', 'remaining', 'comment'],
  properties: {
    improved: { type: 'array', items: { type: 'string' } },
    remaining: { type: 'array', items: { type: 'string' } },
    comment: { type: 'string' },
  },
};

/** 면접 질문 5개. 유형마다 필드를 따로 두어 5개·순서를 schema로 보장한다 */
const QUESTIONS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['intro', 'motivation', 'job', 'experience', 'closing'],
  properties: {
    intro: { type: 'string' },
    motivation: { type: 'string' },
    job: { type: 'string' },
    experience: { type: 'string' },
    closing: { type: 'string' },
  },
};

export type InterviewQuestionsOutput = Record<'intro' | 'motivation' | 'job' | 'experience' | 'closing', string>;

/**
 * 파트 하나에 대해 패닉 원인·대안, expression / grammar 하이라이트, 최종 대본, 코멘트를 받는다.
 * LLM의 줄·단어 번호는 파트 전체 단어 번호(offset 기준)로 바꾸고, 범위를 벗어나면 버린다.
 */
export async function analyzePart(input: AnalyzeInput, script: Line[], partIndex: number): Promise<LlmPartResult> {
  const out = await requestPartOutput(input, script, partIndex);

  const highlight: Highlight[] = [];
  let expressions = 0;
  for (const issue of out.issues) {
    const line = script[issue.line];
    if (!line || line.pause || issue.from < 0 || issue.to < issue.from || issue.to >= line.words.length) continue;
    if (issue.category === 'grammar' && !checksGrammar(input)) continue;
    if (issue.category === 'expression' && ++expressions > MAX_EXPRESSIONS) continue;
    highlight.push({
      from: line.offset + issue.from,
      to: line.offset + issue.to,
      category: issue.category,
      reason: toScreenTerms(issue.reason),
      fixed: issue.fixed,
    });
  }

  const panicNotes = new Map(
    out.panics.filter((p) => script[p.line]?.pause).map((p) => [p.line, { reason: toScreenTerms(p.reason), fixed: p.fixed }]),
  );

  return {
    highlight,
    panicNotes,
    final: out.final
      .map((sentence) => ({ words: sentence.trim().split(/\s+/).filter(Boolean) }))
      .filter((s) => s.words.length > 0),
    comment: toScreenTerms(out.comment) || undefined,
  };
}

/** 파트별 결과의 요약본으로 전체 총평(summary)을 받는다. */
export async function summarize(input: AnalyzeInput, parts: Part[]): Promise<Analysis['summary']> {
  const out = await requestSummaryOutput(input, parts);
  return {
    headline: toScreenTerms(out.headline),
    topPriorities: out.topPriorities.slice(0, 3).map(toScreenTerms),
    comment: toScreenTerms(out.comment),
  };
}

/** 재도전 총평: 전후 비교 수치로 개선된 점·남은 점·한 줄 총평을 받는다. mock 모드에서는 저장된 응답을 쓴다. */
export async function summarizeRetry(
  input: RetryInput,
  parts: Part[],
  charts: Charts,
  compare: Compare,
  mismatch: boolean,
): Promise<Retry> {
  const out = MOCK_LLM
    ? await mockDelay(500).then(() => readFixture<Retry>(`llm-retry-${input.language}.json`))
    : await callJson<Retry>('retry_summary', RETRY_SCHEMA, retryMessages(input, parts, charts, compare, mismatch));
  return {
    improved: out.improved.slice(0, 3).map(toScreenTerms),
    remaining: out.remaining.slice(0, 3).map(toScreenTerms),
    comment: toScreenTerms(out.comment),
  };
}

// ---- 질문 생성 (POST /api/questions) ----

const text = { type: 'string' } as const;
const obj = (props: Record<string, object>) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(props),
  properties: props,
});

const TOEIC_SCHEMA = obj({
  part1: obj({ passage: text }),
  part2: obj({ scene: text }),
  part3: obj({ situation: text, question: text }),
  part4: obj({
    title: text,
    rows: { type: 'array', items: obj({ time: text, session: text, speaker: text }) },
    question: text,
  }),
  part5: obj({ statement: text }),
});

export type ToeicOutput = {
  part1: { passage: string };
  part2: { scene: string };
  part3: { situation: string; question: string };
  part4: ToeicSchedule & { question: string };
  part5: { statement: string };
};

const OPIC_SCHEMA = obj({ intro: text, description: text, routine: text, experience: text, rolePlay: text });

export type OpicOutput = Record<'intro' | 'description' | 'routine' | 'experience' | 'rolePlay', string>;

/** 꼬리질문: type은 모드별로 허용하는 값만 (enum) */
const followUpSchema = (types: string[]) =>
  obj({
    questions: {
      type: 'array',
      items: obj({ type: { type: 'string', enum: types }, text, hint: text, about: { type: 'integer' }, situation: text }),
    },
  });

export type FollowUpOutput = {
  questions: { type: string; text: string; hint: string; about: number; situation: string }[];
};

/** 토익 처음 질문 원본 응답. mock 모드에서는 fixtures/llm-questions-toeic.json */
export async function requestToeicQuestions(theme: string): Promise<ToeicOutput> {
  if (MOCK_LLM) {
    await mockDelay(800);
    return readFixture<ToeicOutput>('llm-questions-toeic.json');
  }
  return callJson<ToeicOutput>('toeic_questions', TOEIC_SCHEMA, toeicQuestionMessages(theme));
}

/** 오픽 처음 질문 원본 응답. mock 모드에서는 fixtures/llm-questions-opic.json */
export async function requestOpicQuestions(
  topic: string,
  rolePlayTopic: string,
  level: number,
  solve: boolean,
): Promise<OpicOutput> {
  if (MOCK_LLM) {
    await mockDelay(800);
    return readFixture<OpicOutput>('llm-questions-opic.json');
  }
  return callJson<OpicOutput>('opic_questions', OPIC_SCHEMA, opicQuestionMessages(topic, rolePlayTopic, level, solve));
}

/** 꼬리질문 원본 응답. mock 모드에서는 fixtures/llm-followup-{mode 또는 exam}.json */
export async function requestFollowUps(input: FollowUpQuestionsRequest, types: string[]): Promise<FollowUpOutput> {
  if (MOCK_LLM) {
    await mockDelay(800);
    const key = input.mode === 'speaking' ? (input.exam ?? 'opic') : input.mode;
    return readFixture<FollowUpOutput>(`llm-followup-${key}.json`);
  }
  return callJson<FollowUpOutput>('follow_up_questions', followUpSchema(types), followUpMessages(input));
}

/**
 * 면접 질문 생성 원본 응답. mock 모드에서는 저장된 질문(fixtures/llm-questions-*.json)의 {job}을 직무로 바꿔 돌려준다.
 */
export async function requestInterviewQuestions(language: Language, job: string): Promise<InterviewQuestionsOutput> {
  if (MOCK_LLM) {
    await mockDelay(800);
    const fixture = await readFixture<InterviewQuestionsOutput>(`llm-questions-${language}.json`);
    return Object.fromEntries(
      Object.entries(fixture).map(([key, text]) => [key, text.replaceAll('{job}', job)]),
    ) as InterviewQuestionsOutput;
  }
  return callJson<InterviewQuestionsOutput>('interview_questions', QUESTIONS_SCHEMA, interviewQuestionMessages(language, job));
}

/**
 * LLM 원본 응답. mock 모드에서는 언어별로 저장된 응답(fixtures/llm-*.json)을 돌려준다.
 * 저장된 응답의 줄·단어 번호가 지금 대본과 안 맞으면 analyzePart에서 범위 밖으로 걸러진다.
 */
export async function requestPartOutput(input: AnalyzeInput, script: Line[], partIndex: number): Promise<PartOutput> {
  if (MOCK_LLM) {
    await mockDelay(1500);
    // 한국어 저장 응답은 발표용이라 코멘트가 없어서, 한국어 면접은 코멘트가 있는 면접용을 쓴다
    const file = input.mode === 'interview' && input.language === 'ko' ? 'llm-part-interview-ko.json' : `llm-part-${input.language}.json`;
    return readFixture<PartOutput>(file);
  }
  return callJson<PartOutput>('part_analysis', PART_SCHEMA, partMessages(input, script, partIndex));
}

export async function requestSummaryOutput(input: AnalyzeInput, parts: Part[]): Promise<Analysis['summary']> {
  if (MOCK_LLM) {
    await mockDelay(500);
    return readFixture<Analysis['summary']>(`llm-summary-${input.language}.json`);
  }
  return callJson<Analysis['summary']>('summary', SUMMARY_SCHEMA, summaryMessages(input, parts));
}

async function callJson<T>(name: string, schema: object, messages: { system: string; user: string }): Promise<T> {
  if (!LLM_MODEL) throw new Error('OPENAI_LLM_MODEL이 설정되지 않았습니다.');
  const res = await getOpenAI().chat.completions.create(
    {
      model: LLM_MODEL,
      reasoning_effort: LLM_REASONING_EFFORT,
      messages: [
        { role: 'system', content: messages.system },
        { role: 'user', content: messages.user },
      ],
      response_format: { type: 'json_schema', json_schema: { name, strict: true, schema: schema as Record<string, unknown> } },
    },
    { timeout: LLM_TIMEOUT_MS },
  );
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error(`LLM 응답이 비어 있습니다 (${name}).`);
  return JSON.parse(content) as T;
}
