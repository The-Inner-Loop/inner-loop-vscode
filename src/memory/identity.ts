import * as crypto from "crypto";

/**
 * Workspace identity. Phase 1 identity = hash of the absolute workspace path
 * (PRD 13.2). Stable across sessions, unique per workspace folder.
 */
export function workspaceHash(absPath: string): string {
  return crypto.createHash("sha256").update(absPath).digest("hex").slice(0, 16);
}
