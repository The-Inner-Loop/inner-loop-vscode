import { ChatMessage, FinalAnswer, ToolContext } from "./types";
import { OllamaClient } from "../model/ollamaClient";
import { ToolRegistry } from "../tools/registry";
import { parseDecision } from "./planner";
import { systemPrompt } from "./prompts";
import { Retrieval } from "../memory/retrieval";
import { Settings } from "../config/settings";
import { Output } from "../ui/output";

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
  ctx: ToolContext
): Promise<AgentRunResult> {
  const model = Settings.model();
  const maxSteps = Settings.maxAgentSteps();

  const memoryBlock = Settings.memoryEnabled()
    ? Retrieval.asPromptBlock(Retrieval.relevant(ctx.workspaceHash, task))
    : "";

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(ctx.workspaceRoot, memoryBlock) },
    { role: "user", content: task },
  ];

  let corrections = 0;
  for (let step = 1; step <= maxSteps; step++) {
    const raw = await client.chat({ model, messages, json: true });
    const { decision, fallbackText } = parseDecision(raw);

    if (!decision) {
      const text = fallbackText ?? raw;
      // If it looks like an attempted (but malformed) tool/JSON call, nudge the
      // model back onto the protocol once — don't dump raw JSON as the answer.
      const looksLikeJson = /^\s*\{/.test(text) && /"(action|tool|content|path)"/.test(text);
      if (looksLikeJson && corrections < 2) {
        corrections++;
        Output.info(`step ${step}: malformed tool call — re-prompting (${corrections}/2).`);
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
      return {
        final: { action: "final", summary: text, changes: [], next_steps: [] },
        steps: step,
      };
    }

    if (decision.action === "final") {
      return { final: decision, steps: step };
    }

    // Tool call.
    const tool = ToolRegistry.get(decision.tool);
    Output.info(`step ${step}: tool ${decision.tool}${decision.reason ? ` — ${decision.reason}` : ""}`);

    let resultContent: string;
    if (!tool) {
      resultContent = `Unknown tool: ${decision.tool}`;
    } else {
      try {
        const result = await tool.run(decision.args, ctx);
        resultContent = result.content;
      } catch (e) {
        resultContent = `Tool error: ${(e as Error).message}`;
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
