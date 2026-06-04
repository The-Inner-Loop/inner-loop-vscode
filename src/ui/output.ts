import * as vscode from "vscode";
import { OUTPUT_CHANNEL_NAME } from "../config/defaults";

/**
 * Single shared Output channel for Inner Loop.
 * This is the canonical "what happened" surface (per UX.md).
 */
class OutputLog {
  private channel: vscode.OutputChannel | undefined;

  init(): vscode.OutputChannel {
    if (!this.channel) {
      this.channel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
    }
    return this.channel;
  }

  private ts(): string {
    return new Date().toLocaleTimeString();
  }

  show(preserveFocus = true): void {
    this.init().show(preserveFocus);
  }

  line(message = ""): void {
    this.init().appendLine(message);
  }

  /** Append without a trailing newline — used for streaming model tokens. */
  append(text: string): void {
    this.init().append(text);
  }

  info(message: string): void {
    this.line(`[${this.ts()}] ${message}`);
  }

  header(title: string): void {
    this.line("");
    this.line(`──────── ${title} ────────`);
  }

  error(message: string): void {
    this.line(`[${this.ts()}] ERROR: ${message}`);
  }

  dispose(): void {
    this.channel?.dispose();
    this.channel = undefined;
  }
}

export const Output = new OutputLog();
