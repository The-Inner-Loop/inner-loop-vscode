import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveInsideWorkspace,
  isProtected,
  isIgnored,
  isTooLarge,
} from "../../safety/filePolicy";

const ROOT = "/home/user/project";

test("resolves a normal relative path inside the workspace", () => {
  const r = resolveInsideWorkspace("src/index.ts", ROOT);
  assert.equal(r.ok, true);
  assert.equal(r.abs, "/home/user/project/src/index.ts");
});

test("blocks path traversal out of the workspace", () => {
  for (const p of ["../secrets.txt", "../../etc/passwd", "src/../../escape"]) {
    const r = resolveInsideWorkspace(p, ROOT);
    assert.equal(r.ok, false, `expected blocked: ${p}`);
  }
});

test("blocks absolute paths outside the workspace", () => {
  const r = resolveInsideWorkspace("/etc/passwd", ROOT);
  assert.equal(r.ok, false);
});

test("allows the workspace root itself", () => {
  const r = resolveInsideWorkspace(".", ROOT);
  assert.equal(r.ok, true);
});

test("flags protected/secret files", () => {
  for (const f of [".env", ".env.local", "id_rsa", "server.pem", "private.key", "credentials.json"]) {
    assert.equal(isProtected(`/home/user/project/${f}`), true, `expected protected: ${f}`);
  }
});

test("does not flag ordinary files as protected", () => {
  for (const f of ["index.ts", "README.md", "env.example", "keyboard.ts"]) {
    assert.equal(isProtected(`/home/user/project/${f}`), false, `expected not protected: ${f}`);
  }
});

test("ignores known build/vcs directories", () => {
  assert.equal(isIgnored(`${ROOT}/node_modules/x/index.js`, ROOT), true);
  assert.equal(isIgnored(`${ROOT}/.git/config`, ROOT), true);
  assert.equal(isIgnored(`${ROOT}/dist/out.js`, ROOT), true);
  assert.equal(isIgnored(`${ROOT}/src/index.ts`, ROOT), false);
});

test("large-file guard triggers above the cap", () => {
  assert.equal(isTooLarge(1024), false);
  assert.equal(isTooLarge(10 * 1024 * 1024), true);
});
