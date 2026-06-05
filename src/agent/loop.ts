import { ChatMessage, FinalAnswer, ToolContext } from "./types";
import { OllamaClient } from "../model/ollamaClient";
import { ToolRegistry } from "../tools/registry";
import { parseDecision } from "./planner";
import { systemPrompt } from "./prompts";
import { MemoryService } from "../memory/memoryService";
import { SessionMemory } from "../memory/sessionMemory";
import { Settings } from "../config/settings";
import { Output } from "../ui/output";
import { AgentEvent } from "./activity";

export { AgentEvent } from "./activity";

/**
 * The agent tool loop (PRD 14 / 7). Bounded by innerLoop.maxAgentSteps.
 * Read-only tools run autonomously; the loop terminates on a final answer,
 * step budget exhaustion, or a parsing fallback.
 */

export interface AgentRunResult {
  final: FinalAnswer;
  steps: number;
}

export async function runAgent(
  client: OllamaClient,
  task: string,
  ctx: ToolContext,
  signal?: AbortSignal,
  onEvent?: (event: AgentEvent) => void
): Promise<AgentRunResult> {
  const model = Settings.model();
  const maxSteps = Settings.maxAgentSteps();

  // Let approval-gated tools surface "awaiting approval" hints to live surfaces.
  const toolCtx: ToolContext = {
    ...ctx,
    onEvent: (e) => onEvent?.({ kind: "notice", text: e.text }),
  };

  const memoryBlock = Settings.memoryEnabled()
    ? await MemoryService.recallBlock(ctx.workspaceHash, task)
    : "";

  // Bring prior conversation turns into context for continuity.
  const recap = SessionMemory.recap(ctx.workspaceHash);
  const systemContent = recap
    ? `${systemPrompt(ctx.workspaceRoot, memoryBlock)}\n\n${recap}`
    : systemPrompt(ctx.workspaceRoot, memoryBlock);

  const messages: ChatMessage[] = [
    { role: "system", content: systemContent },
    { role: "user", content: task },
  ];

  // Record the user's turn for future continuity.
  SessionMemory.append(ctx.workspaceHash, { role: "user", content: task });

  let corrections = 0;
  for (let step = 1; step <= maxSteps; step++) {
    if (signal?.aborted) {
      return {
        final: {
          action: "final",
          summary: "Cancelled by user.",
          changes: [],
          next_steps: [],
        },
        steps: step,
      };
    }
    const raw = await client.chat({ model, messages, json: true, signal });
    const { decision, fallbackText } = parseDecision(raw);

    if (!decision) {
      const text = fallbackText ?? raw;
      // If it looks like an attempted (but malformed) tool/JSON call, nudge the
      // model back onto the protocol once — don't dump raw JSON as the answer.
      const looksLikeJson = /^\s*\{/.test(text) && /"(action|tool|content|path)"/.test(text);
      if (looksLikeJson && corrections < 2) {
        corrections++;
        Output.info(`step ${step}: malformed tool call — re-prompting (${corrections}/2).`);
        onEvent?.({ kind: "notice", text: "Re-checking my response format…" });
        messages.push({ role: "assistant", content: text });
        messages.push({
          role: "user",
          content:
            'Your last message was not valid. Respond with EXACTLY one JSON object using this schema and nothing else: ' +
            '{"action":"tool","tool":"<tool_name>","args":{...},"reason":"..."} ' +
            'or {"action":"final","summary":"...","changes":[],"next_steps":[]}.',
        });
        continue;
      }
      // Genuine prose — accept it as the final answer.
      SessionMemory.append(ctx.workspaceHash, { role: "assistant", content: text });
      return {
        final: { action: "final", summary: text, changes: [], next_steps: [] },
        steps: step,
      };
    }

    if (decision.action === "final") {
      SessionMemory.append(ctx.workspaceHash, {
        role: "assistant",
        content: decision.summary,
      });
      return { final: decision, steps: step };
    }

    // Tool call.
    const tool = ToolRegistry.get(decision.tool);
    Output.info(`step ${step}: tool ${decision.tool}${decision.reason ? ` — ${decision.reason}` : ""}`);
    onEvent?.({ kind: "tool", step, tool: decision.tool, reason: decision.reason });

    let resultContent: string;
    if (!tool) {
      resultContent = `Unknown tool: ${decision.tool}`;
    } else {
      try {
        const result = await tool.run(decision.args, toolCtx);
        resultContent = result.content;
        onEvent?.({ kind: "tool_result", step, tool: decision.tool, ok: result.ok });
      } catch (e) {
        resultContent = `Tool error: ${(e as Error).message}`;
        onEvent?.({ kind: "tool_result", step, tool: decision.tool, ok: false });
      }
    }

    // Feed the tool result back to the model.
    messages.push({ role: "assistant", content: JSON.stringify(decision) });
    messages.push({
      role: "user",
      content: `TOOL_RESULT (${decision.tool}):\n${truncate(resultContent, 6000)}`,
    });
  }

  return {
    final: {
      action: "final",
      summary: `Reached step limit (${maxSteps}) without a final answer.`,
      changes: [],
      next_steps: ["Increase innerLoop.maxAgentSteps or narrow the task."],
    },
    steps: maxSteps,
  };
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + "\n…(truncated)";
}
