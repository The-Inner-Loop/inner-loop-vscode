import { spawn } from "child_process";

/**
 * Command runner (PRD 16.3). Phase 1 uses child_process with the workspace as
 * cwd. The command is split safely (no shell) and must already be approved +
 * allowlisted by the caller.
 */

export interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export function runCommand(
  command: string,
  cwd: string,
  timeoutMs = 120_000
): Promise<CommandResult> {
  return new Promise<CommandResult>((resolve) => {
    const parts = command.trim().split(/\s+/);
    const bin = parts[0];
    const args = parts.slice(1);

    const child = spawn(bin, args, {
      cwd,
      shell: false, // never spawn a shell — avoids injection past the allowlist
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: stderr + `\n${err.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}
