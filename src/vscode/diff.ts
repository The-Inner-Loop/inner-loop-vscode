import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { TMP_DIR, ensureDir } from "../memory/paths";

/**
 * Diff preview + patch application (PRD 15).
 * Preview uses temp files under ~/.innerloop/tmp; apply uses WorkspaceEdit so
 * changes are undoable and pass through normal VS Code editing.
 */

export interface ProposedPatch {
  /** Absolute path of the file being edited. */
  targetPath: string;
  /** Full original document text. */
  originalText: string;
  /** Full proposed document text. */
  proposedText: string;
  /** Short human description of the change. */
  description: string;
}

/** Open a native side-by-side diff (Original ↔ Proposed). */
export async function showDiff(patch: ProposedPatch): Promise<void> {
  const sessionId = crypto.randomUUID().slice(0, 8);
  const dir = path.join(TMP_DIR, sessionId);
  ensureDir(dir);

  const ext = path.extname(patch.targetPath) || ".txt";
  const base = path.basename(patch.targetPath, ext);
  const originalFile = path.join(dir, `${base}.original${ext}`);
  const proposedFile = path.join(dir, `${base}.proposed${ext}`);

  fs.writeFileSync(originalFile, patch.originalText, "utf8");
  fs.writeFileSync(proposedFile, patch.proposedText, "utf8");

  const title = `Inner Loop: ${path.basename(patch.targetPath)} (Original ↔ Proposed)`;
  await vscode.commands.executeCommand(
    "vscode.diff",
    vscode.Uri.file(originalFile),
    vscode.Uri.file(proposedFile),
    title
  );
}

/**
 * Apply the proposed text to the real file via WorkspaceEdit, then save.
 * Returns true on success.
 */
export async function applyPatch(patch: ProposedPatch): Promise<boolean> {
  const uri = vscode.Uri.file(patch.targetPath);

  let doc: vscode.TextDocument;
  try {
    doc = await vscode.workspace.openTextDocument(uri);
  } catch {
    // New file case: create it with the proposed content.
    const edit = new vscode.WorkspaceEdit();
    edit.createFile(uri, { overwrite: false, ignoreIfExists: true });
    edit.insert(uri, new vscode.Position(0, 0), patch.proposedText);
    const ok = await vscode.workspace.applyEdit(edit);
    if (ok) {
      const created = await vscode.workspace.openTextDocument(uri);
      await created.save();
    }
    return ok;
  }

  const fullRange = new vscode.Range(
    doc.positionAt(0),
    doc.positionAt(doc.getText().length)
  );

  const edit = new vscode.WorkspaceEdit();
  edit.replace(uri, fullRange, patch.proposedText);
  const ok = await vscode.workspace.applyEdit(edit);
  if (ok) {
    await doc.save();
  }
  return ok;
}
