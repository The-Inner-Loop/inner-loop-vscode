# Inner Loop Code VS Code Extension

## Product Name

Inner Loop Code

## Working Codename

DrX Code Local

## Product Type

Local-first VS Code extension for AI-assisted software development.

## Initial Distribution

Private local installation.

No GitHub required.

No VS Code Marketplace required.

No cloud dependency required.

⸻

### 1. Product Vision

Inner Loop Code is a private, local-first AI coding agent that runs inside VS Code and uses local models through Ollama.

The product should feel like a local coding operator embedded inside the editor.

It should not replace VS Code.

It should not rebuild the editor.

It should use VS Code as the execution surface and build the intelligence layer around it.

The core idea:

VS Code is the cockpit.
Inner Loop is the local operator.
Ollama is the local brain.
The developer remains in control.

The extension should help the user move through the development loop:

Ask → Inspect → Plan → Edit → Diff → Approve → Test → Remember

The first version should be private, installable locally, and usable against any VS Code workspace without publishing to Marketplace or pushing to GitHub.

⸻

### 2. Core Philosophy

2.1 Local-First

All code inspection, memory, model calls, and edits should happen locally by default.

Default model provider:

Ollama

Default endpoint:

http://localhost:11434

Default model:

qwen3-coder

Alternative models:

deepseek-coder
qwen2.5-coder
llama-based local models

No source code should leave the machine unless the user later configures a remote provider explicitly.

### 2.2 Human-in-the-Loop

The agent can inspect and propose.

The agent cannot silently perform dangerous actions.

The user must approve:

file writes
patch application
test/build commands
terminal commands
secret file reads
destructive operations

### 2.3 Editor-Native

The product should use native VS Code capabilities:

workspace files
active editor
selected text
diagnostics
Problems panel
terminal
diff viewer
workspace edits
commands
settings
webview/sidebar

Do not build a custom editor.

Do not build a custom file explorer.

Do not build a custom terminal.

Do not build a custom git UI.

### 2.4 Inner Loop Memory

The system should remember project-specific rules, architecture, commands, and previous decisions.

Example memories:

This repo uses hexagonal architecture.
Use pnpm test for tests.
Do not edit generated files.
Controllers should not contain business logic.
The API entry point is src/server.ts.

Memory should be stored locally outside the repository by default.

⸻

### 3. Product Goals

Phase 1 Goal

Build a local VS Code extension that can:

1. Run from a brand-new local repo.
2. Install locally without Marketplace.
3. Connect to local Ollama.
4. Detect the current VS Code workspace.
5. Read workspace files safely.
6. Understand the active file and selected text.
7. Search workspace code.
8. Maintain local project memory.
9. Generate proposed code changes.
10. Show diffs inside VS Code.
11. Apply edits only after user approval.
12. Run allowlisted commands only after user approval.
13. Summarize changes and update memory.

Long-Term Goal

Create a local AI development layer that can evolve into:

VS Code extension
CLI companion
local agent server
MCP tool runtime
team policies
native macOS app
enterprise private agent platform

⸻

### 4. Target User

Primary User

A senior engineer or builder who wants a private AI coding assistant inside VS Code.

Secondary Users

AI engineers
automation engineers
internal platform teams
solo developers
startup founders
teams with sensitive codebases
companies avoiding cloud AI code exposure

⸻

### 5. Initial Constraints

Must Have

Runs locally
No GitHub required
No Marketplace required
Works inside VS Code
Uses Ollama locally
Reads current workspace
Can edit files after approval
Stores memory locally

Must Not Do

No silent edits
No arbitrary shell execution
No automatic git push
No dependency install without approval
No reading .env by default
No accessing files outside workspace
No cloud model calls by default

⸻

### 6. Installation Strategy

### 6.1 Development Mode

During development, the extension is run directly from its local folder.

Expected flow:

mkdir inner-loop-vscode
cd inner-loop-vscode
npm install
code .

Inside VS Code:

Press F5
Launch Extension Development Host
Run command: Inner Loop: Ask

6.2 Local Private Install

For private installation:

npm install -g @vscode/vsce
vsce package
code --install-extension inner-loop-code-0.0.1.vsix

