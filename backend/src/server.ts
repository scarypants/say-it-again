import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { HttpError } from './errors';
import { router } from './http/routes';

const app = express();
const port = Number(process.env.PORT) || 8080;

app.use(cors());
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
