import * as vscode from "vscode";
import * as path from "path";
import { OllamaClient } from "../model/ollamaClient";
import { Settings } from "../config/settings";
import { Output } from "../ui/output";
import { Notify } from "../ui/notifications";
import { Status } from "../ui/statusBar";
import { resolveWorkspace } from "./workspace";
import { getActiveFile, getSelection } from "./editor";
import { listFiles, readWorkspaceFile } from "./files";
import { showDiff, applyPatch, ProposedPatch } from "./diff";
import { runCommand } from "./terminal";
import { runAgent } from "../agent/loop";
import { explainPrompt, editPrompt } from "../agent/prompts";
import { ProjectMemory } from "../memory/projectMemory";
import { Retrieval } from "../memory/retrieval";
import { MemoryType } from "../agent/types";
import { checkCommand, safeAlternative } from "../safety/commandPolicy";
import { isProtected } from "../safety/filePolicy";
import { requestApproval } from "../safety/approval";

/**
 * Command implementations (PRD 9 / 10). Each command resolves the workspace,
 * checks Ollama as needed, and reports through the Output channel.
 */

function client(): OllamaClient {
  return new OllamaClient(Settings.ollamaUrl());
}

/** Shared guard: ensure Ollama is up and the model is present. */
async function ensureReady(): Promise<OllamaClient | undefined> {
  const c = client();
  const reachable = await c.isReachable();
  if (!reachable) {
    Status.set("Ollama Offline");
    Notify.error("Ollama is not running. Start it with: ollama serve");
    Output.error("Ollama not reachable at " + Settings.ollamaUrl());
    return undefined;
  }
  const model = Settings.model();
  if (!(await c.hasModel(model))) {
    Notify.error(`Model not found. Install it with: ollama pull ${model}`);
    Output.error(`Model '${model}' is not installed.`);
    return undefined;
  }
  Status.set("Ready");
  return c;
}

function memoryBlockFor(workspaceHash: string, query: string): string {
  if (!Settings.memoryEnabled()) {
    return "";
  }
  return Retrieval.asPromptBlock(Retrieval.relevant(workspaceHash, query));
}