The .vsix package can be shared manually later.

### 6.3 Marketplace

Marketplace publishing is not required for MVP.

Marketplace may be considered only after:

core UX is stable
security model is strong
extension identity is clear
docs are ready
pricing strategy is defined

⸻

7. High-Level Architecture

┌────────────────────────────────────────┐
│             VS Code Extension           │
│ Commands / Sidebar / Diff / Approvals   │
└────────────────────┬───────────────────┘
                     │
┌────────────────────▼───────────────────┐
│             Agent Core                   │
│ Planner / Tool Loop / Safety / Memory    │
└────────────────────┬───────────────────┘
                     │
        ┌────────────▼────────────┐
        │          Ollama          │
        │      Local LLM API       │
        └────────────┬────────────┘
                     │
┌────────────────────▼───────────────────┐
│          Current VS Code Workspace       │
│ Files / Git / Diagnostics / Terminal     │
└────────────────────────────────────────┘

⸻

8. Recommended Repo Structure

The first repo should be local-only and clean.

inner-loop-vscode/
  package.json
  tsconfig.json
  README.md
  .vscode/
    launch.json
    tasks.json
  src/
    extension.ts
    agent/
      loop.ts
      planner.ts
      prompts.ts
      types.ts
    model/
      ollamaClient.ts
    vscode/
      workspace.ts
      editor.ts
      diff.ts
      terminal.ts
      diagnostics.ts
      commands.ts
      webview.ts
    tools/
      registry.ts
      readFile.ts
      writeFile.ts
      searchCode.ts
      listFiles.ts
      runCommand.ts
      git.ts
    memory/
      db.ts
      projectMemory.ts
      sessionMemory.ts
      retrieval.ts
    safety/
      filePolicy.ts
      commandPolicy.ts
      approval.ts
    config/
      settings.ts
      defaults.ts
    ui/
      output.ts
      notifications.ts
      statusBar.ts

⸻

### 9. Extension Commands

Required Phase 1 Commands

The extension should contribute the following commands to VS Code:

Inner Loop: Ask
Inner Loop: Explain Current File
Inner Loop: Explain Selection
Inner Loop: Explain Workspace
Inner Loop: Propose Edit
Inner Loop: Apply Last Patch
Inner Loop: Show Memory
Inner Loop: Remember Project Rule
Inner Loop: Run Safe Test
Inner Loop: Check Ollama

Command Palette Names

innerLoop.ask
innerLoop.explainCurrentFile
innerLoop.explainSelection
innerLoop.explainWorkspace
innerLoop.proposeEdit
innerLoop.applyLastPatch
innerLoop.showMemory
innerLoop.rememberRule
innerLoop.runSafeTest
innerLoop.checkOllama

⸻

### 10. Core User Flows

### 10.1 Ask About Current File

User opens a file and runs:

Inner Loop: Explain Current File

Agent should:

1. Get active editor file path.
2. Read current document text.
3. Send file context to local model.
4. Return explanation in Output panel or sidebar.

Expected answer:

This file defines the authentication route.
Main responsibilities:
- parse login request
- validate input
- call auth service
- return token response
Potential issue:
Validation is happening after repository access.

### 10.2 Explain Selection

User selects a block of code and runs:

Inner Loop: Explain Selection

Agent should:

1. Read selected text.
2. Include file path and language.
3. Explain what the code does.
4. Suggest improvements if useful.

### 10.3 Propose Edit

User selects code or gives instruction:

Add validation before calling the service.

Agent should:

1. Inspect active file.
2. Optionally search related files.
3. Generate proposed change.
4. Show diff in VS Code.
5. Ask for approval.

The extension should not write immediately.

### 10.4 Apply Edit

After diff approval:

Apply patch?

Options:

Apply
Cancel
Show Details

If user applies:

1. Use VS Code WorkspaceEdit.
2. Save document if needed.
3. Show final summary.
4. Store task result in memory.

### 10.5 Explain Workspace

User runs:

Inner Loop: Explain Workspace

Agent should:

1. Detect workspace root.
2. Read top-level files.
3. Detect package manager/framework.
4. Read README if available.
5. Summarize architecture.
6. Store architecture summary in memory.

