import { MAX_EXPRESSIONS } from '../config';
import type { Level, Line, Part } from '../types/api';
import type { AnalyzeInput } from '../types/internal';

// LLM 프롬프트를 만드는 곳. 모드·level·시험별 지시문은 여기서만 바꾼다.

const LEVEL_LABEL: Record<Level, string> = {
  assignment: '수업 과제 발표',
  exam: '시험(평가) 발표',
  keynote: '많은 청중 앞의 큰 강연',
};

const EXAM_LABEL = { 'TOEIC-Speaking': '토익 스피킹(TOEIC Speaking)', opic: '오픽(OPIc)' } as const;

// 번호 붙은 스크립트 입력. 예) "[0] 0:오늘은 1:음 2:캠퍼스" / "[1] (침묵 3.2초)"
export function numberedScript(script: Line[]): string {
  return script
    .map((line, i) =>
      line.pause
        ? `[${i}] (침묵 ${(line.end - line.start).toFixed(1)}초)`
        : `[${i}] ${line.words.map((w, j) => `${j}:${w}`).join(' ')}`,
    )
    .join('\n');
}

function situation(input: AnalyzeInput, partIndex: number): string {
  if (input.mode === 'presentation') {
    const level = input.level ? LEVEL_LABEL[input.level] : '발표';
    return `상황: ${level}. 발표 언어: ${input.language === 'ko' ? '한국어' : '영어'}. 녹음 ${partIndex + 1}번째 구간.`;
  }
  const exam = input.exam ? EXAM_LABEL[input.exam] : '영어 말하기 시험';
  const question = input.questions?.[partIndex] ?? '';
  return `상황: ${exam} 답변 연습 (영어). 아래 질문에 대한 답변이다.\n질문:\n${question}`;
}

// 파트 하나 분석 (패닉 원인·대안, 표현 개선, 문법, 최종 대본, 코멘트)
export function partMessages(input: AnalyzeInput, script: Line[], partIndex: number) {
  const speaking = input.mode === 'speaking';
  const system = [
    '너는 대학생의 말하기 연습을 돕는 코치다. 녹음을 전사한 대본을 보고 구체적이고 실천할 수 있는 피드백을 준다.',
    '대본은 문장마다 [줄 번호]가 있고, 각 단어 앞에 "단어 번호:"가 붙어 있다. "(침묵 N초)" 줄은 말하다 멈춘 구간(패닉존)이다.',
    '',
    '해야 할 일:',
    '1. panics: 침묵 줄마다 하나씩. line은 침묵 줄 번호. reason에 바로 앞 문장의 흐름을 보고 왜 막혔는지 진단하고, fixed에 막히지 않고 이어 말할 수 있는 대안 대본(1~2문장)을 쓴다.',
    `2. issues: 고치면 좋아질 표현을 영향이 큰 순서로 최대 ${MAX_EXPRESSIONS}개. line은 문장 줄 번호, from·to는 그 줄 안의 단어 번호(to 포함). category는 "expression"(모호·약한 표현, 문어체, 어색하거나 부정확한 어휘)` +
      (speaking ? ' 또는 "grammar"(문법 오류).' : '. 발표 모드이므로 grammar는 쓰지 않는다.') +
      ' fixed에는 그 범위를 대체할 표현을 쓴다.',
    '   범위(from~to)는 실제로 바꿔야 하는 단어만 최소로 잡는다 (보통 1~4단어). 문장이나 절 전체를 잡지 않는다.',
    '   필러(음, 어, 그러니까, um, uh 등)와 같은 단어 반복은 다른 단계에서 찾으므로 issues에 넣지 않는다.',
    '3. final: 대본 전체를 자연스럽게 다듬은 최종 대본을 문장 배열로 쓴다. 필러와 반복은 빼고, 내용과 순서는 유지한다.',
    '   토익 스피킹 Part 1(지문 읽기)처럼 주어진 글을 그대로 읽는 문제라면 final은 빈 배열로 둔다.',
    speaking
      ? '4. comment: 이 답변이 질문에 얼마나 맞게 답했는지, 시험 기준으로 한 줄 평가.'
      : '4. comment: 빈 문자열로 둔다.',
    '',
    `reason과 comment는 한국어로 쓴다. fixed와 final은 대본과 같은 언어(${input.language === 'ko' ? '한국어' : '영어'})로 쓴다.`,
    '번호는 반드시 입력에 있는 번호만 쓴다.',
  ].join('\n');

  const user = `${situation(input, partIndex)}\n\n대본:\n${numberedScript(script)}`;
  return { system, user };
}

// 총평: 파트별 요약만 받아 전체 총평을 쓴다 (원문 전체를 다시 넣지 않는다)
export function summaryMessages(input: AnalyzeInput, parts: Part[]) {
  const system = [
    '너는 대학생의 말하기 연습을 돕는 코치다. 여러 녹음 구간의 분석 요약을 보고 전체 총평을 쓴다.',
    'headline: 전체를 한 문장으로 평가. topPriorities: 가장 먼저 고칠 것 3개 (짧게, 구체적으로). comment: 상황(발표 성격 또는 시험)에 맞춘 조언 2~3문장.',
    '모두 한국어로 쓴다.',
  ].join('\n');

  const digest = parts.map((part, i) => {
    const count = (c: string) => part.highlight.filter((h) => h.category === c).length;
    const notes = part.highlight
      .filter((h) => h.reason && (h.category === 'panic' || h.category === 'expression' || h.category === 'grammar'))
      .slice(0, 6)
      .map((h) => `  - [${h.category}] ${h.reason}`)
      .join('\n');
    const words = part.script.reduce((n, l) => n + l.words.length, 0);
    return [
      `구간 ${i + 1}: 길이 ${Math.round(part.duration)}초, 단어 ${words}개, 필러 ${count('filler')}개, 패닉존 ${count('panic')}회, 표현 개선 ${count('expression')}개, 문법 ${count('grammar')}개`,
      part.comment ? `  코멘트: ${part.comment}` : '',
      notes,
    ]
      .filter(Boolean)
      .join('\n');
  });

  const head =
    input.mode === 'presentation'
      ? `상황: ${input.level ? LEVEL_LABEL[input.level] : '발표'} (${input.language === 'ko' ? '한국어' : '영어'})`
      : `상황: ${input.exam ? EXAM_LABEL[input.exam] : '영어 말하기 시험'} 답변 ${parts.length}개`;
  return { system, user: `${head}\n\n${digest.join('\n\n')}` };
}
