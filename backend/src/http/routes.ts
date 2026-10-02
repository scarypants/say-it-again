import { Router } from 'express';
import multer from 'multer';
import { IMAGE_MODEL, LLM_MODEL, MAX_FILE_BYTES, MAX_FILES, MOCK_LLM, MOCK_STT } from '../config';
import { generateQuestionImage } from '../llm/image';
import { analyze } from '../pipeline/analyze';
import { generateQuestions } from '../pipeline/questions';
import { retry } from '../pipeline/retry';
import { transcribeAll } from '../pipeline/transcribe';
import {
  parseAnalyzeRequest,
  parseQuestionImageRequest,
  parseQuestionsRequest,
  parseRetryRequest,
  parseTranscribeRequest,
} from './validate';

/** 파일은 디스크에 저장하지 않고 메모리로만 받는다. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: MAX_FILES, fileSize: MAX_FILE_BYTES },
});

export const router = Router();

// 서버 상태 확인 (데모 직전 점검용). 키 값은 내보내지 않고 설정 여부만 알려 준다
router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    mock: { stt: MOCK_STT, llm: MOCK_LLM },
    openaiKey: Boolean(process.env.OPENAI_API_KEY),
    llmModel: LLM_MODEL || null,
    imageModel: IMAGE_MODEL || null,
  });
});

// 1단계: 녹음 → 문장 단위 대본. audio 외의 파일 필드(예: material)는 multer가 에러로 처리한다.
router.post('/transcribe', upload.fields([{ name: 'audio', maxCount: MAX_FILES }]), async (req, res) => {
  res.json(await transcribeAll(parseTranscribeRequest(req)));
});

// 2단계: 사용자가 고친 대본(JSON) → 분석 결과
router.post('/analyze', async (req, res) => {
  res.json(await analyze(parseAnalyzeRequest(req)));
});

// 재도전: 다시 녹음한 대본(JSON) + 이전 결과 요약 → 코드 분석 + 전후 비교 + 재도전 총평
router.post('/retry', async (req, res) => {
  res.json(await retry(parseRetryRequest(req)));
});

// 질문 생성: 처음 질문(스피킹·면접) / 꼬리질문(모든 모드, 버튼을 눌렀을 때)
router.post('/questions', async (req, res) => {
  res.json(await generateQuestions(parseQuestionsRequest(req)));
});

// 토익 Part 2 사진 (질문을 받은 뒤 프론트가 뒤에서 부른다. 실패하면 502 → 기본 사진)
router.post('/questions/image', async (req, res) => {
  const { scene } = parseQuestionImageRequest(req);
  res.json({ image: await generateQuestionImage(scene) });
});
