import * as path from "path";
import { IGNORED_DIRS, PROTECTED_FILES, MAX_FILE_BYTES } from "../config/defaults";

/**
 * File access policy (PRD 11 & 19).
 * Enforces: workspace boundary, path traversal block, secret protection,
 * ignored directories, and large-file guard.
 */

export interface PathCheck {
  ok: boolean;
  /** Absolute, normalized path (only meaningful when ok). */
  abs: string;
  reason?: string;
}

/** Resolve a (possibly relative) path and confirm it stays inside the root. */
export function resolveInsideWorkspace(
  inputPath: string,
  workspaceRoot: string
): PathCheck {
  const root = path.resolve(workspaceRoot);
  const abs = path.resolve(root, inputPath);
  const rel = path.relative(root, abs);

  if (rel === "" ) {
    return { ok: true, abs };
  }
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return {
      ok: false,
      abs,
      reason: `Path escapes workspace boundary: ${inputPath}`,
    };
  }
  return { ok: true, abs };
}

/** True if any path segment is an ignored directory. */
export function isIgnored(absPath: string, workspaceRoot: string): boolean {
  const rel = path.relative(path.resolve(workspaceRoot), path.resolve(absPath));
  const segments = rel.split(path.sep);
  return segments.some((seg) => IGNORED_DIRS.includes(seg));
}

/** Match a filename against a protected glob (supports leading `*.ext`). */
function matchesProtected(fileName: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    return fileName.endsWith(pattern.slice(1));
  }
  return fileName === pattern;
}

/** True if the file is a protected/secret file requiring explicit approval. */
export function isProtected(absPath: string): boolean {
  const fileName = path.basename(absPath);
  return PROTECTED_FILES.some((p) => matchesProtected(fileName, p));
}

export function isTooLarge(sizeBytes: number): boolean {
  return sizeBytes > MAX_FILE_BYTES;
}
