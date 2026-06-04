# UX

## Desired Feeling
Local. In control. Quiet. The editor stays the cockpit; Inner Loop is the operator that proposes and waits. Nothing irreversible happens without a human "Apply".

## Primary User Flow
1. User opens a workspace and a file.
2. Runs a command from the palette (`Inner Loop: …`).
3. Status bar shows `Inner Loop: Thinking`.
4. Output channel streams the model's reasoning/result; workspace path + model are logged.
5. For edits: a native VS Code diff opens (Original ↔ Proposed).
6. User chooses `Apply Patch` / `Cancel` / `Open Diff` (default = non-destructive).
7. On apply: `WorkspaceEdit` runs, summary logged, result stored in memory.

## Failure States
- Ollama offline → status bar `Inner Loop: Ollama Offline`; message: "Ollama is not running. Start it with: ollama serve".
- Model missing → "Model not found. Install it with: ollama pull <model>".
- No active editor → clear info message, no crash.
- File outside workspace → blocked with reason.
- Secret file read → requires explicit approval.
- Blocked command → refused with reason; one safe alternative suggested.
- Invalid model JSON → treated as a plain final answer, never a crash.

## Accessibility / Cognitive Load
- Default selections are never destructive.
- Every surface is native VS Code (palette, input box, output, diff, status bar) — nothing new to learn.
- Approvals are explicit and few.
- Output channel is the single source of "what happened".
- No accounts, no setup wizard, no config required to start (sane defaults).
