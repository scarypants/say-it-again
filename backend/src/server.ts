import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { DEFAULT_ORIGINS, EXTRA_ORIGINS } from './config';
import { HttpError } from './errors';
import { router } from './http/routes';

const app = express();
const port = Number(process.env.PORT) || 8080;

/** 허용 출처: 기본[내 PC / 사설 IP /ngrok] + CORS_ORIGIN. "https://*.도메인" 형식과 "*"(모두 허용)를 지원한다. */
function isAllowedOrigin(origin: string): boolean {
  if (DEFAULT_ORIGINS.some((re) => re.test(origin))) return true;
  return EXTRA_ORIGINS.some((allowed) => {
    if (allowed === '*') return true;
    if (!allowed.includes('*')) return allowed === origin;
    const pattern = allowed.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace('*', '[^.]+'); // *는 하위 도메인 한 단계
    return new RegExp(`^${pattern}$`).test(origin);
  });
}

/**
 * 허용되지 않은 출처의 요청은 처리하지 않고 403으로 거절한다.
 * (CORS 헤더만으로는 브라우저가 응답을 못 읽게 할 뿐 요청은 처리되어 OpenAI 크레딧이 소모된다)
 * Origin이 없는 요청(curl, 서버 간 호출)은 통과시킨다.
 */
const rejectUnknownOrigin: RequestHandler = (req, _res, next) => {
  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) {
    return next(new HttpError(403, `허용되지 않은 출처입니다: ${origin} (backend/.env의 CORS_ORIGIN에 추가하세요)`));
  }
  next();
};

/** 요청마다 처리 시간을 남긴다 (데모 중 어디가 느린지 바로 보이도록). 본문·키는 남기지 않는다 */
const logTiming: RequestHandler = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => console.log(`[http] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`));
  next();
};

app.use(logTiming);
app.use(rejectUnknownOrigin);
app.use(cors({ origin: (origin, done) => done(null, !origin || isAllowedOrigin(origin)) }));
app.use(express.json({ limit: '2mb' })); // analyze는 대본 전체를 JSON으로 받는다
app.use('/api', router);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
  } else if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    res.status(400).json({ error: '요청 JSON이 올바르지 않거나 너무 큽니다.' });
  } else if (err instanceof multer.MulterError) {
    res.status(400).json({ error: `업로드 오류: ${err.message}` });
  } else {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};
app.use(errorHandler);

app.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`);
});
