import * as fs from "fs";
import * as crypto from "crypto";
import { MemoryRecord } from "../agent/types";
import { MEMORY_FILE, ensureLayout } from "./paths";

/**
 * Minimal local store for memory records.
 *
 * NOTE: The PRD specifies SQLite (better-sqlite3). To keep Phase 1 install
 * frictionless (no native module rebuild against the Electron ABI), this uses
 * a plain JSON file with the SAME logical schema as the PRD `memories` table.
 * It is intentionally swappable for a SQLite-backed implementation later.
 */

interface StoreShape {
  version: 1;
  memories: MemoryRecord[];
}

function emptyStore(): StoreShape {
  return { version: 1, memories: [] };
}

function readStore(): StoreShape {
  ensureLayout();
  try {
    const raw = fs.readFileSync(MEMORY_FILE, "utf8");
    const parsed = JSON.parse(raw) as StoreShape;
    if (!parsed || !Array.isArray(parsed.memories)) {
      return emptyStore();
    }
    return parsed;
  } catch {
    // Missing or corrupt → start fresh (UX.md: don't crash on bad data).
    return emptyStore();
  }
}

function writeStore(store: StoreShape): void {
  ensureLayout();
  const tmp = MEMORY_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, MEMORY_FILE); // atomic-ish replace
}

export const Db = {
  all(): MemoryRecord[] {
    return readStore().memories;
  },

  insert(record: MemoryRecord): void {
    const store = readStore();
    store.memories.push(record);
    writeStore(store);
  },

  deleteById(id: string): boolean {
    const store = readStore();
    const before = store.memories.length;
    store.memories = store.memories.filter((m) => m.id !== id);
    if (store.memories.length !== before) {
      writeStore(store);
      return true;
    }
    return false;
  },

  newId(): string {
    return crypto.randomUUID();
  },
};
