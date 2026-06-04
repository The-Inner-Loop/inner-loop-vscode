import * as vscode from "vscode";

export type StatusState =
  | "Ready"
  | "Ollama Offline"
  | "Thinking"
  | "Patch Ready";

/**
 * Status bar item reflecting the agent's current state (per UX.md / PRD 17.3).
 */
class StatusBar {
  private item: vscode.StatusBarItem | undefined;

  init(): vscode.StatusBarItem {
    if (!this.item) {
      this.item = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
      );
      this.item.command = "innerLoop.ask";
      this.set("Ready");
      this.item.show();
    }
    return this.item;
  }

  set(state: StatusState): void {
    const item = this.init();
    const icon =
      state === "Thinking"
        ? "$(sync~spin)"
        : state === "Ollama Offline"
        ? "$(circle-slash)"
        : state === "Patch Ready"
        ? "$(git-pull-request)"
        : "$(rocket)";
    item.text = `${icon} Inner Loop: ${state}`;
    item.tooltip = `Inner Loop Code — ${state}`;
  }

  dispose(): void {
    this.item?.dispose();
    this.item = undefined;
  }
}

export const Status = new StatusBar();
