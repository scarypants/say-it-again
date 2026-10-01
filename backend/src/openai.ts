import OpenAI from 'openai';

let client: OpenAI | undefined;

// 키가 없어도 서버는 뜨게 하고, 실제 호출 시점에 만든다.
export function getOpenAI(): OpenAI {
  client ??= new OpenAI();
  return client;
}
