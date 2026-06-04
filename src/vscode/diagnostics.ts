import * as vscode from "vscode";

/**
 * Diagnostics reader (PRD 14.1 read_diagnostics).
 */

export interface DiagnosticSummary {
  file: string;
  line: number;
  severity: string;
  message: string;
  source?: string;
}

function severityName(sev: vscode.DiagnosticSeverity): string {
  switch (sev) {
    case vscode.DiagnosticSeverity.Error:
      return "error";
    case vscode.DiagnosticSeverity.Warning:
      return "warning";
    case vscode.DiagnosticSeverity.Information:
      return "info";
    default:
      return "hint";
  }
}

/** Collect diagnostics for a specific file, or the whole workspace. */
export function readDiagnostics(targetUri?: vscode.Uri): DiagnosticSummary[] {
  const entries: [vscode.Uri, vscode.Diagnostic[]][] = targetUri
    ? [[targetUri, vscode.languages.getDiagnostics(targetUri)]]
    : vscode.languages.getDiagnostics();

  const out: DiagnosticSummary[] = [];
  for (const [uri, diags] of entries) {
    for (const d of diags) {
      out.push({
        file: uri.fsPath,
        line: d.range.start.line + 1,
        severity: severityName(d.severity),
        message: d.message,
        source: d.source,
      });
    }
  }
  return out;
}
