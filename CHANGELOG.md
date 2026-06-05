# Changelog

All notable changes to the **Inner Loop Code** extension are documented here.

This project follows [Semantic Versioning](https://semver.org/).

## [0.0.2] — 2026-06-05

### Added

- **Live activity streaming in the sidebar chat.** While the agent works, the
  Inner Loop panel now streams a present-tense activity trail (e.g. _Reading a
  file → Searching the code → Proposing an edit_) instead of a silent spinner.
  The trail collapses into an expandable summary once the final answer arrives.
- **Approval visibility in the sidebar.** Approval-gated tools (`propose_patch`,
  `run_command`) now surface an _"Awaiting your approval"_ hint in the activity
  trail so the modal/diff is easy to find.
- **Pure `agent/activity` module** mapping tool calls to human-readable labels,
  with unit tests (40 tests total).

### Fixed

- **Patch could be silently declined.** Choosing **Open Diff** at the approval
  dialog returned a non-approve result and cancelled the edit. It now re-opens
  the diff and asks again, so reviewing no longer discards the proposal.
- **Sidebar chat no longer clears on blur.** The conversation now persists when
  the view is hidden or the window reloads (via `retainContextWhenHidden` plus
  webview state), staying put until you press **Clear**.
- **CI/release builds were failing.** The test script used a quoted glob that
  only Node 21+ expands natively; on the pinned Node 20 runner it matched no
  files. The glob is now shell-expanded and the workflows run on Node 22 LTS
  (clearing the Node 20 deprecation warning). The release workflow also runs
  the tests before packaging.

### Changed

- The agent loop now emits optional progress events (`tool`, `tool_result`,
  `notice`) so any surface can observe its reasoning without changing behavior.
- `ToolContext` gained an optional `onEvent` sink so approval-gated tools can
  report progress to live surfaces.
- Test sources are excluded from the production build, producing a leaner
  `.vsix`.
- Expanded the README: highlights, capabilities, sidebar/approval docs, a
  settings table, and a commit/push/tag release workflow.

## [0.0.1] — Initial

### Added

- Local-first AI coding agent powered by Ollama — no cloud, no telemetry.
- Agent tool loop with read-only autonomy and approval-gated writes/commands.
- Commands: Ask, Open Chat, Check Ollama, Explain (File/Selection/Workspace),
  Propose Edit, Apply Last Patch, Remember Project Rule, Show Memory,
  Run Safe Test.
- Sidebar chat webview with multi-turn session memory.
- Semantic project memory via local `nomic-embed-text` embeddings, with a
  keyword fallback.
- Safety model: workspace boundary, secret protection, command allowlist,
  human-in-the-loop approval.
- Context menus, keybindings, status bar, and a professional icon.
- Cancellable progress for all model calls.
- CI for build/test and a release workflow that publishes the `.vsix`.
