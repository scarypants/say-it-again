import { requestInterviewQuestions, type InterviewQuestionsOutput } from '../llm/requests';
import type { InterviewQuestionsRequest, InterviewQuestionsResponse, InterviewQuestionType, Language } from '../types/api';

/** 질문 5개 = 유형 5개, 이 순서로 하나씩 (docs/api.md 6절) */
const ORDER: InterviewQuestionType[] = ['intro', 'motivation', 'job', 'experience', 'closing'];

/** LLM이 실패하거나 빈 질문을 줄 때 쓰는 기본 질문. 조사가 직무 이름의 받침에 따라 달라지지 않게 썼다 */
function defaultQuestion(type: InterviewQuestionType, language: Language, job: string): string {
  const ko: Record<InterviewQuestionType, string> = {
    intro: '1분 동안 자기소개를 해 주세요.',
    motivation: `${job} 직무에 지원한 이유는 무엇인가요?`,
    job: `${job} 직무에서 가장 중요한 역량은 무엇이고, 본인은 그 역량을 어떻게 갖췄나요?`,
    experience: '팀으로 일하며 갈등이나 어려움을 해결한 경험을 말해 주세요.',
    closing: '마지막으로 하고 싶은 말이 있나요?',
  };
  const en: Record<InterviewQuestionType, string> = {
    intro: 'Please introduce yourself in about one minute.',
    motivation: `Why did you apply for this ${job} position?`,
    job: `What is the most important skill for a ${job}, and how have you developed it?`,
    experience: 'Tell me about a time you solved a conflict or difficulty while working in a team.',
    closing: 'Is there anything else you would like to tell us?',
  };
  return (language === 'ko' ? ko : en)[type];
}

/**
 * 면접 질문 생성: 지원 직무에 맞춘 질문 5개 (LLM 1회).
 * LLM이 실패해도 200으로 기본 질문을 돌려주고 warnings에 llm_failed를 붙인다 (질문 화면에서 막히지 않도록).
 */
export async function generateInterviewQuestions(input: InterviewQuestionsRequest): Promise<InterviewQuestionsResponse> {
  const { language, job } = input;
  let out: Partial<InterviewQuestionsOutput> = {};
  let failed = false;
  try {
    out = await requestInterviewQuestions(language, job);
  } catch (err) {
    console.error('[llm] 면접 질문 생성 실패', err);
    failed = true;
  }

  return {
    language,
    job,
    // 빈 질문이 온 유형만 기본 질문으로 채운다
    questions: ORDER.map((type) => ({ type, text: out[type]?.trim() || defaultQuestion(type, language, job) })),
    ...(failed && { warnings: ['llm_failed'] }),
  };
}
