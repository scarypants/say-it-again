import type { RequestHandler } from 'express';
import { ALLOWED_ORIGINS } from '../config';
import { HttpError } from '../errors';

export function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin);
}

// 허용 목록에 없는 출처의 요청은 처리하지 않고 403으로 거절한다.
// (CORS 헤더만으로는 브라우저가 응답을 못 읽게 할 뿐 요청은 처리되어 OpenAI 크레딧이 소모된다)
// Origin이 없는 요청(curl, 서버 간 호출, 같은 출처의 GET)은 그대로 통과시킨다.
export const rejectUnknownOrigin: RequestHandler = (req, _res, next) => {
  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) {
    return next(
      new HttpError(403, `허용되지 않은 출처입니다: ${origin} (backend/.env의 CORS_ORIGIN에 추가하세요)`),
    );
  }
  next();
};
