import { ChatMessage } from "../agent/types";

/**
 * In-memory session continuity (PRD structure: sessionMemory.ts).
 * Holds a rolling transcript per workspace so multi-turn Ask has context.
 * Not persisted — cleared on reload, intentionally ephemeral and inspectable.
 */

interface Session {
  workspaceHash: string;
  messages: ChatMessage[];
  updatedAt: number;
}

const MAX_TURNS = 20;
const sessions = new Map<string, Session>();

export const SessionMemory = {
  get(workspaceHash: string): ChatMessage[] {
    return sessions.get(workspaceHash)?.messages ?? [];
  },

  append(workspaceHash: string, message: ChatMessage): void {
    const existing = sessions.get(workspaceHash) ?? {
      workspaceHash,
      messages: [],
      updatedAt: Date.now(),
    };
    existing.messages.push(message);
    // Keep only the most recent turns to bound the prompt size.
    if (existing.messages.length > MAX_TURNS) {
      existing.messages = existing.messages.slice(-MAX_TURNS);
    }
    existing.updatedAt = Date.now();
    sessions.set(workspaceHash, existing);
  },

  clear(workspaceHash: string): void {
    sessions.delete(workspaceHash);
  },

  /** A compact recap of recent exchanges for prompt injection. */
  recap(workspaceHash: string, maxChars = 1500): string {
    const msgs = this.get(workspaceHash);
    if (msgs.length === 0) {
      return "";
    }
    const lines = msgs
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => `${m.role === "user" ? "You" : "Inner Loop"}: ${m.content}`);
    let recap = lines.join("\n");
    if (recap.length > maxChars) {
      recap = "…\n" + recap.slice(recap.length - maxChars);
    }
    return `Recent conversation:\n${recap}`;
  },
};
