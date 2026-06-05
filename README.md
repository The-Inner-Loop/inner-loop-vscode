# Inner Loop Code

Local-first AI coding agent for VS Code, powered by [Ollama](https://ollama.com).

VS Code is the cockpit. Inner Loop is the local operator. Ollama is the local brain. You stay in command.

No cloud. No telemetry. No GitHub or Marketplace required.

---

## Highlights

- 🧠 **Local-first agent.** Runs entirely against your local Ollama — your code never leaves the machine.
- 💬 **Native sidebar chat.** Multi-turn conversations with a **live activity trail** that shows what the agent is doing in real time.
- 🛠️ **Real tool use.** Reads files, searches code, inspects diagnostics, checks git status/diff, proposes edits, and runs allowlisted commands.
- 🔒 **Safety-first.** Every edit and command is gated by an approval dialog with a side-by-side diff. Defaults are never destructive.
- 🧩 **Semantic project memory.** Remembers project rules and decisions using local embeddings (`nomic-embed-text`), with keyword fallback.
- ⏹️ **Interruptible.** Every model call runs under a cancellable progress notification.
- 🎯 **Editor integration.** Context menus, keybindings, status bar, and an Activity Bar view.

## What Inner Loop Can Do

The agent operates **only within your active workspace** and can:

- Read and analyze workspace files, the active editor, and the current selection
- Search code across the whole project
- Inspect diagnostics (errors/warnings) from VS Code's language servers
- View `git status` and `git diff`
- Propose file creates/edits as a reviewable diff (approval required)
- Run allowlisted shell commands such as tests and builds (approval required)
- Retrieve and save semantic project memory

## Requirements

- VS Code `^1.90.0`
- Node.js 20+
- [Ollama](https://ollama.com) running locally:

```bash
ollama serve
ollama pull qwen3-coder
```

## Run in Development

```bash
npm install
npm run watch    # or: npm run compile
```

Then in VS Code press `F5` to launch the Extension Development Host, open the
Command Palette, and run any `Inner Loop:` command.

## Commands

| Command | ID |
| --- | --- |
| Inner Loop: Ask | `innerLoop.ask` |
| Inner Loop: Open Chat | `innerLoop.openChat` |
| Inner Loop: Check Ollama | `innerLoop.checkOllama` |
| Inner Loop: Explain Current File | `innerLoop.explainCurrentFile` |
| Inner Loop: Explain Selection | `innerLoop.explainSelection` |
| Inner Loop: Explain Workspace | `innerLoop.explainWorkspace` |
| Inner Loop: Propose Edit | `innerLoop.proposeEdit` |
| Inner Loop: Apply Last Patch | `innerLoop.applyLastPatch` |
| Inner Loop: Remember Project Rule | `innerLoop.rememberRule` |
| Inner Loop: Show Memory | `innerLoop.showMemory` |
| Inner Loop: Run Safe Test | `innerLoop.runSafeTest` |

### Keybindings

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Ask | `⌘⌥I` | `Ctrl+Alt+I` |
| Explain Selection | `⌘⌥E` | `Ctrl+Alt+E` |
| Propose Edit | `⌘⌥P` | `Ctrl+Alt+P` |

## Sidebar Chat

Open the **Inner Loop** view from the Activity Bar for a native, multi-turn chat.
The same local agent answers your questions and can read files, search the code,
and propose edits — all gated by the safety model. While it works, the panel
streams a **live activity trail** (e.g. _Reading a file → Searching the code →
Proposing an edit_) that collapses into an expandable summary once the final
answer arrives. Click the trail header to expand or collapse the steps. Use
**Clear** to reset the conversation for the current workspace.

## Approving Edits & Commands

Inner Loop never writes to disk or runs a command silently. When the agent
proposes a change:

1. A **side-by-side diff** opens (Original ↔ Proposed).
2. A **modal dialog** asks you to confirm — choose **Apply Patch** to apply,
   **Open Diff** to re-open the diff for review, or dismiss to decline.
3. In the sidebar, the activity trail shows an **"Awaiting your approval"** hint
   so you know to look for the dialog.

If you dismiss the dialog, the proposal is retained — run **Inner Loop: Apply
Last Patch** (`innerLoop.applyLastPatch`) to apply it later. Commands work the
same way and must additionally appear on the **command allowlist**.

> Tip: To let the agent apply edits without prompting, enable
> `innerLoop.autoApproveWrites` (and `innerLoop.autoApproveCommands` for
> commands). These are **off by default** by design.

## Settings

All settings live under `innerLoop.*` (Settings UI → "Inner Loop Code"):

| Setting | Default | Description |
| --- | --- | --- |
| `innerLoop.model` | `qwen3-coder` | Ollama model used by the agent. |
| `innerLoop.ollamaUrl` | `http://localhost:11434` | Local Ollama server URL. |
| `innerLoop.embedModel` | `nomic-embed-text` | Model used for semantic memory embeddings. |
| `innerLoop.maxAgentSteps` | `12` | Maximum agent loop steps per task. |
| `innerLoop.autoApproveReads` | `true` | Read non-secret files without confirmation. |
| `innerLoop.autoApproveWrites` | `false` | Apply file edits without confirmation. |
| `innerLoop.autoApproveCommands` | `false` | Run allowlisted commands without confirmation. |
| `innerLoop.memoryEnabled` | `true` | Enable local project memory. |
| `innerLoop.defaultTestCommand` | `""` | Preferred command for Run Safe Test. |
| `innerLoop.commandAllowlist` | _(git/test/build)_ | Commands the agent may run after approval. |

## Safety Model

- **Human-in-the-loop.** Edits and commands require explicit approval; defaults are never destructive.
- **Workspace boundary.** File access outside the workspace root is rejected; path traversal blocked.
- **Secret protection.** `.env`, `*.pem`, `*.key`, `id_rsa`, etc. are never read or edited without approval.
- **Command allowlist.** Default-deny shell execution; destructive commands (`rm`, `git push`, `npm install`, …) are blocked.
- **Local memory.** Project memory is stored in `~/.innerloop/memory/`, outside your repo.

## Install From a Release

Prebuilt `.vsix` files are attached to each [GitHub Release](https://github.com/The-Inner-Loop/inner-loop-vscode/releases).
Download the latest and install:

```bash
code --install-extension inner-loop-code-<version>.vsix
```

## Releasing a New Version

Releases are automated: pushing a `v*` git tag triggers the
[`release` workflow](.github/workflows/release.yml), which compiles, packages the
`.vsix`, and publishes a GitHub Release with install notes.

### Cut `v0.0.2` (commit, push, and tag to trigger the build)

```bash
# 1. Stage and commit your changes
git add -A
git commit -m "Release v0.0.2: live sidebar streaming, approval fixes, docs"

# 2. Bump the version in package.json and create the matching tag.
#    --no-git-tag-version lets us commit the bump alongside our work first,
#    or omit it to let npm create the commit+tag for you.
npm version 0.0.2 -m "v%s"

# 3. Push the branch and the tag — the tag is what triggers the release build
git push origin main
git push origin v0.0.2
```

`npm version 0.0.2` updates `package.json`, creates a commit, and tags `v0.0.2`
in one step. Pushing that tag starts GitHub Actions, which builds and publishes
`inner-loop-code-0.0.2.vsix`.

#### One-liner

```bash
git add -A && git commit -m "Release v0.0.2" \
  && npm version 0.0.2 -m "v%s" \
  && git push origin main --follow-tags
```

> `--follow-tags` pushes the new commit **and** the version tag together, so the
> release build kicks off immediately.

### Convenience script

```bash
npm version patch    # bumps package.json + creates a git commit/tag
npm run release      # pushes the tag → GitHub Actions builds & publishes
```

## Package Locally

Build a `.vsix` on your machine without cutting a release:

```bash
npm install -g @vscode/vsce
npm run package      # → inner-loop-code-<version>.vsix
code --install-extension inner-loop-code-0.0.2.vsix
```

## License

MIT
