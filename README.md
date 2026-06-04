# Inner Loop Code

Local-first AI coding agent for VS Code, powered by [Ollama](https://ollama.com).

VS Code is the cockpit. Inner Loop is the local operator. Ollama is the local brain. You stay in command.

No cloud. No telemetry. No GitHub or Marketplace required.

---

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
| Inner Loop: Check Ollama | `innerLoop.checkOllama` |
| Inner Loop: Explain Current File | `innerLoop.explainCurrentFile` |
| Inner Loop: Explain Selection | `innerLoop.explainSelection` |
| Inner Loop: Explain Workspace | `innerLoop.explainWorkspace` |
| Inner Loop: Propose Edit | `innerLoop.proposeEdit` |
| Inner Loop: Apply Last Patch | `innerLoop.applyLastPatch` |
| Inner Loop: Remember Project Rule | `innerLoop.rememberRule` |
| Inner Loop: Show Memory | `innerLoop.showMemory` |
| Inner Loop: Run Safe Test | `innerLoop.runSafeTest` |

## Settings

All settings live under `innerLoop.*` (Settings UI → "Inner Loop Code"):
`model`, `ollamaUrl`, `maxAgentSteps`, `autoApproveReads`, `autoApproveWrites`,
`autoApproveCommands`, `memoryEnabled`, `defaultTestCommand`, `commandAllowlist`.

## Safety Model

- **Human-in-the-loop.** Edits and commands require explicit approval; defaults are never destructive.
- **Workspace boundary.** File access outside the workspace root is rejected; path traversal blocked.
- **Secret protection.** `.env`, `*.pem`, `*.key`, `id_rsa`, etc. are never read or edited without approval.
- **Command allowlist.** Default-deny shell execution; destructive commands (`rm`, `git push`, `npm install`, …) are blocked.
- **Local memory.** Project memory is stored in `~/.innerloop/memory/`, outside your repo.

## Package Locally

```bash
npm install -g @vscode/vsce
vsce package
code --install-extension inner-loop-code-0.0.1.vsix
```

## Install From a Release

Prebuilt `.vsix` files are attached to each [GitHub Release](../../releases).
Download the latest and install:

```bash
code --install-extension inner-loop-code-<version>.vsix
```

Maintainers cut a release by tagging a version (CI builds and publishes the `.vsix`):

```bash
npm version patch    # bumps package.json + creates a git commit/tag
npm run release      # pushes the tag → GitHub Actions builds & publishes
```

## License

MIT
