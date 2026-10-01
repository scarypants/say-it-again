import { Router } from 'express';
import multer from 'multer';
import { MAX_FILE_BYTES, MAX_FILES } from '../config';
import { analyze } from '../pipeline/analyze';
import { transcribeAll } from '../pipeline/transcribe';
import { parseAnalyzeRequest, parseTranscribeRequest } from './validate';

// 파일은 디스크에 저장하지 않고 메모리로만 받는다.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: MAX_FILES, fileSize: MAX_FILE_BYTES },
});

export const router = Router();

// 1단계: 녹음 → 문장 단위 대본. audio 외의 파일 필드(예: material)는 multer가 에러로 처리한다.
router.post('/transcribe', upload.fields([{ name: 'audio', maxCount: MAX_FILES }]), async (req, res) => {
  res.json(await transcribeAll(parseTranscribeRequest(req)));
});

// 2단계: 사용자가 고친 대본(JSON) → 분석 결과
router.post('/analyze', async (req, res) => {
  res.json(await analyze(parseAnalyzeRequest(req)));
});
