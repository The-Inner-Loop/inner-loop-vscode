import { runCommand } from "../vscode/terminal";

/**
 * Git helpers (PRD git_status / git_diff). Read-only git only.
 */
export const Git = {
  async status(cwd: string): Promise<string> {
    const res = await runCommand("git status --short --branch", cwd, 15_000);
    return res.stdout || res.stderr || "(no output)";
  },

  async diff(cwd: string): Promise<string> {
    const res = await runCommand("git diff", cwd, 20_000);
    return res.stdout || res.stderr || "(no changes)";
  },
};
