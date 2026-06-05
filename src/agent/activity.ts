/**
 * Pure, vscode-free helpers for surfacing live agent activity (Phase H).
 * Kept separate from the loop and from vscode so the mapping can be unit
 * tested in isolation — same pattern as commandPolicy.core.ts.
 */

/**
 * Progress events emitted as the agent loop runs. Surfaces let callers (e.g.
 * the sidebar chat) show live activity instead of a silent spinner.
 */
export type AgentEvent =
  | { kind: "tool"; step: number; tool: string; reason?: string }
  | { kind: "tool_result"; step: number; tool: string; ok: boolean }
  | { kind: "notice"; text: string };

/** Map canonical tool names to human-readable, present-tense activity. */
const TOOL_LABELS: Record<string, string> = {
  get_workspace_root: "Locating the workspace",
  get_active_file: "Reading the active file",
  get_selection: "Reading the selection",
  list_files: "Listing files",
  read_file: "Reading a file",
  search_code: "Searching the code",
  read_diagnostics: "Checking diagnostics",
  git_status: "Checking git status",
  git_diff: "Reviewing changes",
  propose_patch: "Proposing an edit",
  run_command: "Preparing a command",
  retrieve_memory: "Recalling project memory",
  save_memory: "Saving to project memory",
};

/** Human-readable label for a tool name (falls back gracefully). */
export function describeTool(tool: string): string {
  return TOOL_LABELS[tool] ?? `Using ${tool}`;
}

/**
 * Tools that pause for human approval. The sidebar surfaces an extra hint so
 * the user knows to look for the modal dialog / diff instead of waiting.
 */
const APPROVAL_HINTS: Record<string, string> = {
  propose_patch: "review the diff and approve in the dialog to apply",
  run_command: "approve the command in the dialog to run it",
};

/**
 * Render an agent event as a single, present-tense activity line for the
 * sidebar. Returns an empty string for events that should not be shown
 * (e.g. successful tool results, which are implied by the next step).
 */
export function formatAgentEvent(event: AgentEvent): string {
  switch (event.kind) {
    case "notice":
      return `… ${event.text}\n`;
    case "tool_result":
      return event.ok ? "" : `  ⚠ ${describeTool(event.tool)} had no result.\n`;
    case "tool": {
      const hint = APPROVAL_HINTS[event.tool];
      return hint
        ? `→ ${describeTool(event.tool)} — ${hint}\n`
        : `→ ${describeTool(event.tool)}\n`;
    }
    default:
      return "";
  }
}