### 10.6 Remember Project Rule

User runs:

Inner Loop: Remember Project Rule

Input:

This repo uses hexagonal architecture. Keep controllers thin.

Agent stores memory under the workspace identity.

Later, when editing, the agent includes this memory in prompts.

⸻

### 11. Workspace Boundary Model

The extension operates only inside the active VS Code workspace.

If multiple workspace folders exist, the extension should ask which one to use or infer from active file.

Rules:

Files outside workspace are blocked.
Path traversal is blocked.
Symlink escape is blocked if detectable.
Secret files are protected.
Large files are not fully loaded.

Protected files:

.env
.env.local
.env.production
*.pem
*.key
id_rsa
id_ed25519
credentials.json
secrets.json

Ignored directories:

.git
node_modules
dist
build
coverage
.cache
.next
target
DerivedData
vendor

⸻

### 12. Local Model Integration

### 12.1 Ollama Client

Default endpoint:

http://localhost:11434

Health check:

GET /api/tags

Chat endpoint:

POST /api/chat

Default model setting:

qwen3-coder

### 12.2 Missing Ollama Behavior

If Ollama is not reachable:

Ollama is not running.
Start it with:
ollama serve

### 12.3 Missing Model Behavior

If model is missing:

Model not found.
Install it with:
ollama pull qwen3-coder

⸻

### 13. Memory System

### 13.1 Storage Location

Memory should be outside the repo.

Default:

~/.innerloop/memory/innerloop.sqlite

### 13.2 Workspace Identity

Initial identity:

workspace absolute path hash

Future identity:

git remote hash
package name
workspace fingerprint

### 13.3 Memory Types

architecture
command
rule
decision
task_result
summary
preference
constraint

### 13.4 Required Memory Features

Phase 1:

create memory
list memory
retrieve relevant memory
delete memory later

### 13.5 Memory Table

CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  workspace_hash TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  importance INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

⸻

### 14. Tool System

### 14.1 Tool Registry

The agent should use structured tool calls internally.

Required tools:

get_workspace_root
get_active_file
get_selection
list_files
read_file
search_code
propose_patch
show_diff
apply_patch
run_command
git_status
git_diff
read_diagnostics
save_memory
retrieve_memory

### 14.2 Tool Call Format

{
  "action": "tool",
  "tool": "read_file",
  "args": {
    "path": "src/auth/login.ts"
  },
  "reason": "Need to inspect login behavior before editing."
}

### 14.3 Final Answer Format

{
  "action": "final",
  "summary": "I added validation before the service call and updated memory.",
  "changes": [
    "Modified src/auth/login.ts"
  ],
  "next_steps": [
    "Run npm test"
  ]
}

⸻

### 15. Editing System

### 15.1 Default Flow

Generate proposed edit
↓
Create diff
↓
Show diff
↓
Ask approval
↓
Apply WorkspaceEdit
↓
Show result

### 15.2 Editing Method

Use VS Code APIs where possible:

WorkspaceEdit
TextDocumentEdit
showTextDocument
vscode.diff command

### 15.3 Temporary Diff Files

For preview, create temporary virtual or local files.

Initial simple approach:

~/.innerloop/tmp/{sessionId}/original.ts
~/.innerloop/tmp/{sessionId}/proposed.ts

Then open VS Code diff:

Original ↔ Proposed

### 15.4 Approval UX

Approval options:

Apply Patch
Cancel
Open Diff

Default selection should not be destructive.

⸻

### 16. Command Execution Policy

### 16.1 Default Allowlist

Allowed commands:

git status
git diff
npm test
npm run test
npm run build
npm run lint
pnpm test
pnpm build
yarn test
python -m pytest
pytest
go test ./...

### 16.2 Blocked by Default

rm
sudo
curl
wget
ssh
scp
chmod
chown
git push
git reset --hard
git clean
docker system prune
brew install
npm install
pnpm install
pip install

### 16.3 Terminal Integration

Phase 1 may execute commands using Node child_process with workspace cwd.

Later phase may use VS Code terminal API for visible execution.

All command execution requires user approval.

⸻

### 17. UI Requirements

