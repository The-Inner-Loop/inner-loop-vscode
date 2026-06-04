/**
 * Shared types for the Inner Loop agent core.
 */

export type MemoryType =
  | "architecture"
  | "command"
  | "rule"
  | "decision"
  | "task_result"
  | "summary"
  | "preference"
  | "constraint";

export interface MemoryRecord {
  id: string;
  workspace_hash: string;
  type: MemoryType;
  content: string;
  source?: string;
  importance: number;
  created_at: string;
  updated_at: string;
}

/** A single message in an Ollama chat exchange. */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

/** Structured tool call requested by the model. */
export interface ToolCall {
  action: "tool";
  tool: string;
  args: Record<string, unknown>;
  reason?: string;
}

/** Final answer emitted by the model. */
export interface FinalAnswer {
  action: "final";
  summary: string;
  changes?: string[];
  next_steps?: string[];
}

export type AgentDecision = ToolCall | FinalAnswer;

/** Result returned from executing a tool. */
export interface ToolResult {
  ok: boolean;
  /** Human/Model readable content to feed back into the loop. */
  content: string;
  /** Optional structured data for internal use. */
  data?: unknown;
}

/** Context passed to every tool when it runs. */
export interface ToolContext {
  workspaceRoot: string;
  workspaceHash: string;
}

export interface Tool {
  name: string;
  description: string;
  /** Whether running this tool can change disk/system state. */
  mutating: boolean;
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}
