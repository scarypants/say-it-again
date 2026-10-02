import { ACCURACY_WEIGHT, LEAD_PANIC_SEC, PANIC_GAP, SPEAKING_PANIC_GAP } from './config';
import type { ModeInfo } from './types/internal';

// 모드별로 달라지는 분석 규칙 (여러 파일에서 같은 기준을 쓰도록 한곳에 둔다)

/** 문법(grammar) 하이라이트를 만드는 모드: 스피킹, 영어 면접 */
export function checksGrammar(info: Pick<ModeInfo, 'mode' | 'language'>): boolean {
  return info.mode === 'speaking' || (info.mode === 'interview' && info.language === 'en');
}

type QuestionInfo = Pick<ModeInfo, 'mode' | 'questions'>;

/** 질문에 답하는 경우: 스피킹, 면접, 발표 예상 질문 답변. 파트별 코멘트(parts[].comment)가 있다 */
export function answersQuestions(info: QuestionInfo): boolean {
  return info.mode === 'speaking' || info.mode === 'interview' || isPresentationQna(info);
}

/** 답변 정확성(parts[].accuracy)을 매기는 경우와 총점에서의 비중. 발표 본편은 undefined (습관 점수만) */
export function accuracyWeight(info: QuestionInfo): number | undefined {
  if (info.mode === 'speaking') return ACCURACY_WEIGHT.speaking;
  if (info.mode === 'interview' || isPresentationQna(info)) return ACCURACY_WEIGHT.interview;
  return undefined;
}

/** 줄 분할의 패닉존 기준: 멈춤(gap)과 첫마디 전 침묵(lead, 질문에 답하는 경우만) */
export function panicRule(info: QuestionInfo): { gap: number; lead?: number } {
  return {
    gap: info.mode === 'speaking' ? SPEAKING_PANIC_GAP : PANIC_GAP,
    ...(answersQuestions(info) && { lead: LEAD_PANIC_SEC }),
  };
}

/**
 * 발표 예상 질문 답변(발표 질의응답)인지: 발표 모드에 questions가 있으면 그렇다.
 * 예전 프론트처럼 면접 모드로 보내도 질문 머리말이 "Presentation Q&A N"이면 같게 본다.
 * 이때는 발표 본편·면접이 아니라 발표 질의응답 기준으로 평가한다.
 */
export function isPresentationQna(info: QuestionInfo): boolean {
  const questions = info.questions ?? [];
  if (info.mode === 'presentation') return questions.length > 0;
  return info.mode === 'interview' && questions.some((q) => q.startsWith('Presentation Q&A'));
}

/** 토익 Part 1(지문 읽기) 질문 문자열에서 읽을 지문을 꺼낸다 ("Text to read aloud: …" 줄). 아니면 undefined */
export function readAloudText(question: string | undefined): string | undefined {
  if (!question?.startsWith('TOEIC Speaking Part 1')) return undefined;
  return /^Text to read aloud:\s*(.+)$/m.exec(question)?.[1]?.trim() || undefined;
}

/** 면접 질문 문자열에서 지원 직무를 꺼낸다 ("Job: 백엔드 개발자" 줄). 없으면 undefined */
export function interviewJob(info: Pick<ModeInfo, 'questions'>): string | undefined {
  for (const q of info.questions ?? []) {
    const match = /^Job:\s*(.+)$/m.exec(q);
    if (match) return match[1].trim();
  }
  return undefined;
}
