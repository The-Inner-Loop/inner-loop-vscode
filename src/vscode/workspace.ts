import * as vscode from "vscode";
import * as path from "path";
import { workspaceHash } from "../memory/identity";
import { Notify } from "../ui/notifications";

/**
 * Workspace resolution + identity (PRD 11).
 * Determines the single active workspace folder the agent operates within.
 */

export interface ActiveWorkspace {
  root: string;
  hash: string;
  name: string;
}

/** Resolve the workspace folder, preferring the active editor's folder. */
export async function resolveWorkspace(): Promise<ActiveWorkspace | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    Notify.warn("Inner Loop: open a folder/workspace first.");
    return undefined;
  }

  let folder: vscode.WorkspaceFolder | undefined;

  if (folders.length === 1) {
    folder = folders[0];
  } else {
    // Infer from the active editor, else ask.
    const active = vscode.window.activeTextEditor?.document.uri;
    if (active) {
      folder = vscode.workspace.getWorkspaceFolder(active);
    }
    if (!folder) {
      const picked = await vscode.window.showWorkspaceFolderPick({
        placeHolder: "Select the workspace Inner Loop should operate in",
      });
      folder = picked;
    }
  }

  if (!folder) {
    return undefined;
  }

  const root = folder.uri.fsPath;
  return { root, hash: workspaceHash(path.resolve(root)), name: folder.name };
}
