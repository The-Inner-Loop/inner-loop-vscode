import { MemoryRecord, MemoryType } from "../agent/types";
import { ProjectMemory } from "./projectMemory";
import { Retrieval } from "./retrieval";
import { OllamaClient } from "../model/ollamaClient";
import { Settings } from "../config/settings";

/**
 * Memory service (Phase E). Wraps ProjectMemory + Retrieval with optional
 * local embeddings. Embedding is best-effort: if the embed model is missing or
 * fails, we still save the record and fall back to keyword retrieval.
 */
export const MemoryService = {
  /** Save a memory, attaching an embedding when possible. */
  async remember(input: {
    workspaceHash: string;
    type: MemoryType;
    content: string;
    source?: string;
    importance?: number;
  }): Promise<MemoryRecord> {
    let embedding: number[] | undefined;
    try {
      const client = new OllamaClient(Settings.ollamaUrl());
      const vec = await client.embed(Settings.embedModel(), input.content);
      embedding = vec.length > 0 ? vec : undefined;
    } catch {
      embedding = undefined;
    }
    return ProjectMemory.create({ ...input, embedding });
  },

  /** Retrieve relevant memory, semantic-first with keyword fallback. */
  async recall(workspaceHash: string, query: string, limit = 6): Promise<MemoryRecord[]> {
    if (!Settings.memoryEnabled()) {
      return [];
    }
    const client = new OllamaClient(Settings.ollamaUrl());
    return Retrieval.relevantSemantic(
      workspaceHash,
      query,
      (text) => client.embed(Settings.embedModel(), text),
      limit
    );
  },

  /** Convenience: recall and format as a prompt block in one call. */
  async recallBlock(workspaceHash: string, query: string, limit = 6): Promise<string> {
    const records = await this.recall(workspaceHash, query, limit);
    return Retrieval.asPromptBlock(records);
  },
};
