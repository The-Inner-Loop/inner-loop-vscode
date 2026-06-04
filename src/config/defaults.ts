/**
 * Default constants for Inner Loop Code.
 * These mirror the package.json configuration defaults and PRD spec.
 */

export const DEFAULTS = {
  model: "qwen3-coder",
  ollamaUrl: "http://localhost:11434",
  maxAgentSteps: 12,
  autoApproveReads: true,
  autoApproveWrites: false,
  autoApproveCommands: false,
  memoryEnabled: true,
  defaultTestCommand: "",
  commandAllowlist: [
    "git status",
    "git diff",
    "npm test",
    "npm run test",
    "npm run build",
    "npm run lint",
    "pnpm test",
    "pnpm build",
    "yarn test",
    "python -m pytest",
    "pytest",
    "go test ./...",
  ],
} as const;

/** Commands that are always denied, regardless of allowlist. */
export const BLOCKED_COMMANDS = [
  "rm",
  "sudo",
  "curl",
  "wget",
  "ssh",
  "scp",
  "chmod",
  "chown",
  "git push",
  "git reset --hard",
  "git clean",
  "docker system prune",
  "brew install",
  "npm install",
  "pnpm install",
  "pip install",
];

/** Files whose contents are protected and require explicit approval. */
export const PROTECTED_FILES = [
  ".env",
  ".env.local",
  ".env.production",
  "*.pem",
  "*.key",
  "id_rsa",
  "id_ed25519",
  "credentials.json",
  "secrets.json",
];

/** Directories ignored when listing or searching the workspace. */
export const IGNORED_DIRS = [
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".cache",
  ".next",
  "target",
  "DerivedData",
  "vendor",
];

/** Files larger than this (bytes) are never fully loaded. */
export const MAX_FILE_BYTES = 256 * 1024;

export const OUTPUT_CHANNEL_NAME = "Inner Loop";
