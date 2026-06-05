import { test } from "node:test";
import assert from "node:assert/strict";
import {
  describeTool,
  formatAgentEvent,
  AgentEvent,
} from "../../agent/activity";

test("describeTool maps known tools to friendly labels", () => {
  assert.equal(describeTool("read_file"), "Reading a file");
  assert.equal(describeTool("search_code"), "Searching the code");
  assert.equal(describeTool("propose_patch"), "Proposing an edit");
  assert.equal(describeTool("retrieve_memory"), "Recalling project memory");
});

test("describeTool falls back gracefully for unknown tools", () => {
  assert.equal(describeTool("some_new_tool"), "Using some_new_tool");
});

test("formatAgentEvent renders a tool call as a present-tense line", () => {
  const event: AgentEvent = { kind: "tool", step: 1, tool: "list_files" };
  assert.equal(formatAgentEvent(event), "→ Listing files\n");
});

test("formatAgentEvent adds an approval hint for propose_patch", () => {
  const event: AgentEvent = { kind: "tool", step: 1, tool: "propose_patch" };
  const out = formatAgentEvent(event);
  assert.match(out, /Proposing an edit/);
  assert.match(out, /approve in the dialog/);
  assert.ok(out.endsWith("\n"));
});

test("formatAgentEvent adds an approval hint for run_command", () => {
  const event: AgentEvent = { kind: "tool", step: 1, tool: "run_command" };
  const out = formatAgentEvent(event);
  assert.match(out, /approve the command in the dialog/);
});

test("formatAgentEvent renders a notice", () => {
  const event: AgentEvent = { kind: "notice", text: "Re-checking format…" };
  assert.equal(formatAgentEvent(event), "… Re-checking format…\n");
});

test("formatAgentEvent hides successful tool results (implied by next step)", () => {
  const event: AgentEvent = {
    kind: "tool_result",
    step: 1,
    tool: "read_file",
    ok: true,
  };
  assert.equal(formatAgentEvent(event), "");
});

test("formatAgentEvent surfaces failed tool results", () => {
  const event: AgentEvent = {
    kind: "tool_result",
    step: 2,
    tool: "git_status",
    ok: false,
  };
  assert.match(formatAgentEvent(event), /Checking git status had no result/);
});

test("formatAgentEvent output always ends in a newline (when non-empty)", () => {
  const events: AgentEvent[] = [
    { kind: "tool", step: 1, tool: "read_file" },
    { kind: "notice", text: "hi" },
    { kind: "tool_result", step: 1, tool: "read_file", ok: false },
  ];
  for (const e of events) {
    const out = formatAgentEvent(e);
    assert.ok(out.endsWith("\n"), `expected newline for ${e.kind}`);
  }
});
