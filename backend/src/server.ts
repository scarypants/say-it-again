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
app.use(express.json());
app.use('/api', router);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
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
