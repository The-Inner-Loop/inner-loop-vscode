/**
 * Canonical tool names (PRD 14.1). Kept separate from the registry so the
 * parser can validate tool calls WITHOUT importing vscode-dependent code.
 * The registry is the source of behavior; this is the source of identity.
 */
export const TOOL_NAMES = [
  "get_workspace_root",
  "get_active_file",
  "get_selection",
  "list_files",
  "read_file",
  "search_code",
  "read_diagnostics",
  "git_status",
  "git_diff",
  "propose_patch",
  "run_command",
  "retrieve_memory",
  "save_memory",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export const TOOL_NAME_SET: ReadonlySet<string> = new Set(TOOL_NAMES);
