import { Tool, ToolContext, ToolResult } from "../agent/types";
import { listFiles, readWorkspaceFile, searchCode } from "../vscode/files";
import { getActiveFile, getSelection } from "../vscode/editor";
import { readDiagnostics } from "../vscode/diagnostics";
import { Retrieval } from "../memory/retrieval";
import { ProjectMemory } from "../memory/projectMemory";
import { MemoryService } from "../memory/memoryService";
import { MemoryType } from "../agent/types";
import { Git } from "./git";
import * as path from "path";
import { resolveInsideWorkspace, isProtected } from "../safety/filePolicy";
import { showDiff, applyPatch, ProposedPatch } from "../vscode/diff";
import { requestApproval } from "../safety/approval";
import { checkCommand, safeAlternative } from "../safety/commandPolicy";
import { runCommand } from "../vscode/terminal";
import { Settings } from "../config/settings";

/**
 * Tool registry (PRD 14). Read-only tools run autonomously. Mutating tools
 * (propose_patch, run_command) are still gated by the approval modal and the
 * file/command safety policies — the agent can act, but never silently.
 */

function ok(content: string, data?: unknown): ToolResult {
  return { ok: true, content, data };
}
function fail(content: string): ToolResult {
  return { ok: false, content };
}

function str(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  return typeof v === "string" ? v : "";
}

