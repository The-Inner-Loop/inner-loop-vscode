import * as vscode from "vscode";

/**
 * Active editor / selection helpers (PRD 10.1, 10.2).
 */

export interface ActiveFileContext {
  path: string;
  languageId: string;
  text: string;
}

export interface SelectionContext extends ActiveFileContext {
  selectedText: string;
  startLine: number;
  endLine: number;
}

export function getActiveFile(): ActiveFileContext | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }
  const doc = editor.document;
  return {
    path: doc.uri.fsPath,
    languageId: doc.languageId,
    text: doc.getText(),
  };
}

export function getSelection(): SelectionContext | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }
  const doc = editor.document;
  const sel = editor.selection;
  if (sel.isEmpty) {
    return undefined;
  }
  return {
    path: doc.uri.fsPath,
    languageId: doc.languageId,
    text: doc.getText(),
    selectedText: doc.getText(sel),
    startLine: sel.start.line + 1,
    endLine: sel.end.line + 1,
  };
}
