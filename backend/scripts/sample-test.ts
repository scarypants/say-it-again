// 샘플 녹음으로 전사 → 분석을 실제 서버 코드 그대로 돌리고, 프론트가 받는 응답을 파일로 저장한다.
//
//   npm run test:samples -w backend            # samples/ 의 모든 녹음
//   npm run test:samples -w backend -- test1   # 이름에 test1이 들어간 녹음만
//
// 파일 이름 규칙: <이름>_<ko|en>[_speaking].<확장자>
//   - _ko / _en: 언어. 기본은 발표 모드(level=exam)
//   - _speaking: 스피킹(오픽) 모드. 같은 이름의 .question.txt가 있으면 질문으로 쓴다
// 결과: samples/out/<이름>.transcribe.json, <이름>.analyze.json (samples/는 git에 올리지 않는다)
// .env의 MOCK_STT / MOCK_LLM을 켜면 저장된 응답으로 돈다.
import 'dotenv/config';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { analyze } from '../src/pipeline/analyze';
import { transcribeAll } from '../src/pipeline/transcribe';
import type { AnalyzeResponse, Language } from '../src/types/api';
import type { ModeInfo } from '../src/types/internal';

const SAMPLES_DIR = path.resolve(__dirname, '..', 'samples');
const OUT_DIR = path.join(SAMPLES_DIR, 'out');
const AUDIO_EXT = /\.(m4a|mp4|webm|mp3|wav|ogg)$/i;
const DEFAULT_QUESTION = 'Please introduce yourself in as much detail as possible.';

async function main() {
  const filter = process.argv[2] ?? '';
  const files = readdirSync(SAMPLES_DIR).filter((f) => AUDIO_EXT.test(f) && f.includes(filter));
  if (files.length === 0) {
    console.log(`samples/에 녹음이 없습니다 (필터: "${filter}")`);
    return;
  }
  mkdirSync(OUT_DIR, { recursive: true });

  for (const file of files) {
    const base = file.replace(AUDIO_EXT, '');
    try {
      await runOne(file, base);
    } catch (err) {
      console.log(`\n✗ ${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`\n결과 파일: ${OUT_DIR}`);
}

async function runOne(file: string, base: string) {
  const language: Language = /_en(_|$)/.test(base) ? 'en' : 'ko';
  const info: ModeInfo = base.includes('_speaking')
    ? { mode: 'speaking', language: 'en', exam: 'opic', questions: [readQuestion(base)] }
    : { mode: 'presentation', language, level: 'exam' };

  const { buffer, patched } = loadAudio(path.join(SAMPLES_DIR, file));
  const audio = { buffer, originalname: file, mimetype: 'audio/mp4', size: buffer.length } as Express.Multer.File;

  console.log(`\n▶ ${file} (${info.mode}, ${info.language}${patched ? ', 3GPP 형식 표시를 M4A로 고쳐서 전송' : ''})`);

  let t = Date.now();
  const transcript = await transcribeAll({ ...info, audio: [audio] });
  const sttMs = Date.now() - t;
  writeFileSync(path.join(OUT_DIR, `${base}.transcribe.json`), JSON.stringify(transcript, null, 2));

  t = Date.now();
  const result = await analyze({ ...info, parts: transcript.parts });
  const llmMs = Date.now() - t;
  writeFileSync(path.join(OUT_DIR, `${base}.analyze.json`), JSON.stringify(result, null, 2));

  printSummary(result, sttMs, llmMs);
}

function readQuestion(base: string): string {
  const file = path.join(SAMPLES_DIR, `${base}.question.txt`);
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : DEFAULT_QUESTION;
}

// 안드로이드 녹음 앱의 .m4a는 실제로 3GPP 컨테이너라 whisper가 거절한다.
// 테스트에서만 ftyp brand를 M4A로 바꿔 보낸다 (원본 파일은 그대로). 실제 서비스는 브라우저가 webm/mp4로 녹음한다.
function loadAudio(file: string): { buffer: Buffer; patched: boolean } {
  const buffer = readFileSync(file);
  let patched = false;
  for (const offset of [8, 16, 20]) {
    if (buffer.toString('latin1', offset, offset + 3) === '3gp') {
      buffer.write('M4A ', offset, 'latin1');
      patched = true;
    }
  }
  return { buffer, patched };
}

function printSummary(r: AnalyzeResponse, sttMs: number, llmMs: number) {
  const part = r.parts[0];
  const words = part.script.flatMap((l) => l.words);
  const sentences = part.script.filter((l) => !l.pause).length;
  const pauses = part.script.filter((l) => l.pause).length;
  console.log(`  전사 ${sttMs}ms · 분석 ${llmMs}ms · 길이 ${part.duration.toFixed(1)}초 · 문장 ${sentences}개 · 정지 ${pauses}개 · 단어 ${words.length}개`);
  if (r.warnings) console.log(`  warnings: ${JSON.stringify(r.warnings)}`);

  for (const line of part.script) {
    if (line.pause) {
      console.log(`    ⏸ ${(line.end - line.start).toFixed(1)}초`);
      continue;
    }
    const marked = line.words.map((w, i) => {
      const n = line.offset + i;
      const tags = [...new Set(part.highlight.filter((h) => n >= h.from && n <= h.to).map((h) => h.category[0]))].join('');
      return tags ? `${w}[${tags}]` : w;
    });
    console.log(`    ${marked.join(' ')}`);
  }
  console.log('    ([p]패닉 [f]필러 [r]반복 [e]표현 [g]문법)');

  for (const h of part.highlight.filter((h) => h.category !== 'filler')) {
    const text = words.slice(h.from, h.to + 1).join(' ');
    console.log(`  - ${h.category}: "${text}"${h.fixed ? ` → "${h.fixed}"` : ''}${h.reason ? ` | ${h.reason}` : ''}`);
  }
  if (part.comment) console.log(`  코멘트: ${part.comment}`);
  if (part.final.length) console.log(`  최종 대본: ${part.final.map((s) => s.words.join(' ')).join(' / ')}`);
  console.log(`  총평: ${r.analysis.summary.headline}`);
  console.log(`  점수 ${r.analysis.score} · ${JSON.stringify(r.analysis.stats)}`);
  console.log(`  비율 ${JSON.stringify(r.charts.categoryRatio)}`);
}

main();
