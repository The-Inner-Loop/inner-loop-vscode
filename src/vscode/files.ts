import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import {
  resolveInsideWorkspace,
  isIgnored,
  isProtected,
  isTooLarge,
} from "../safety/filePolicy";

/**
 * Safe filesystem operations bounded to the workspace (PRD 11 & 19).
 * All reads/lists go through filePolicy checks.
 */

export interface ListedFile {
  relPath: string;
  isDir: boolean;
}

export interface ReadResult {
  ok: boolean;
  content?: string;
  reason?: string;
  protected?: boolean;
}

/** Recursively list files under the workspace, skipping ignored dirs. */
export async function listFiles(
  workspaceRoot: string,
  subDir = ".",
  maxEntries = 500
): Promise<ListedFile[]> {
  const start = resolveInsideWorkspace(subDir, workspaceRoot);
  if (!start.ok) {
    return [];
  }

  const out: ListedFile[] = [];
  const stack: string[] = [start.abs];

  while (stack.length > 0 && out.length < maxEntries) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (isIgnored(abs, workspaceRoot)) {
        continue;
      }
      const relPath = path.relative(workspaceRoot, abs);
      if (entry.isDirectory()) {
        out.push({ relPath, isDir: true });
        stack.push(abs);
      } else if (entry.isFile()) {
        out.push({ relPath, isDir: false });
      }
      if (out.length >= maxEntries) {
        break;
      }
    }
  }
  return out.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

/** Read a file safely. Protected/secret files require allowSecret=true. */
export async function readWorkspaceFile(
  workspaceRoot: string,
  relOrAbsPath: string,
  allowSecret = false
): Promise<ReadResult> {
  const check = resolveInsideWorkspace(relOrAbsPath, workspaceRoot);
  if (!check.ok) {
    return { ok: false, reason: check.reason };
  }
  if (isProtected(check.abs) && !allowSecret) {
    return {
      ok: false,
      protected: true,
      reason: `Protected file requires explicit approval: ${relOrAbsPath}`,
    };
  }
  try {
    const stat = await fsp.stat(check.abs);
    if (!stat.isFile()) {
      return { ok: false, reason: "Not a file." };
    }
    if (isTooLarge(stat.size)) {
      return {
        ok: false,
        reason: `File too large to load fully (${stat.size} bytes).`,
      };
    }
    const content = await fsp.readFile(check.abs, "utf8");
    return { ok: true, content };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

/** Plain-text substring search across workspace files (PRD search_code). */
export async function searchCode(
  workspaceRoot: string,
  query: string,
  maxHits = 60
): Promise<string[]> {
  if (!query.trim()) {
    return [];
  }
  const needle = query.toLowerCase();
  const files = await listFiles(workspaceRoot, ".", 2000);
  const hits: string[] = [];

  for (const f of files) {
    if (f.isDir) {
      continue;
    }
    if (hits.length >= maxHits) {
      break;
    }
    const res = await readWorkspaceFile(workspaceRoot, f.relPath, false);
    if (!res.ok || !res.content) {
      continue;
    }
    const lines = res.content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(needle)) {
        hits.push(`${f.relPath}:${i + 1}: ${lines[i].trim()}`);
        if (hits.length >= maxHits) {
          break;
        }
      }
    }
  }
  return hits;
}