### 17.1 Phase 1 UI

Start simple.

Required surfaces:

Command Palette
Input Box
Output Channel
Information Messages
Diff Viewer
Status Bar Item

Do not build a full sidebar yet unless necessary.

### 17.2 Output Channel

Name:

Inner Loop

Should show:

model used
workspace path
actions taken
files inspected
patch summary
test output
errors

### 17.3 Status Bar

Status examples:

Inner Loop: Ready
Inner Loop: Ollama Offline
Inner Loop: Thinking
Inner Loop: Patch Ready

⸻

### 18. Configuration

VS Code settings:

{
  "innerLoop.model": "qwen3-coder",
  "innerLoop.ollamaUrl": "http://localhost:11434",
  "innerLoop.maxAgentSteps": 12,
  "innerLoop.autoApproveReads": true,
  "innerLoop.autoApproveWrites": false,
  "innerLoop.autoApproveCommands": false,
  "innerLoop.memoryEnabled": true,
  "innerLoop.defaultTestCommand": "",
  "innerLoop.commandAllowlist": [
    "git status",
    "git diff",
    "npm test",
    "npm run test",
    "npm run build",
    "npm run lint",
    "pnpm test",
    "pnpm build",
    "python -m pytest",
    "go test ./..."
  ]
}

⸻

### 19. Security Requirements

### 19.1 No Cloud by Default

The extension must not call any external AI provider by default.

### 19.2 No Telemetry in MVP

No telemetry should be included in MVP.

### 19.3 Local Logs

Logs may be written locally only.

Location:

~/.innerloop/logs

### 19.4 Secret Protection

Protected files require explicit approval.

### 19.5 Workspace Boundary

The extension must reject file access outside workspace root.

### 19.6 Command Safety

Default deny for shell commands.

⸻

### 20. MVP Acceptance Criteria

The MVP is done when:

1. Extension runs locally from VS Code Extension Development Host.
2. Extension can be packaged as .vsix.
3. .vsix can be installed manually.
4. User can run Inner Loop: Check Ollama.
5. User can run Inner Loop: Explain Current File.
6. User can run Inner Loop: Explain Selection.
7. User can run Inner Loop: Explain Workspace.
8. User can save a project memory rule.
9. Agent retrieves memory during future prompts.
10. Agent proposes an edit.
11. Agent shows a diff.
12. Agent applies edit only after approval.
13. Agent can run an allowlisted test command after approval.
14. Agent blocks unsafe commands.
15. Agent blocks file access outside workspace.
16. Agent does not require GitHub.
17. Agent does not require Marketplace.
18. Agent does not send code to the cloud.

⸻

### 21. First Development Milestones

Milestone 1 — Extension Skeleton

Create a working VS Code extension with commands:

Inner Loop: Ask
Inner Loop: Check Ollama

Deliverable:

F5 launches Extension Development Host.
Command Palette shows Inner Loop commands.

Milestone 2 — Ollama Connection

Implement local Ollama client.

Deliverable:

Inner Loop: Check Ollama

shows available local models.

Milestone 3 — Active File Context

Implement:

get active file
get selected text
send to model
print response

Deliverable:

Inner Loop: Explain Current File
Inner Loop: Explain Selection

Milestone 4 — Workspace Search

Implement:

list files
read files
search code
ignore directories
workspace boundary safety

Deliverable:

Inner Loop: Explain Workspace

Milestone 5 — Memory

Implement SQLite memory.

Deliverable:

Inner Loop: Remember Project Rule
Inner Loop: Show Memory

Milestone 6 — Proposed Edits

Implement basic edit proposal.

Deliverable:

User asks for change.
Agent generates modified content.
Extension opens diff.

Milestone 7 — Apply Patch

Implement approval and WorkspaceEdit.

Deliverable:

User approves.
Extension applies patch.

Milestone 8 — Safe Commands

Implement command allowlist and test runner.

Deliverable:

Inner Loop: Run Safe Test

Milestone 9 — Package Locally

Package extension.

Deliverable:

vsce package
code --install-extension inner-loop-code-0.0.1.vsix

⸻

### 22. Suggested Initial package.json Contributions

