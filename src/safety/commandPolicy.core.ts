import { BLOCKED_COMMANDS } from "../config/defaults";

/**
 * Pure command-policy logic (PRD 16) with NO vscode dependency, so it can be
 * unit-tested in plain Node. `commandPolicy.ts` wraps this with live Settings.
 */

export interface CommandCheck {
  allowed: boolean;
  reason?: string;
}

export function normalizeCommand(cmd: string): string {
  return cmd.trim().replace(/\s+/g, " ");
}

/**
 * Evaluate a command against an explicit allowlist. Default-deny:
 * blocked patterns and shell metacharacters always lose; the command must
 * match the allowlist to be permitted.
 */
export function evaluateCommand(
  rawCommand: string,
  allowlist: string[]
): CommandCheck {
  const cmd = normalizeCommand(rawCommand);
  if (!cmd) {
    return { allowed: false, reason: "Empty command." };
  }

  // Hard blocks win, even if a prefix is allowlisted.
  for (const blocked of BLOCKED_COMMANDS) {
    if (
      cmd === blocked ||
      cmd.startsWith(blocked + " ") ||
      cmd.includes(` ${blocked} `)
    ) {
      return {
        allowed: false,
        reason: `Blocked command: "${blocked}" is denied by safety policy.`,
      };
    }
  }

  // Reject shell metacharacters that could chain past the allowlist.
  if (/[;&|`$><]|\$\(/.test(cmd)) {
    return {
      allowed: false,
      reason: "Command contains shell control characters and is rejected.",
    };
  }

  const normalizedAllow = allowlist.map(normalizeCommand);
  const isAllowed = normalizedAllow.some(
    (allowed) => cmd === allowed || cmd.startsWith(allowed + " ")
  );

  if (!isAllowed) {
    return {
      allowed: false,
      reason: `Command not on allowlist: "${cmd}". Add it to innerLoop.commandAllowlist to permit it.`,
    };
  }

  return { allowed: true };
}

/** Suggest a safe alternative when a command is blocked (ETHOS refusal). */
export function safeAlternative(rawCommand: string): string {
  const cmd = normalizeCommand(rawCommand);
  if (cmd.startsWith("npm install") || cmd.startsWith("pnpm install")) {
    return "Run the install yourself in a terminal you control, then re-run Inner Loop.";
  }
  if (cmd.startsWith("git push")) {
    return "Review the diff and push manually when you're ready.";
  }
  return "Run this command manually in your terminal if you intend to proceed.";
}
