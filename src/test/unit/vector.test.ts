import { test } from "node:test";
import assert from "node:assert/strict";
import { cosineSimilarity } from "../../memory/vector";

test("identical vectors have similarity 1", () => {
  assert.ok(Math.abs(cosineSimilarity([1, 2, 3], [1, 2, 3]) - 1) < 1e-9);
});

test("orthogonal vectors have similarity 0", () => {
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
});

test("opposite vectors have similarity -1", () => {
  assert.ok(Math.abs(cosineSimilarity([1, 1], [-1, -1]) - -1) < 1e-9);
});

test("similar direction ranks higher than dissimilar", () => {
  const query = [1, 1, 0];
  const close = cosineSimilarity(query, [1, 0.9, 0]);
  const far = cosineSimilarity(query, [0, 0, 1]);
  assert.ok(close > far);
});

test("mismatched lengths return 0 (no crash)", () => {
  assert.equal(cosineSimilarity([1, 2, 3], [1, 2]), 0);
});

test("empty vectors return 0", () => {
  assert.equal(cosineSimilarity([], []), 0);
});

test("zero vector returns 0 (no divide-by-zero)", () => {
  assert.equal(cosineSimilarity([0, 0, 0], [1, 2, 3]), 0);
});
