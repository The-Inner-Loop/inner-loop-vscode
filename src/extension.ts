import * as vscode from "vscode";
import { Output } from "./ui/output";
import { Status } from "./ui/statusBar";
import { Settings } from "./config/settings";
import { ensureLayout } from "./memory/paths";
import { OllamaClient } from "./model/ollamaClient";
import { ChatViewProvider } from "./vscode/webview";
import * as commands from "./vscode/commands";

/**
 * Inner Loop Code — extension entry point.
 * Local-first AI coding agent for VS Code, powered by Ollama. No cloud, no
 * telemetry, no GitHub required.
 */
export function activate(context: vscode.ExtensionContext): void {
  ensureLayout();
  Output.init();
  Output.info("Inner Loop Code activated.");
  Status.init();

  const register = (id: string, handler: () => Promise<void> | void) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, async () => {
        try {
          await handler();
        } catch (e) {
          const msg = (e as Error).message ?? String(e);
          Output.error(`${id}: ${msg}`);
          vscode.window.showErrorMessage(`Inner Loop: ${msg}`);
        }
      })
    );
  };

  register("innerLoop.ask", commands.ask);
  register("innerLoop.checkOllama", commands.checkOllama);
  register("innerLoop.explainCurrentFile", commands.explainCurrentFile);
  register("innerLoop.explainSelection", commands.explainSelection);
  register("innerLoop.explainWorkspace", commands.explainWorkspace);
  register("innerLoop.proposeEdit", commands.proposeEdit);
  register("innerLoop.applyLastPatch", commands.applyLastPatch);
  register("innerLoop.rememberRule", commands.rememberRule);
  register("innerLoop.showMemory", commands.showMemory);
  register("innerLoop.runSafeTest", commands.runSafeTest);

  // Sidebar chat webview (Phase H).
  const chatProvider = new ChatViewProvider(context.extensionUri, {
    onPrompt: (prompt, reply) => commands.runChatPrompt(prompt, reply),
    onClear: () => void commands.clearChatSession(),
  });
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      chatProvider
    )
  );
  register("innerLoop.openChat", async () => {
    await vscode.commands.executeCommand("innerLoop.chatView.focus");
    chatProvider.focusInput();
  });

  context.subscriptions.push({ dispose: () => Status.dispose() });
  context.subscriptions.push({ dispose: () => Output.dispose() });

  // Passive, non-blocking readiness check for the status bar.
  void initialHealthCheck();
}

async function initialHealthCheck(): Promise<void> {
  try {
    const client = new OllamaClient(Settings.ollamaUrl());
    const reachable = await client.isReachable();
    Status.set(reachable ? "Ready" : "Ollama Offline");
    if (!reachable) {
      Output.info("Ollama not reachable yet. Run 'Inner Loop: Check Ollama' once it's up.");
    }
  } catch {
    Status.set("Ollama Offline");
  }
}

export function deactivate(): void {
  Status.dispose();
  Output.dispose();
}
