import * as vscode from "vscode";
import { DEFAULTS } from "./defaults";

/**
 * Typed accessors over the `innerLoop.*` VS Code configuration.
 * Always reads live config so user changes apply without reload.
 */

const SECTION = "innerLoop";

function cfg(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(SECTION);
}

export const Settings = {
  model(): string {
    return cfg().get<string>("model", DEFAULTS.model);
  },
  ollamaUrl(): string {
    return cfg().get<string>("ollamaUrl", DEFAULTS.ollamaUrl).replace(/\/+$/, "");
  },
  maxAgentSteps(): number {
    return cfg().get<number>("maxAgentSteps", DEFAULTS.maxAgentSteps);
  },
  autoApproveReads(): boolean {
    return cfg().get<boolean>("autoApproveReads", DEFAULTS.autoApproveReads);
  },
  autoApproveWrites(): boolean {
    return cfg().get<boolean>("autoApproveWrites", DEFAULTS.autoApproveWrites);
  },
  autoApproveCommands(): boolean {
    return cfg().get<boolean>("autoApproveCommands", DEFAULTS.autoApproveCommands);
  },
  memoryEnabled(): boolean {
    return cfg().get<boolean>("memoryEnabled", DEFAULTS.memoryEnabled);
  },
  defaultTestCommand(): string {
    return cfg().get<string>("defaultTestCommand", DEFAULTS.defaultTestCommand);
  },
  commandAllowlist(): string[] {
    return cfg().get<string[]>("commandAllowlist", [...DEFAULTS.commandAllowlist]);
  },
};
