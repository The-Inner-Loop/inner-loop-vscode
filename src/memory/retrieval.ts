import { MemoryRecord } from "../agent/types";
import { ProjectMemory } from "./projectMemory";

/**
 * Lightweight relevance retrieval (PRD 13.4).
 * Phase 1: keyword overlap scoring + importance weighting. No embeddings yet.
 */

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

function score(query: string[], record: MemoryRecord): number {
  const content = tokenize(record.content);
  if (content.length === 0) {
    return 0;
  }
  const contentSet = new Set(content);
  let overlap = 0;
  for (const q of query) {
    if (contentSet.has(q)) {
      overlap++;
    }
  }
  // Importance acts as a gentle prior so high-value rules surface even with
  // little lexical overlap.
  return overlap + record.importance * 0.25;
}

export const Retrieval = {
  /** Return up to `limit` memories most relevant to the query. */
  relevant(workspaceHash: string, query: string, limit = 6): MemoryRecord[] {
    const all = ProjectMemory.list(workspaceHash);
    if (all.length === 0) {
      return [];
    }
    const q = tokenize(query);
    if (q.length === 0) {
      return all.slice(0, limit);
    }
    return all
      .map((m) => ({ m, s: score(q, m) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map((x) => x.m);
  },

  /** Format memories as a compact block for prompt injection. */
  asPromptBlock(records: MemoryRecord[]): string {
    if (records.length === 0) {
      return "";
    }
    const lines = records.map((m) => `- (${m.type}) ${m.content}`);
    return `Known project memory:\n${lines.join("\n")}`;
  },
};