const tools: Tool[] = [
  {
    name: "get_workspace_root",
    description: "Return the absolute path of the active workspace root.",
    mutating: false,
    async run(_args, ctx: ToolContext) {
      return ok(ctx.workspaceRoot);
    },
  },
  {
    name: "get_active_file",
    description: "Return the path, language and full text of the active editor file.",
    mutating: false,
    async run() {
      const f = getActiveFile();
      if (!f) {
        return fail("No active editor.");
      }
      return ok(
        `path: ${f.path}\nlanguage: ${f.languageId}\n\n${f.text}`,
        f
      );
    },
  },
  {
    name: "get_selection",
    description: "Return the currently selected text in the active editor.",
    mutating: false,
    async run() {
      const s = getSelection();
      if (!s) {
        return fail("No active selection.");
      }
      return ok(
        `path: ${s.path}\nlanguage: ${s.languageId}\nlines ${s.startLine}-${s.endLine}\n\n${s.selectedText}`,
        s
      );
    },
  },
  {
    name: "list_files",
    description: "List workspace files (ignored dirs skipped). Optional arg: dir.",
    mutating: false,
    async run(args, ctx) {
      const dir = str(args, "dir") || ".";
      const files = await listFiles(ctx.workspaceRoot, dir);
      return ok(files.map((f) => (f.isDir ? f.relPath + "/" : f.relPath)).join("\n"));
    },
  },
  {
    name: "read_file",
    description: "Read a workspace file. Arg: path. Protected files are blocked.",
    mutating: false,
    async run(args, ctx) {
      const p = str(args, "path");
      if (!p) {
        return fail("Missing 'path' argument.");
      }
      const res = await readWorkspaceFile(ctx.workspaceRoot, p, false);
      if (!res.ok) {
        return fail(res.reason ?? "Unable to read file.");
      }
      return ok(res.content ?? "");
    },
  },
  {
    name: "search_code",
    description: "Plain-text search across workspace files. Arg: query.",
    mutating: false,
    async run(args, ctx) {
      const q = str(args, "query");
      if (!q) {
        return fail("Missing 'query' argument.");
      }
      const hits = await searchCode(ctx.workspaceRoot, q);
      return ok(hits.length ? hits.join("\n") : "No matches.");
    },
  },
  {
    name: "read_diagnostics",
    description: "Return current Problems-panel diagnostics for the workspace.",
    mutating: false,
    async run() {
      const diags = readDiagnostics();
      if (diags.length === 0) {
        return ok("No diagnostics.");
      }
      return ok(
        diags
          .map((d) => `${d.severity} ${d.file}:${d.line} ${d.message}`)
          .join("\n")
      );
    },
  },
  {
    name: "git_status",
    description: "Return `git status` for the workspace.",
    mutating: false,
    async run(_args, ctx) {
      return ok(await Git.status(ctx.workspaceRoot));
    },
  },
  {
    name: "git_diff",
    description: "Return `git diff` for the workspace.",
    mutating: false,
    async run(_args, ctx) {
      return ok(await Git.diff(ctx.workspaceRoot));
    },
  },
  {
    name: "propose_patch",
    description:
      "Propose writing/overwriting a file. Args: path, content. Opens a diff and requires user approval before applying. Use for creating or editing files.",
    mutating: true,
    async run(args, ctx) {
      const p = str(args, "path");
      const content = str(args, "content");
      if (!p) {
        return fail("Missing 'path' argument.");
      }
      const check = resolveInsideWorkspace(p, ctx.workspaceRoot);
      if (!check.ok) {
        return fail(check.reason ?? "Path outside workspace.");
      }
      if (isProtected(check.abs)) {
        return fail(`Refused: '${p}' is a protected/secret file.`);
      }

      const existing = await readWorkspaceFile(ctx.workspaceRoot, p, false);
      const originalText = existing.ok ? existing.content ?? "" : "";

      const patch: ProposedPatch = {
        targetPath: check.abs,
        originalText,
        proposedText: content.endsWith("\n") ? content : content + "\n",
        description: `Agent edit: ${p}`,
      };

      await showDiff(patch);

      if (!Settings.autoApproveWrites()) {
        ctx.onEvent?.({
          kind: "notice",
          text: `Awaiting your approval to write ${path.basename(p)} (see the dialog / diff).`,
        });
        let choice = await requestApproval(
          `Inner Loop wants to write ${path.basename(p)}. Review the diff, then Apply.`,
          { approveLabel: "Apply Patch", detailsLabel: "Open Diff" }
        );
        // "Open Diff" should re-focus the diff for review, not decline the edit.
        while (choice === "details") {
          await showDiff(patch);
          choice = await requestApproval(
            `Inner Loop wants to write ${path.basename(p)}. Review the diff, then Apply.`,
            { approveLabel: "Apply Patch", detailsLabel: "Open Diff" }
          );
        }
        if (choice !== "approve") {
          return fail(`User declined the edit to ${p}.`);
        }
      }

      const applied = await applyPatch(patch);
      if (!applied) {
        return fail(`Failed to apply patch to ${p}.`);
      }
      ProjectMemory.create({
        workspaceHash: ctx.workspaceHash,
        type: "task_result",
        content: `Wrote ${p} (agent).`,
        source: "propose_patch",
      });
      return ok(`Applied changes to ${p}.`);
    },
  },
  {
    name: "run_command",
    description:
      "Run an allowlisted shell command after approval. Arg: command. Blocked/destructive commands are denied.",
    mutating: true,
    async run(args, ctx) {
      const command = str(args, "command");
      if (!command) {
        return fail("Missing 'command' argument.");
      }
      const verdict = checkCommand(command);
      if (!verdict.allowed) {
        return fail(
          `${verdict.reason} Suggestion: ${safeAlternative(command)}`
        );
      }
      if (!Settings.autoApproveCommands()) {
        ctx.onEvent?.({
          kind: "notice",
          text: `Awaiting your approval to run "${command}" (see the dialog).`,
        });
        const choice = await requestApproval(`Run "${command}"?`, {
          approveLabel: "Run Command",
        });
        if (choice !== "approve") {
          return fail(`User declined to run: ${command}`);
        }
      }
      const res = await runCommand(command, ctx.workspaceRoot);
      const out = [res.stdout, res.stderr].filter(Boolean).join("\n").trim();
      return ok(`exit ${res.code}\n${out || "(no output)"}`);
    },
  },
  {
    name: "retrieve_memory",
    description: "Retrieve relevant project memory. Arg: query.",
    mutating: false,
    async run(args, ctx) {
      const q = str(args, "query");
      const records = await MemoryService.recall(ctx.workspaceHash, q);
      return ok(Retrieval.asPromptBlock(records) || "No relevant memory.");
    },
  },
  {
    name: "save_memory",
    description:
      "Save a project memory. Args: type, content. Type defaults to 'rule'.",
    mutating: false,
    async run(args, ctx) {
      const content = str(args, "content");
      if (!content) {
        return fail("Missing 'content' argument.");
      }
      const type = (str(args, "type") || "rule") as MemoryType;
      const rec = await MemoryService.remember({
        workspaceHash: ctx.workspaceHash,
        type,
        content,
        source: "agent",
      });
      return ok(`Saved memory ${rec.id} (${rec.type}).`);
    },
  },
];

export const ToolRegistry = {
  get(name: string): Tool | undefined {
    return tools.find((t) => t.name === name);
  },
  all(): Tool[] {
    return tools;
  },
  /** Compact catalog for prompt injection. */
  catalog(): string {
    return tools.map((t) => `- ${t.name}: ${t.description}`).join("\n");
  },
};