{
  "name": "inner-loop-code",
  "displayName": "Inner Loop Code",
  "description": "Local-first AI coding agent for VS Code powered by Ollama.",
  "version": "0.0.1",
  "publisher": "local",
  "engines": {
    "vscode": "^1.90.0"
  },
  "categories": [
    "Other"
  ],
  "activationEvents": [
    "onCommand:innerLoop.ask",
    "onCommand:innerLoop.checkOllama",
    "onCommand:innerLoop.explainCurrentFile",
    "onCommand:innerLoop.explainSelection",
    "onCommand:innerLoop.explainWorkspace",
    "onCommand:innerLoop.rememberRule",
    "onCommand:innerLoop.showMemory",
    "onCommand:innerLoop.proposeEdit",
    "onCommand:innerLoop.runSafeTest"
  ],
  "contributes": {
    "commands": [
      {
        "command": "innerLoop.ask",
        "title": "Inner Loop: Ask"
      },
      {
        "command": "innerLoop.checkOllama",
        "title": "Inner Loop: Check Ollama"
      },
      {
        "command": "innerLoop.explainCurrentFile",
        "title": "Inner Loop: Explain Current File"
      },
      {
        "command": "innerLoop.explainSelection",
        "title": "Inner Loop: Explain Selection"
      },
      {
        "command": "innerLoop.explainWorkspace",
        "title": "Inner Loop: Explain Workspace"
      },
      {
        "command": "innerLoop.rememberRule",
        "title": "Inner Loop: Remember Project Rule"
      },
      {
        "command": "innerLoop.showMemory",
        "title": "Inner Loop: Show Memory"
      },
      {
        "command": "innerLoop.proposeEdit",
        "title": "Inner Loop: Propose Edit"
      },
      {
        "command": "innerLoop.runSafeTest",
        "title": "Inner Loop: Run Safe Test"
      }
    ],
    "configuration": {
      "title": "Inner Loop Code",
      "properties": {
        "innerLoop.model": {
          "type": "string",
          "default": "qwen3-coder",
          "description": "Ollama model used by Inner Loop Code."
        },
        "innerLoop.ollamaUrl": {
          "type": "string",
          "default": "http://localhost:11434",
          "description": "Local Ollama server URL."
        },
        "innerLoop.memoryEnabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable local project memory."
        },
        "innerLoop.maxAgentSteps": {
          "type": "number",
          "default": 12,
          "description": "Maximum agent loop steps per task."
        },
        "innerLoop.autoApproveWrites": {
          "type": "boolean",
          "default": false,
          "description": "Allow Inner Loop to apply file edits without confirmation."
        },
        "innerLoop.autoApproveCommands": {
          "type": "boolean",
          "default": false,
          "description": "Allow Inner Loop to run allowlisted commands without confirmation."
        }
      }
    }
  },
  "main": "./dist/extension.js",
  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "package": "vsce package"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/vscode": "^1.90.0",
    "@vscode/vsce": "^3.0.0",
    "typescript": "^5.0.0"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0"
  }
}

⸻

### 23. First Build Prompt for Coding Agent

Use this as the first implementation prompt once the repo is created:

Create a VS Code extension called Inner Loop Code.
Requirements:
- TypeScript extension.
- No GitHub required.
- Runs locally in Extension Development Host.
- Adds command: Inner Loop: Check Ollama.
- Adds command: Inner Loop: Ask.
- Adds command: Inner Loop: Explain Current File.
- Creates an Output Channel named "Inner Loop".
- Reads settings:
  - innerLoop.model
  - innerLoop.ollamaUrl
- Implements Ollama client using local HTTP.
- Check Ollama should call /api/tags and print available models.
- Ask should open an input box, send the prompt to Ollama /api/chat, and print the response.
- Explain Current File should read the active VS Code editor content and ask the model to explain it.
- Do not use external AI APIs.
- Do not include telemetry.

⸻

### 24. Product Mantra

Inner Loop Code is not another cloud copilot.

It is a local intelligence layer inside the editor.

It reads the workspace.

It remembers the project.

It proposes changes.

It shows the diff.

It waits for approval.

It runs locally.

It keeps the operator in command.