import { LLM_MODEL, LLM_REASONING_EFFORT, LLM_TIMEOUT_MS, MAX_EXPRESSIONS } from '../config';
import { getOpenAI } from '../openai';
import type { Analysis, Highlight, Line, Part } from '../types/api';
import type { AnalyzeInput, LlmPartResult } from '../types/internal';
import { partMessages, summaryMessages } from './prompts';

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

type PartOutput = {
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

// 파트 하나에 대해 패닉 원인·대안, expression / grammar 하이라이트, 최종 대본, 코멘트를 받는다.
// LLM의 줄·단어 번호는 파트 전체 단어 번호(offset 기준)로 바꾸고, 범위를 벗어나면 버린다.
export async function analyzePart(input: AnalyzeInput, script: Line[], partIndex: number): Promise<LlmPartResult> {
  const out = await callJson<PartOutput>('part_analysis', PART_SCHEMA, partMessages(input, script, partIndex));

  const highlight: Highlight[] = [];
  let expressions = 0;
  for (const issue of out.issues) {
    const line = script[issue.line];
    if (!line || line.pause || issue.from < 0 || issue.to < issue.from || issue.to >= line.words.length) continue;
    if (issue.category === 'grammar' && input.mode !== 'speaking') continue;
    if (issue.category === 'expression' && ++expressions > MAX_EXPRESSIONS) continue;
    highlight.push({
      from: line.offset + issue.from,
      to: line.offset + issue.to,
      category: issue.category,
      reason: issue.reason,
      fixed: issue.fixed,
    });
  }

  const panicNotes = new Map(
    out.panics.filter((p) => script[p.line]?.pause).map((p) => [p.line, { reason: p.reason, fixed: p.fixed }]),
  );

  return {
    highlight,
    panicNotes,
    final: out.final
      .map((sentence) => ({ words: sentence.trim().split(/\s+/).filter(Boolean) }))
      .filter((s) => s.words.length > 0),
    comment: out.comment || undefined,
  };
}

// 파트별 결과의 요약본으로 전체 총평(summary)을 받는다.
export async function summarize(input: AnalyzeInput, parts: Part[]): Promise<Analysis['summary']> {
  const out = await callJson<Analysis['summary']>('summary', SUMMARY_SCHEMA, summaryMessages(input, parts));
  return { headline: out.headline, topPriorities: out.topPriorities.slice(0, 3), comment: out.comment };
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
