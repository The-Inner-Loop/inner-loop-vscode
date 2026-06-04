import { BLOCKED_COMMANDS } from "../config/defaults";
import { Settings } from "../config/settings";

/**
 * Command execution policy (PRD 16).
 * Default-deny. A command must match the allowlist AND not match any blocked
 * pattern. Matching is conservative: we compare the normalized command string.
 */

export interface CommandCheck {
  allowed: boolean;
  reason?: string;
}

function normalize(cmd: string): string {
  return cmd.trim().replace(/\s+/g, " ");
}

export function checkCommand(rawCommand: string): CommandCheck {
  const cmd = normalize(rawCommand);
  if (!cmd) {
    return { allowed: false, reason: "Empty command." };
  }

  // Hard blocks win, even if a prefix is allowlisted.
  for (const blocked of BLOCKED_COMMANDS) {
    if (cmd === blocked || cmd.startsWith(blocked + " ") || cmd.includes(` ${blocked} `)) {
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

  const allowlist = Settings.commandAllowlist().map(normalize);
  const isAllowed = allowlist.some(
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

/** Suggest a safe alternative when a command is blocked (per ETHOS refusal). */
export function safeAlternative(rawCommand: string): string {
  const cmd = normalize(rawCommand);
  if (cmd.startsWith("npm install") || cmd.startsWith("pnpm install")) {
    return "Run the install yourself in a terminal you control, then re-run Inner Loop.";
  }
  if (cmd.startsWith("git push")) {
    return "Review the diff and push manually when you're ready.";
  }
  return "Run this command manually in your terminal if you intend to proceed.";
}
