import { ACCURACY_WEIGHT, LEAD_PANIC_SEC, PANIC_GAP, SPEAKING_PANIC_GAP } from './config';
import type { ModeInfo } from './types/internal';

// 모드별로 달라지는 분석 규칙 (여러 파일에서 같은 기준을 쓰도록 한곳에 둔다)

/** 문법(grammar) 하이라이트를 만드는 모드: 스피킹, 영어 면접 */
export function checksGrammar(info: Pick<ModeInfo, 'mode' | 'language'>): boolean {
  return info.mode === 'speaking' || (info.mode === 'interview' && info.language === 'en');
}

/** 질문에 답하는 모드: 파트별 코멘트(parts[].comment)가 있다 */
export function answersQuestions(info: Pick<ModeInfo, 'mode'>): boolean {
  return info.mode === 'speaking' || info.mode === 'interview';
}

/** 답변 정확성(parts[].accuracy)을 매기는 모드와 총점에서의 비중. 발표는 undefined (습관 점수만) */
export function accuracyWeight(info: Pick<ModeInfo, 'mode'>): number | undefined {
  if (info.mode === 'speaking') return ACCURACY_WEIGHT.speaking;
  if (info.mode === 'interview') return ACCURACY_WEIGHT.interview; // 발표 예상 질문 답변(질의응답)도 포함
  return undefined;
}

/** 줄 분할의 패닉존 기준: 멈춤(gap)과 첫마디 전 침묵(lead, 질문에 답하는 모드만) */
export function panicRule(info: Pick<ModeInfo, 'mode'>): { gap: number; lead?: number } {
  return {
    gap: info.mode === 'speaking' ? SPEAKING_PANIC_GAP : PANIC_GAP,
    ...(answersQuestions(info) && { lead: LEAD_PANIC_SEC }),
  };
}

/**
 * 발표 예상 질문 답변인지: 프론트는 면접 모드로 보내고 질문 문자열 머리말이 "Presentation Q&A N"이다.
 * 이때는 면접이 아니라 발표 질의응답 기준으로 평가한다.
 */
export function isPresentationQna(info: Pick<ModeInfo, 'mode' | 'questions'>): boolean {
  return info.mode === 'interview' && (info.questions ?? []).some((q) => q.startsWith('Presentation Q&A'));
}

/** 면접 질문 문자열에서 지원 직무를 꺼낸다 ("Job: 백엔드 개발자" 줄). 없으면 undefined */
export function interviewJob(info: Pick<ModeInfo, 'questions'>): string | undefined {
  for (const q of info.questions ?? []) {
    const match = /^Job:\s*(.+)$/m.exec(q);
    if (match) return match[1].trim();
  }
  return undefined;
}
