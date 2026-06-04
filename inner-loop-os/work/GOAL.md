# GOAL

## Desired Outcome
A working, locally-installable VS Code extension — **Inner Loop Code** — that runs an AI coding agent against the active workspace using local models via Ollama. It must run from the Extension Development Host (F5), package to a `.vsix`, install without Marketplace or GitHub, and never send source to the cloud by default.

## Why This Matters
Senior engineers and teams with sensitive codebases need a private AI coding operator inside the editor. Existing copilots are cloud-bound. This is local-first, human-in-the-loop, and reversible by design.

## Success Criteria
- F5 launches the Extension Development Host with all Inner Loop commands in the palette.
- `Inner Loop: Check Ollama` lists local models from `http://localhost:11434`.
- `Inner Loop: Explain Current File` / `Explain Selection` / `Explain Workspace` return model output in the Output channel.
- `Inner Loop: Remember Project Rule` + `Show Memory` persist/read project memory locally (outside the repo).
- Agent retrieves relevant memory in prompts.
- `Inner Loop: Propose Edit` generates a change, shows a VS Code diff, and applies only after approval.
- `Inner Loop: Run Safe Test` runs allowlisted commands only after approval; unsafe commands are blocked.
- File access outside the workspace is rejected; secret files are protected.
- No GitHub, no Marketplace, no cloud calls, no telemetry.
- Packages via `vsce package`; installs via `code --install-extension`.