// ─────────────────────────────────────────────────────────────────────────
// Inner Loop: Check Ollama
// ─────────────────────────────────────────────────────────────────────────
export async function checkOllama(): Promise<void> {
  Output.show();
  Output.header("Check Ollama");
  Output.info(`Endpoint: ${Settings.ollamaUrl()}`);
  const c = client();
  try {
    const models = await c.listModels();
    if (models.length === 0) {
      Status.set("Ollama Offline");
      Output.info("Ollama is reachable but no models are installed.");
      Notify.warn(`No models found. Try: ollama pull ${Settings.model()}`);
      return;
    }
    Status.set("Ready");
    Output.info(`Found ${models.length} model(s):`);
    for (const m of models) {
      Output.line(`  • ${m.name}`);
    }
    const configured = Settings.model();
    const hasConfigured = await c.hasModel(configured);
    Output.info(
      hasConfigured
        ? `Configured model '${configured}' is available.`
        : `Configured model '${configured}' is NOT installed. Run: ollama pull ${configured}`
    );
    Notify.info(`Ollama OK — ${models.length} model(s) available.`);
  } catch (e) {
    Status.set("Ollama Offline");
    Output.error((e as Error).message);
    Notify.error("Ollama is not running. Start it with: ollama serve");
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Inner Loop: Ask  (full agent tool loop)
// ─────────────────────────────────────────────────────────────────────────
export async function ask(): Promise<void> {
  const ws = await resolveWorkspace();
  if (!ws) {
    return;
  }
  const prompt = await vscode.window.showInputBox({
    title: "Inner Loop: Ask",
    prompt: "What should Inner Loop do? (it can inspect the workspace)",
    placeHolder: "e.g. Explain how auth works, or find where config is loaded",
    ignoreFocusOut: true,
  });
  if (!prompt) {
    return;
  }

  const c = await ensureReady();
  if (!c) {
    return;
  }

  Output.show();
  Output.header("Ask");
  Output.info(`Workspace: ${ws.root}`);
  Output.info(`Model: ${Settings.model()}`);
  Output.info(`Task: ${prompt}`);
  Status.set("Thinking");

  try {
    const result = await runAgent(c, prompt, {
      workspaceRoot: ws.root,
      workspaceHash: ws.hash,
    });
    Output.header("Result");
    Output.line(result.final.summary);
    if (result.final.changes?.length) {
      Output.line("\nChanges:");
      result.final.changes.forEach((c2) => Output.line(`  • ${c2}`));
    }
    if (result.final.next_steps?.length) {
      Output.line("\nNext steps:");
      result.final.next_steps.forEach((s) => Output.line(`  • ${s}`));
    }
    Output.info(`Completed in ${result.steps} step(s).`);
  } catch (e) {
    Output.error((e as Error).message);
    Notify.error("Inner Loop: " + (e as Error).message);
  } finally {
    Status.set("Ready");
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Explain commands (one-shot, no tool loop)
// ─────────────────────────────────────────────────────────────────────────
async function explainOneShot(
  system: string,
  user: string,
  title: string
): Promise<void> {
  const c = await ensureReady();
  if (!c) {
    return;
  }
  Output.show();
  Output.header(title);
  Output.info(`Model: ${Settings.model()}`);
  Status.set("Thinking");
  try {
    Output.line("");
    const answer = await c.chatStream(
      {
        model: Settings.model(),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
      (chunk) => Output.append(chunk)
    );
    if (!answer.trim()) {
      Output.line("(empty response)");
    } else {
      Output.line("");
    }
  } catch (e) {
    Output.error((e as Error).message);
    Notify.error("Inner Loop: " + (e as Error).message);
  } finally {
    Status.set("Ready");
  }
}

export async function explainCurrentFile(): Promise<void> {
  const ws = await resolveWorkspace();
  if (!ws) {
    return;
  }
  const f = getActiveFile();
  if (!f) {
    Notify.warn("Inner Loop: open a file to explain.");
    return;
  }
  if (isProtected(f.path)) {
    Notify.warn("Inner Loop: refusing to send a protected/secret file to the model.");
    return;
  }
  const { system, user } = explainPrompt({
    kind: "file",
    path: path.relative(ws.root, f.path),
    language: f.languageId,
    body: f.text,
    memoryBlock: memoryBlockFor(ws.hash, f.text.slice(0, 400)),
  });
  await explainOneShot(system, user, "Explain Current File");
}

export async function explainSelection(): Promise<void> {
  const ws = await resolveWorkspace();
  if (!ws) {
    return;
  }
  const s = getSelection();
  if (!s) {
    Notify.warn("Inner Loop: select some code first.");
    return;
  }
  const { system, user } = explainPrompt({
    kind: "selection",
    path: path.relative(ws.root, s.path),
    language: s.languageId,
    body: s.selectedText,
    memoryBlock: memoryBlockFor(ws.hash, s.selectedText.slice(0, 400)),
  });
  await explainOneShot(system, user, "Explain Selection");
}

export async function explainWorkspace(): Promise<void> {
  const ws = await resolveWorkspace();
  if (!ws) {
    return;
  }
  const c = await ensureReady();
  if (!c) {
    return;
  }
  Output.show();
  Output.header("Explain Workspace");
  Output.info(`Workspace: ${ws.root}`);
  Status.set("Thinking");

  try {
    // Gather a conservative top-level snapshot.
    const files = await listFiles(ws.root, ".", 200);
    const topLevel = files
      .filter((f) => !f.relPath.includes(path.sep))
      .map((f) => (f.isDir ? f.relPath + "/" : f.relPath));

    const interesting = [
      "package.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "tsconfig.json",
      "pyproject.toml",
      "requirements.txt",
      "go.mod",
      "Cargo.toml",
      "README.md",
    ];
    const snippets: string[] = [];
    for (const name of interesting) {
      const res = await readWorkspaceFile(ws.root, name, false);
      if (res.ok && res.content) {
        snippets.push(`### ${name}\n${res.content.slice(0, 1500)}`);
      }
    }

    const body = [
      `Top-level entries:\n${topLevel.join("\n")}`,
      snippets.length ? `\nKey files:\n${snippets.join("\n\n")}` : "",
    ].join("\n");

    const { system, user } = explainPrompt({
      kind: "workspace",
      body,
      memoryBlock: memoryBlockFor(ws.hash, "architecture"),
    });

    Output.line("");
    const answer = await c.chatStream(
      {
        model: Settings.model(),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
      (chunk) => Output.append(chunk)
    );
    Output.line("");

    // Store the architecture summary in memory (PRD 10.5).
    if (Settings.memoryEnabled() && answer.trim()) {
      ProjectMemory.create({
        workspaceHash: ws.hash,
        type: "architecture",
        content: answer.trim().slice(0, 2000),
        source: "explainWorkspace",
      });
      Output.info("Stored architecture summary in memory.");
    }
  } catch (e) {
    Output.error((e as Error).message);
    Notify.error("Inner Loop: " + (e as Error).message);
  } finally {
    Status.set("Ready");
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Memory commands
// ─────────────────────────────────────────────────────────────────────────
export async function rememberRule(): Promise<void> {
  const ws = await resolveWorkspace();
  if (!ws) {
    return;
  }
  const content = await vscode.window.showInputBox({
    title: "Inner Loop: Remember Project Rule",
    prompt: "Enter a rule / fact to remember for this workspace",
    placeHolder: "e.g. This repo uses hexagonal architecture. Keep controllers thin.",
    ignoreFocusOut: true,
  });
  if (!content) {
    return;
  }

  const typePick = await vscode.window.showQuickPick(
    ["rule", "architecture", "command", "decision", "preference", "constraint"],
    { title: "Memory type", placeHolder: "Categorize this memory (default: rule)" }
  );
  const type = (typePick ?? "rule") as MemoryType;

  const rec = ProjectMemory.create({
    workspaceHash: ws.hash,
    type,
    content,
    source: "user",
    importance: 2,
  });
  Output.show();
  Output.header("Remember Project Rule");
  Output.info(`Saved (${rec.type}): ${rec.content}`);
  Notify.info("Inner Loop: memory saved.");
}

export async function showMemory(): Promise<void> {
  const ws = await resolveWorkspace();
  if (!ws) {
    return;
  }
  const records = ProjectMemory.list(ws.hash);
  Output.show();
  Output.header("Project Memory");
  Output.info(`Workspace: ${ws.root}`);
  if (records.length === 0) {
    Output.line("No memory stored yet. Use 'Inner Loop: Remember Project Rule'.");
    return;
  }
  for (const m of records) {
    Output.line(`  • [${m.type}] (importance ${m.importance}) ${m.content}`);
  }
  Output.info(`${records.length} memory record(s).`);
}

// ─────────────────────────────────────────────────────────────────────────
// Propose / Apply edit (PRD 10.3 / 10.4 / 15)
// ─────────────────────────────────────────────────────────────────────────
let lastPatch: ProposedPatch | undefined;

export async function proposeEdit(): Promise<void> {
  const ws = await resolveWorkspace();
  if (!ws) {
    return;
  }
  const f = getActiveFile();
  if (!f) {
    Notify.warn("Inner Loop: open a file to edit.");
    return;
  }
  if (isProtected(f.path)) {
    Notify.warn("Inner Loop: refusing to edit a protected/secret file.");
    return;
  }

  const instruction = await vscode.window.showInputBox({
    title: "Inner Loop: Propose Edit",
    prompt: "Describe the change to make to the current file",
    placeHolder: "e.g. Add input validation before calling the service",
    ignoreFocusOut: true,
  });
  if (!instruction) {
    return;
  }

  const c = await ensureReady();
  if (!c) {
    return;
  }

  Output.show();
  Output.header("Propose Edit");
  Output.info(`File: ${path.relative(ws.root, f.path)}`);
  Output.info(`Instruction: ${instruction}`);
  Status.set("Thinking");

  try {
    const sel = getSelection();
    const { system, user } = editPrompt({
      path: path.relative(ws.root, f.path),
      language: f.languageId,
      original: f.text,
      instruction,
      memoryBlock: memoryBlockFor(ws.hash, instruction),
      relatedContext: sel ? `Focus on lines ${sel.startLine}-${sel.endLine}.` : undefined,
    });

    const proposed = await c.chat({
      model: Settings.model(),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const proposedText = stripFences(proposed);
    if (!proposedText.trim() || proposedText.trim() === f.text.trim()) {
      Output.info("Model returned no actionable change.");
      Notify.info("Inner Loop: no change proposed.");
      return;
    }

    lastPatch = {
      targetPath: f.path,
      originalText: f.text,
      proposedText,
      description: instruction,
    };

    await showDiff(lastPatch);
    Status.set("Patch Ready");
    Output.info("Diff opened. Review, then approve to apply.");

    const choice = await requestApproval(
      `Apply proposed edit to ${path.basename(f.path)}?`,
      { approveLabel: "Apply Patch", detailsLabel: "Open Diff" }
    );

    if (choice === "approve") {
      await doApply(lastPatch, ws.hash);
    } else if (choice === "details") {
      await showDiff(lastPatch);
      Output.info("Run 'Inner Loop: Apply Last Patch' when ready.");
    } else {
      Output.info("Edit cancelled. Patch retained for 'Apply Last Patch'.");
    }
  } catch (e) {
    Output.error((e as Error).message);
    Notify.error("Inner Loop: " + (e as Error).message);
  } finally {
    if (Status) {
      // Leave "Patch Ready" if a patch is pending, else Ready.
      Status.set(lastPatch ? "Patch Ready" : "Ready");
    }
  }
}

export async function applyLastPatch(): Promise<void> {
  const ws = await resolveWorkspace();
  if (!ws) {
    return;
  }
  if (!lastPatch) {
    Notify.warn("Inner Loop: no pending patch. Run 'Propose Edit' first.");
    return;
  }
  if (!Settings.autoApproveWrites()) {
    const choice = await requestApproval(
      `Apply pending patch to ${path.basename(lastPatch.targetPath)}?`,
      { approveLabel: "Apply Patch", detailsLabel: "Open Diff" }
    );
    if (choice === "details") {
      await showDiff(lastPatch);
      return;
    }
    if (choice !== "approve") {
      Output.info("Apply cancelled.");
      return;
    }
  }
  await doApply(lastPatch, ws.hash);
}

async function doApply(patch: ProposedPatch, workspaceHash: string): Promise<void> {
  Output.show();
  Output.header("Apply Patch");
  const ok = await applyPatch(patch);
  if (ok) {
    Output.info(`Applied changes to ${patch.targetPath}`);
    Notify.info("Inner Loop: patch applied.");
    if (Settings.memoryEnabled()) {
      ProjectMemory.create({
        workspaceHash,
        type: "task_result",
        content: `Edited ${path.basename(patch.targetPath)}: ${patch.description}`,
        source: "applyPatch",
      });
    }
    lastPatch = undefined;
    Status.set("Ready");
  } else {
    Output.error("Failed to apply patch.");
    Notify.error("Inner Loop: failed to apply patch.");
  }
}

function stripFences(text: string): string {
  const fence = text.match(/```(?:[a-zA-Z0-9]+)?\s*([\s\S]*?)```/);
  return (fence ? fence[1] : text).replace(/\s+$/, "") + "\n";
}

// ─────────────────────────────────────────────────────────────────────────
// Inner Loop: Run Safe Test (PRD 16)
// ─────────────────────────────────────────────────────────────────────────
export async function runSafeTest(): Promise<void> {
  const ws = await resolveWorkspace();
  if (!ws) {
    return;
  }

  const preferred = Settings.defaultTestCommand();
  const allowlist = Settings.commandAllowlist();
  const command =
    preferred ||
    (await vscode.window.showQuickPick(allowlist, {
      title: "Inner Loop: Run Safe Test",
      placeHolder: "Select an allowlisted command to run",
    }));

  if (!command) {
    return;
  }

  const check = checkCommand(command);
  if (!check.allowed) {
    Output.show();
    Output.header("Run Safe Test");
    Output.error(check.reason ?? "Command blocked.");
    Output.info("Suggestion: " + safeAlternative(command));
    Notify.error("Inner Loop blocked command: " + (check.reason ?? command));
    return;
  }

  if (!Settings.autoApproveCommands()) {
    const choice = await requestApproval(`Run "${command}" in ${ws.name}?`, {
      approveLabel: "Run Command",
    });
    if (choice !== "approve") {
      Output.info("Command cancelled.");
      return;
    }
  }

  Output.show();
  Output.header("Run Safe Test");
  Output.info(`$ ${command}`);
  Output.info(`cwd: ${ws.root}`);
  Status.set("Thinking");
  try {
    const res = await runCommand(command, ws.root);
    if (res.stdout) {
      Output.line(res.stdout.trimEnd());
    }
    if (res.stderr) {
      Output.line(res.stderr.trimEnd());
    }
    Output.info(`Exit code: ${res.code}`);
    if (Settings.memoryEnabled()) {
      ProjectMemory.create({
        workspaceHash: ws.hash,
        type: "command",
        content: `Ran '${command}' → exit ${res.code}`,
        source: "runSafeTest",
      });
    }
  } catch (e) {
    Output.error((e as Error).message);
  } finally {
    Status.set("Ready");
  }
}
