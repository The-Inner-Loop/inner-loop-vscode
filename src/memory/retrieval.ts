import { MemoryRecord } from "../agent/types";
import { ProjectMemory } from "./projectMemory";
import { cosineSimilarity } from "./vector";

/**
 * Relevance retrieval (PRD 13.4).
 * - Keyword overlap scoring (always available, sync).
 * - Semantic scoring via local embeddings (Phase E, async) with graceful
 *   fallback to keyword when no embeddings/model are present.
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

/** Embeds a query and scores records by cosine similarity. */
export type Embedder = (text: string) => Promise<number[]>;

export const Retrieval = {
  /** Keyword retrieval — synchronous, always available. */
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

  /**
   * Semantic retrieval — embeds the query and ranks by cosine similarity
   * against stored embeddings, blended with importance. Falls back to keyword
   * retrieval if embedding fails or no records carry embeddings.
   */
  async relevantSemantic(
    workspaceHash: string,
    query: string,
    embed: Embedder,
    limit = 6
  ): Promise<MemoryRecord[]> {
    const all = ProjectMemory.list(workspaceHash);
    if (all.length === 0) {
      return [];
    }
    const withVectors = all.filter((m) => m.embedding && m.embedding.length > 0);
    if (withVectors.length === 0) {
      return this.relevant(workspaceHash, query, limit);
    }

    const queryVec = await embed(query);
    if (queryVec.length === 0) {
      return this.relevant(workspaceHash, query, limit);
    }

    const scored = all.map((m) => {
      const sim = m.embedding ? cosineSimilarity(queryVec, m.embedding) : 0;
      // Blend semantic similarity with a gentle importance prior.
      return { m, s: sim + m.importance * 0.05 };
    });

    return scored
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
