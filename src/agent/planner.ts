import { AgentDecision } from "./types";
import { ToolRegistry } from "../tools/registry";

/**
 * Robust parser for the model's JSON protocol (PRD 14).
 * Tolerates models that wrap JSON in code fences or add stray prose.
 */

function extractJsonBlock(text: string): string | undefined {
  const trimmed = text.trim();

  // Strip ```json ... ``` or ``` ... ``` fences.
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;

  // Fast path: whole thing is JSON.
  if (candidate.startsWith("{") && candidate.endsWith("}")) {
    return candidate;
  }

  // Otherwise find the first balanced {...} object.
  const start = candidate.indexOf("{");
  if (start === -1) {
    return undefined;
  }
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return candidate.slice(start, i + 1);
      }
    }
  }
  return undefined;
}

export interface ParseResult {
  decision?: AgentDecision;
  /** When parsing fails, treat the raw text as a final answer. */
  fallbackText?: string;
}

export function parseDecision(modelText: string): ParseResult {
  const block = extractJsonBlock(modelText);
  if (!block) {
    return { fallbackText: modelText.trim() };
  }
  try {
    const obj = JSON.parse(block) as Record<string, unknown>;
    const knownTools = new Set(ToolRegistry.all().map((t) => t.name));

    // Resolve the intended tool name across common model deviations:
    //  - {"action":"tool","tool":"x"}        (canonical)
    //  - {"action":"x", ...}                 (tool name placed in action)
    //  - {"tool":"x"} / {"name":"x"} / {"tool_call":"x"} / {"function":"x"}
    const candidateName = [
      typeof obj.tool === "string" ? obj.tool : undefined,
      typeof obj.name === "string" ? obj.name : undefined,
      typeof obj.tool_call === "string" ? obj.tool_call : undefined,
      typeof obj.function === "string" ? obj.function : undefined,
      typeof obj.action === "string" && obj.action !== "tool" && obj.action !== "final"
        ? obj.action
        : undefined,
    ].find((n) => n && knownTools.has(n));

    const isToolAction =
      obj.action === "tool" && typeof obj.tool === "string" && knownTools.has(obj.tool);

    if (isToolAction || candidateName) {
      const toolName = isToolAction ? (obj.tool as string) : (candidateName as string);
      return {
        decision: {
          action: "tool",
          tool: toolName,
          args: gatherArgs(obj, toolName),
          reason: typeof obj.reason === "string" ? obj.reason : undefined,
        },
      };
    }

    if (obj.action === "final") {
      return {
        decision: {
          action: "final",
          summary: typeof obj.summary === "string" ? obj.summary : "(no summary)",
          changes: Array.isArray(obj.changes) ? (obj.changes as string[]) : [],
          next_steps: Array.isArray(obj.next_steps)
            ? (obj.next_steps as string[])
            : [],
        },
      };
    }
    return { fallbackText: modelText.trim() };
  } catch {
    return { fallbackText: modelText.trim() };
  }
}

/**
 * Collect tool args whether the model nested them under "args"/"arguments"
 * or flattened them as siblings of the action (e.g. {action, path, content}).
 */
function gatherArgs(
  obj: Record<string, unknown>,
  _toolName: string
): Record<string, unknown> {
  const nested = (obj.args ?? obj.arguments ?? obj.parameters) as
    | Record<string, unknown>
    | undefined;
  if (nested && typeof nested === "object") {
    return nested;
  }
  // Flattened form: take every key except the protocol/control keys.
  const reserved = new Set([
    "action",
    "tool",
    "name",
    "tool_call",
    "function",
    "reason",
    "args",
    "arguments",
    "parameters",
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!reserved.has(k)) {
      out[k] = v;
    }
  }
  return out;
}
