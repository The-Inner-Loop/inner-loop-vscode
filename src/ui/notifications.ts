import * as vscode from "vscode";

/**
 * Thin wrappers over VS Code notifications so call sites stay terse.
 */
export const Notify = {
  info(message: string, ...actions: string[]): Thenable<string | undefined> {
    return vscode.window.showInformationMessage(message, ...actions);
  },
  warn(message: string, ...actions: string[]): Thenable<string | undefined> {
    return vscode.window.showWarningMessage(message, ...actions);
  },
  /** Modal warning — forces a deliberate choice (used for approvals). */
  warnModal(message: string, ...actions: string[]): Thenable<string | undefined> {
    return vscode.window.showWarningMessage(message, { modal: true }, ...actions);
  },
  error(message: string, ...actions: string[]): Thenable<string | undefined> {
    return vscode.window.showErrorMessage(message, ...actions);
  },
};
