import { MAX_EXPRESSIONS } from '../config';
import type { Charts, Compare, Level, Line, Part } from '../types/api';
import type { AnalyzeInput, RetryInput } from '../types/internal';

// LLM 프롬프트를 만드는 곳. 모드·level·시험별 지시문은 여기서만 바꾼다.

const LEVEL_LABEL: Record<Level, string> = {
  assignment: '수업 과제 발표',
  exam: '시험(평가) 발표',
  keynote: '많은 청중 앞의 큰 강연',
};

const EXAM_LABEL = { 'TOEIC-Speaking': '토익 스피킹(TOEIC Speaking)', opic: '오픽(OPIc)' } as const;

/** 번호 붙은 스크립트 입력. 예) "[0] 0:오늘은 1:음 2:캠퍼스" / "[1] (침묵 3.2초)" */
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

/** 파트 하나 분석 (패닉 원인·대안, 표현 개선, 문법, 최종 대본, 코멘트) */
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
    ...(speaking
      ? [
          '   문법 오류(시제, 주어·동사 수 일치, 관사, 전치사, 어순 등)는 하나도 빠뜨리지 말고 모두 grammar로 표시한다.',
          '   final에서 고친 문법 오류는 반드시 issues에도 grammar로 있어야 한다.',
        ]
      : []),
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

/** 총평: 파트별 요약만 받아 전체 총평을 쓴다 (원문 전체를 다시 넣지 않는다) */
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

/** 재도전 총평: 전후 수치와 새 녹음의 패닉존 문맥만 받아 개선된 점·남은 점을 쓴다 (코드가 찾은 것만 근거로) */
export function retryMessages(input: RetryInput, parts: Part[], charts: Charts, compare: Compare, mismatch: boolean) {
  const system = [
    '너는 대학생의 말하기 연습을 돕는 코치다. 같은 발표를 다시 녹음한 재도전 결과를 이전 결과와 비교해 짧게 총평한다.',
    '비교 항목은 코드가 찾은 패닉존(2초 이상 멈춤), 필러(군말), 중복 단어, 말 속도뿐이다. 표현·문법은 이번에 분석하지 않았으므로 언급하지 않는다.',
    '녹음 길이가 다를 수 있으므로 횟수보다 분당 횟수와 점수를 기준으로 판단한다.',
    '',
    'improved: 실제로 좋아진 점 1~3개. 숫자를 넣어 구체적으로 쓴다 (예: "패닉존이 3번에서 1번으로 줄었어요"). 좋아진 점이 없으면 빈 배열.',
    'remaining: 아직 고칠 점 1~3개. 새 녹음의 패닉존 문맥이 있으면 어느 부분에서 멈췄는지 짚는다. 이전 우선 과제 중 패닉존·필러·중복에 관한 것이 아직 남았으면 포함한다 (표현·문법 과제는 판단할 수 없으므로 넣지 않는다).',
    'comment: 재도전 전체를 한 문장으로 평가.',
    mismatch
      ? '이번 녹음은 이전 최종 대본과 내용이 많이 다르다. "대본을 따라서" 같은 표현을 쓰지 말고, 내용이 달라 비교는 참고용이라는 점을 comment에 짧게 밝힌다.'
      : '',
    '모두 한국어로, 해요체로 쓴다.',
  ]
    .filter(Boolean)
    .join('\n');

  const { before, after, scriptMatch } = compare;
  const row = (label: string, b: number, a: number, unit = '') => `- ${label}: ${b}${unit} → ${a}${unit}`;
  const numbers = [
    row('점수(패닉·필러·중복 기준)', before.score, after.score, '점'),
    row('녹음 길이', before.durationSec, after.durationSec, '초'),
    row('말 속도', before.wpm, after.wpm, '단어/분'),
    row('패닉존', before.panicCount, after.panicCount, '회') + ` (총 ${before.panicTotalSec}초 → ${after.panicTotalSec}초, 분당 ${before.panicPerMin} → ${after.panicPerMin})`,
    row('필러', before.fillerCount, after.fillerCount, '회') + ` (분당 ${before.fillerPerMin} → ${after.fillerPerMin})`,
    row('중복 단어', before.repeatCount, after.repeatCount, '회') + ` (분당 ${before.repeatPerMin} → ${after.repeatPerMin})`,
    scriptMatch === null ? '' : `- 이전 최종 대본과의 일치율: ${scriptMatch}%`,
  ].filter(Boolean);

  // 새 녹음의 패닉존: pause 직전 문장 + 정지 시간 (최대 6개)
  const panics = parts
    .flatMap((part) =>
      part.script.flatMap((line, i) => {
        if (!line.pause) return [];
        const prev = part.script
          .slice(0, i)
          .reverse()
          .find((l) => l.words.length > 0);
        return prev ? [`- "${prev.words.join(' ')}" 다음에 ${(line.end - line.start).toFixed(1)}초 멈춤`] : [];
      }),
    )
    .slice(0, 6);
  const top = (list: { word: string; count: number }[]) =>
    list.slice(0, 5).map((t) => `${t.word}(${t.count})`).join(', ') || '없음';

  const head =
    input.mode === 'presentation'
      ? `상황: ${input.level ? LEVEL_LABEL[input.level] : '발표'} 재도전 (${input.language === 'ko' ? '한국어' : '영어'})`
      : `상황: ${input.exam ? EXAM_LABEL[input.exam] : '영어 말하기 시험'} 답변 재도전`;
  const user = [
    head,
    '',
    '이전 → 이번:',
    ...numbers,
    '',
    `이전 우선 과제: ${input.previous.topPriorities.join(' / ') || '없음'}`,
    '',
    '이번 녹음의 패닉존:',
    ...(panics.length > 0 ? panics : ['- 없음']),
    '',
    `이번 필러: ${top(charts.fillerTop)}`,
    `이번 중복 단어: ${top(charts.repeatTop)}`,
  ].join('\n');
  return { system, user };
}
