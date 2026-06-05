import { Settings } from "../config/settings";
import {
  evaluateCommand,
  safeAlternative as coreSafeAlternative,
  CommandCheck,
} from "./commandPolicy.core";

/**
 * Command execution policy (PRD 16) — VS Code-facing wrapper.
 * Pulls the live allowlist from Settings and delegates to the pure core
 * (commandPolicy.core.ts), which is unit-tested independently.
 */

export type { CommandCheck };

export function checkCommand(rawCommand: string): CommandCheck {
  return evaluateCommand(rawCommand, Settings.commandAllowlist());
}

export const safeAlternative = coreSafeAlternative;
