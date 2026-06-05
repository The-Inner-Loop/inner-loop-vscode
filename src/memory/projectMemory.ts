import { MemoryRecord, MemoryType } from "../agent/types";
import { Db } from "./db";

/**
 * Project memory CRUD scoped by workspace_hash (PRD 13).
 */

export interface CreateMemoryInput {
  workspaceHash: string;
  type: MemoryType;
  content: string;
  source?: string;
  importance?: number;
  embedding?: number[];
}

export const ProjectMemory = {
  create(input: CreateMemoryInput): MemoryRecord {
    const now = new Date().toISOString();
    const record: MemoryRecord = {
      id: Db.newId(),
      workspace_hash: input.workspaceHash,
      type: input.type,
      content: input.content.trim(),
      source: input.source,
      importance: input.importance ?? 1,
      embedding: input.embedding,
      created_at: now,
      updated_at: now,
    };
    Db.insert(record);
    return record;
  },

  list(workspaceHash: string): MemoryRecord[] {
    return Db.all()
      .filter((m) => m.workspace_hash === workspaceHash)
      .sort((a, b) => b.importance - a.importance || b.created_at.localeCompare(a.created_at));
  },

  delete(id: string): boolean {
    return Db.deleteById(id);
  },
};
