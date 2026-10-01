import assert from "node:assert/strict";
import test from "node:test";
import { failedAnswerIndex } from "./answerRetry";

test("보낸 답변 순번을 건너뛴 문항을 뺀 원래 문항 번호로 바꾼다", () => {
  const answers = ["a", null, "b", "c"];
  assert.equal(failedAnswerIndex("1번째 녹음에서 알아들은 말이 너무 적어요.", answers), 0);
  assert.equal(failedAnswerIndex("2번째 녹음에서 알아들은 말이 너무 적어요.", answers), 2);
  assert.equal(failedAnswerIndex("3번째 녹음에서 음성이 감지되지 않았습니다.", answers), 3);
});

test("순번이 없거나 범위를 넘으면 null", () => {
  assert.equal(failedAnswerIndex("알아들은 말이 너무 적어요.", ["a"]), null);
  assert.equal(failedAnswerIndex("5번째 녹음에서", ["a", "b"]), null);
  assert.equal(failedAnswerIndex(null, ["a"]), null);
});
