import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDecision } from "../../agent/planner";

test("parses canonical tool call", () => {
  const { decision } = parseDecision(
    '{"action":"tool","tool":"read_file","args":{"path":"a.ts"},"reason":"x"}'
  );
  assert.ok(decision && decision.action === "tool");
  if (decision.action === "tool") {
    assert.equal(decision.tool, "read_file");
    assert.equal(decision.args.path, "a.ts");
  }
});

test("parses final answer", () => {
  const { decision } = parseDecision(
    '{"action":"final","summary":"done","changes":["a"],"next_steps":[]}'
  );
  assert.ok(decision && decision.action === "final");
  if (decision.action === "final") {
    assert.equal(decision.summary, "done");
    assert.deepEqual(decision.changes, ["a"]);
  }
});

test("REGRESSION: tool name in 'action' with flattened args (the bug we shipped)", () => {
  // This is the exact shape qwen3-coder emitted that broke propose_patch.
  const { decision } = parseDecision(
    '{"action":"propose_patch","path":"README.md","content":"# Hello"}'
  );
  assert.ok(decision && decision.action === "tool", "should recover as a tool call");
  if (decision.action === "tool") {
    assert.equal(decision.tool, "propose_patch");
    assert.equal(decision.args.path, "README.md");
    assert.equal(decision.args.content, "# Hello");
  }
});

test("recovers tool name from 'name' / 'tool_call' keys", () => {
  const a = parseDecision('{"name":"git_status","args":{}}');
  assert.equal(a.decision?.action === "tool" && a.decision.tool, "git_status");

  const b = parseDecision('{"tool_call":"list_files","dir":"src"}');
  assert.ok(b.decision?.action === "tool");
  if (b.decision?.action === "tool") {
    assert.equal(b.decision.tool, "list_files");
    assert.equal(b.decision.args.dir, "src");
  }
});

test("strips markdown code fences around JSON", () => {
  const { decision } = parseDecision(
    '```json\n{"action":"tool","tool":"git_diff","args":{}}\n```'
  );
  assert.equal(decision?.action === "tool" && decision.tool, "git_diff");
});

test("unknown tool name is NOT treated as a tool call", () => {
  const { decision, fallbackText } = parseDecision(
    '{"action":"make_coffee","cups":2}'
  );
  assert.equal(decision, undefined);
  assert.ok(fallbackText);
});

test("plain prose falls back to text, not a crash", () => {
  const { decision, fallbackText } = parseDecision("This file handles auth.");
  assert.equal(decision, undefined);
  assert.equal(fallbackText, "This file handles auth.");
});

test("nested args under 'arguments' or 'parameters' are honored", () => {
  const a = parseDecision('{"tool":"read_file","arguments":{"path":"x"}}');
  assert.equal(a.decision?.action === "tool" && a.decision.args.path, "x");

  const b = parseDecision('{"tool":"read_file","parameters":{"path":"y"}}');
  assert.equal(b.decision?.action === "tool" && b.decision.args.path, "y");
});
