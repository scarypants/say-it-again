import { IMAGE_MODEL, IMAGE_QUALITY, IMAGE_SIZE, IMAGE_TIMEOUT_MS, MOCK_LLM } from '../config';
import { HttpError } from '../errors';
import { mockDelay } from '../mock';
import { getOpenAI } from '../openai';

/**
 * 토익 Part 2 사진 1장 (docs/api.md 6절 "사진 생성"). data URL로 돌려주고 서버에는 저장하지 않는다.
 * 실패·시간 초과는 502 → 프론트가 기본 사진(picture.fallback)으로 출제한다.
 */
export async function generateQuestionImage(scene: string): Promise<string> {
  if (MOCK_LLM) return mockImage(scene);
  if (!IMAGE_MODEL) throw new HttpError(502, 'OPENAI_IMAGE_MODEL이 설정되지 않아 사진을 만들 수 없습니다.');

  try {
    const res = await getOpenAI().images.generate(
      {
        model: IMAGE_MODEL,
        prompt: [
          'A realistic everyday photograph for a TOEIC Speaking "describe a picture" question.',
          scene,
          'Natural lighting, clear view of every person and object described. No text, letters, logos, or captions anywhere.',
        ].join(' '),
        n: 1,
        size: IMAGE_SIZE,
        quality: IMAGE_QUALITY,
        output_format: 'jpeg', // png보다 작아서 응답이 가볍다
        output_compression: 75,
      },
      { timeout: IMAGE_TIMEOUT_MS },
    );
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error('이미지 응답이 비어 있습니다.');
    return `data:image/jpeg;base64,${b64}`;
  } catch (err) {
    console.error('[image] 사진 생성 실패', err);
    throw new HttpError(502, '사진을 만들지 못했습니다. 기본 사진으로 진행해 주세요.');
  }
}

/** mock 모드: 실제처럼 몇 초 뒤 장면 설명이 적힌 자리 표시 그림(SVG)을 돌려준다 */
async function mockImage(scene: string): Promise<string> {
  await mockDelay(3000);
  const escaped = scene.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] ?? c);
  const lines = escaped.match(/.{1,60}(\s|$)/g) ?? [escaped];
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024">',
    '<rect width="1536" height="1024" fill="#dfe7ef"/>',
    '<text x="768" y="120" font-size="48" text-anchor="middle" font-family="sans-serif" fill="#334">MOCK PICTURE</text>',
    ...lines.map(
      (line, i) =>
        `<text x="768" y="${260 + i * 56}" font-size="36" text-anchor="middle" font-family="sans-serif" fill="#334">${line.trim()}</text>`,
    ),
    '</svg>',
  ].join('');
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
