import { ToolRegistry } from "../tools/registry";

/**
 * Prompt construction (PRD 14.2 / 14.3). The agent uses a strict JSON protocol
 * so we can parse tool calls vs final answers.
 */

export function systemPrompt(workspaceRoot: string, memoryBlock: string): string {
  return [
    "You are Inner Loop, a local-first AI coding operator embedded in VS Code.",
    "You operate ONLY within the user's active workspace. You never invent files.",
    "",
    `Workspace root: ${workspaceRoot}`,
    "",
    memoryBlock ? memoryBlock + "\n" : "",
    "You work in a tool loop. On each turn you MUST respond with a SINGLE JSON",
    "object and nothing else. No markdown fences, no prose outside JSON.",
    "",
    "To call a tool:",
    '{"action":"tool","tool":"<name>","args":{...},"reason":"<why>"}',
    "",
    "To finish:",
    '{"action":"final","summary":"<what you did/learned>","changes":[],"next_steps":[]}',
    "",
    "Available tools:",
    ToolRegistry.catalog(),
    "",
    "Rules:",
    "- Inspect before concluding. Read relevant files via tools.",
    "- To create or change a file, call propose_patch with the FULL new file",
    "  content. The user reviews a diff and approves — do not ask permission in",
    "  prose, just call the tool.",
    "- To run tests/build, call run_command with an allowlisted command.",
    "- Keep tool calls purposeful; avoid redundant reads.",
    "- After your changes are applied, return a final answer summarizing them.",
    "- Never include secrets. Never access files outside the workspace.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/** A one-shot explain prompt (no tool loop) for fast explain commands. */
export function explainPrompt(opts: {
  kind: "file" | "selection" | "workspace";
  path?: string;
  language?: string;
  body: string;
  memoryBlock: string;
}): { system: string; user: string } {
  const system = [
    "You are Inner Loop, a precise local code explainer inside VS Code.",
    "Explain clearly and concisely. Surface responsibilities, key flow, and any",
    "potential issues. Prefer short paragraphs and tight bullets.",
    opts.memoryBlock ? "\n" + opts.memoryBlock : "",
  ].join("\n");

  let user: string;
  if (opts.kind === "workspace") {
    user = `Summarize the architecture of this workspace.\n\n${opts.body}`;
  } else if (opts.kind === "selection") {
    user = `Explain this selected ${opts.language ?? "code"} from ${opts.path}:\n\n${opts.body}`;
  } else {
    user = `Explain this ${opts.language ?? "code"} file (${opts.path}):\n\n${opts.body}`;
  }
  return { system, user };
}

/** Prompt that asks the model to rewrite a file given an instruction. */
export function editPrompt(opts: {
  path: string;
  language: string;
  original: string;
  instruction: string;
  memoryBlock: string;
  relatedContext?: string;
}): { system: string; user: string } {
  const system = [
    "You are Inner Loop, a careful local code editor inside VS Code.",
    "You will be given a file and an instruction. Return the COMPLETE new file",
    "content as raw text only — no markdown fences, no commentary, no diff.",
    "Preserve unrelated code, style, and indentation exactly.",
    opts.memoryBlock ? "\n" + opts.memoryBlock : "",
  ].join("\n");

  const user = [
    `File: ${opts.path}`,
    `Language: ${opts.language}`,
    opts.relatedContext ? `\nRelated context:\n${opts.relatedContext}` : "",
    `\nInstruction: ${opts.instruction}`,
    `\n----- BEGIN CURRENT FILE -----\n${opts.original}\n----- END CURRENT FILE -----`,
    "\nReturn ONLY the full updated file content.",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}
