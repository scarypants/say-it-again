import { LEAD_PANIC_SEC, PANIC_GAP, SPEAKING_PANIC_GAP } from './config';
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

/** 줄 분할의 패닉존 기준: 멈춤(gap)과 첫마디 전 침묵(lead, 질문에 답하는 모드만) */
export function panicRule(info: Pick<ModeInfo, 'mode'>): { gap: number; lead?: number } {
  return {
    gap: info.mode === 'speaking' ? SPEAKING_PANIC_GAP : PANIC_GAP,
    ...(answersQuestions(info) && { lead: LEAD_PANIC_SEC }),
  };
}

/** 면접 질문 문자열에서 지원 직무를 꺼낸다 ("Job: 백엔드 개발자" 줄). 없으면 undefined */
export function interviewJob(info: Pick<ModeInfo, 'questions'>): string | undefined {
  for (const q of info.questions ?? []) {
    const match = /^Job:\s*(.+)$/m.exec(q);
    if (match) return match[1].trim();
  }
  return undefined;
}
