import type { Language } from '../types/api';

/** 필러 사전. whisper 실측 후 조정한다. */
export type FillerDict = {
  certain: string[]; // 항상 필러로 본다
  patterns: RegExp[]; // 늘여 말한 형태 (예: 어어, 음음)
  ambiguous: string[]; // 앞뒤 간격이 길 때만 필러로 본다
  phrases: string[][]; // 연속된 여러 단어로 된 필러
};

export const FILLERS: Record<Language, FillerDict> = {
  ko: {
    certain: ['어', '음', '아', '에', '으', '엄', '으음'],
    patterns: [/^(어+|음+|으+|아+|에+)$/],
    ambiguous: ['그', '저', '이제', '막', '뭐', '좀', '그러니까', '그니까', '저기', '뭐랄까', '뭐지', '있잖아'],
    phrases: [],
  },
  en: {
    certain: ['um', 'uh', 'er', 'erm', 'ah', 'hmm', 'uhm'],
    patterns: [/^(u+m+|u+h+|a+h+|e+r+m*|h*m+)$/],
    ambiguous: ['like', 'so', 'well', 'actually', 'basically', 'literally', 'right'],
    phrases: [
      ['you', 'know'],
      ['i', 'mean'],
      ['kind', 'of'],
      ['sort', 'of'],
    ],
  },
};
