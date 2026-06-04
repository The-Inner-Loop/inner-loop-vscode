import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/**
 * Local on-disk paths for Inner Loop (PRD 13.1, 15.3, 19.3).
 * Everything lives OUTSIDE the workspace, under ~/.innerloop.
 */

export const ROOT_DIR = path.join(os.homedir(), ".innerloop");
export const MEMORY_DIR = path.join(ROOT_DIR, "memory");
export const MEMORY_FILE = path.join(MEMORY_DIR, "innerloop.json");
export const TMP_DIR = path.join(ROOT_DIR, "tmp");
export const LOGS_DIR = path.join(ROOT_DIR, "logs");

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function ensureLayout(): void {
  ensureDir(MEMORY_DIR);
  ensureDir(TMP_DIR);
  ensureDir(LOGS_DIR);
}
