import * as vscode from "vscode";

/**
 * Sidebar chat webview (Phase H). A minimal, native-feeling chat surface that
 * drives the same agent as `Inner Loop: Ask`. The provider exposes a callback
 * so the extension can run the agent and stream results back to the panel.
 */

export interface ChatBridge {
  /**
   * Handle a user prompt. Live activity (tool steps, notices) is pushed via
   * `reply` as it happens; the resolved `summary` is the final answer.
   */
  onPrompt(
    prompt: string,
    reply: (chunk: string) => void
  ): Promise<{ summary: string }>;
  /** Clear the current session. */
  onClear(): void;
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "innerLoop.chatView";
  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly bridge: ChatBridge
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = this.html(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg?.type === "prompt" && typeof msg.text === "string") {
        const text = msg.text.trim();
        if (!text) {
          return;
        }
        this.post({ type: "userEcho", text });
        this.post({ type: "busy", value: true });
        try {
          const { summary } = await this.bridge.onPrompt(text, (chunk) =>
            this.post({ type: "activity", text: chunk })
          );
          this.post({ type: "done", text: summary });
        } catch (e) {
          this.post({ type: "error", text: (e as Error).message });
        } finally {
          this.post({ type: "busy", value: false });
        }
      } else if (msg?.type === "clear") {
        this.bridge.onClear();
        this.post({ type: "cleared" });
      }
    });
  }

  /** Focus the input from a command. */
  focusInput(): void {
    this.view?.show?.(true);
    this.post({ type: "focus" });
  }

  private post(message: unknown): void {
    this.view?.webview.postMessage(message);
  }

  private html(webview: vscode.Webview): string {
    const nonce = getNonce();
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
    ].join("; ");

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0; padding: 0;
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    display: flex; flex-direction: column; height: 100vh;
  }
  #log { flex: 1; overflow-y: auto; padding: 12px; }
  .msg { margin: 0 0 12px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; }
  .msg .who { font-weight: 600; opacity: 0.7; font-size: 0.85em; display: block; margin-bottom: 2px; }
  .user .who { color: var(--vscode-charts-blue); }
  .agent .who { color: var(--vscode-charts-green); }
  .error { color: var(--vscode-errorForeground); }
  .activity {
    margin: 0 0 12px; padding: 8px 10px;
    border-left: 2px solid var(--vscode-panel-border);
    background: var(--vscode-textBlockQuote-background, rgba(127,127,127,0.08));
    border-radius: 0 4px 4px 0;
    font-size: 0.9em; opacity: 0.85;
  }
  .activity .step { display: block; opacity: 0.85; line-height: 1.6; }
  .activity.collapsed { opacity: 0.55; }
  .activity .caret { cursor: pointer; font-weight: 600; opacity: 0.7; user-select: none; }
  .activity.collapsed .step:not(.summary-line) { display: none; }
  .typing { display: inline-block; }
  .typing::after {
    content: '▍'; animation: blink 1s steps(2, start) infinite; opacity: 0.7;
  }
  @keyframes blink { to { visibility: hidden; } }
  #composer { display: flex; gap: 6px; padding: 8px; border-top: 1px solid var(--vscode-panel-border); }
  #input {
    flex: 1; resize: none; min-height: 36px; max-height: 140px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 4px; padding: 8px; font-family: inherit; font-size: inherit;
  }
  button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none; border-radius: 4px; padding: 0 12px; cursor: pointer;
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button:disabled { opacity: 0.5; cursor: default; }
  #toolbar { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; border-bottom: 1px solid var(--vscode-panel-border); }
  #toolbar .title { font-weight: 600; }
  .hint { opacity: 0.6; padding: 24px 12px; text-align: center; }
  .secondary { background: transparent; color: var(--vscode-foreground); opacity: 0.7; }
</style>
</head>
<body>
  <div id="toolbar">
    <span class="title">Inner Loop</span>
    <button id="clear" class="secondary" title="Clear conversation">Clear</button>
  </div>
  <div id="log">
    <div class="hint" id="hint">Ask Inner Loop about your workspace. It can read files, search, and propose edits — all locally.</div>
  </div>
  <div id="composer">
    <textarea id="input" placeholder="Ask Inner Loop…  (Enter to send, Shift+Enter for newline)"></textarea>
    <button id="send">Send</button>
  </div>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const log = document.getElementById('log');
  const input = document.getElementById('input');
  const send = document.getElementById('send');
  const clearBtn = document.getElementById('clear');
  const hint = document.getElementById('hint');
  let activityEl = null;   // live "thinking" trail for the current turn
  let stepCount = 0;

  function clearHint() { if (hint) { hint.remove(); } }

  function scrollToEnd() { log.scrollTop = log.scrollHeight; }

  function addMsg(cls, who, text) {
    clearHint();
    const div = document.createElement('div');
    div.className = 'msg ' + cls;
    const w = document.createElement('span');
    w.className = 'who'; w.textContent = who;
    div.appendChild(w);
    div.appendChild(document.createTextNode(text || ''));
    log.appendChild(div);
    scrollToEnd();
    return div;
  }

  // Begin (or return) the activity trail for the in-flight turn.
  function ensureActivity() {
    if (!activityEl) {
      clearHint();
      activityEl = document.createElement('div');
      activityEl.className = 'activity';
      const head = document.createElement('span');
      head.className = 'caret';
      head.textContent = 'Working…';
      head.addEventListener('click', () => activityEl.classList.toggle('collapsed'));
      activityEl.appendChild(head);
      activityEl._head = head;
      log.appendChild(activityEl);
      stepCount = 0;
    }
    return activityEl;
  }

  // Append a line of live activity. Each chunk may contain its own newline.
  function addActivity(text) {
    const el = ensureActivity();
    const line = document.createElement('span');
    line.className = 'step typing';
    line.textContent = text.replace(/\\n$/, '');
    // Settle the previous line's typing indicator before adding the new one.
    el.querySelectorAll('.step.typing').forEach((n) => n.classList.remove('typing'));
    el.appendChild(line);
    stepCount++;
    scrollToEnd();
  }

  // Collapse the activity trail into a compact, expandable summary.
  function settleActivity() {
    if (!activityEl) return;
    activityEl.querySelectorAll('.step.typing').forEach((n) => n.classList.remove('typing'));
    activityEl.classList.add('collapsed');
    if (activityEl._head) {
      activityEl._head.textContent = stepCount > 0
        ? ('Worked through ' + stepCount + ' step' + (stepCount === 1 ? '' : 's') + ' — show details')
        : 'Details';
    }
    activityEl = null;
  }

  function submit() {
    const text = input.value.trim();
    if (!text) return;
    vscode.postMessage({ type: 'prompt', text });
    input.value = '';
  }

  send.addEventListener('click', submit);
  clearBtn.addEventListener('click', () => vscode.postMessage({ type: 'clear' }));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  });

  window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
      case 'userEcho': activityEl = null; addMsg('user', 'You', msg.text); break;
      case 'activity': if (msg.text && msg.text.trim()) addActivity(msg.text); break;
      case 'done':
        settleActivity();
        addMsg('agent', 'Inner Loop', msg.text);
        break;
      case 'error': settleActivity(); addMsg('error', 'Error', msg.text); break;
      case 'busy': send.disabled = msg.value; input.disabled = msg.value; break;
      case 'cleared': log.innerHTML = ''; activityEl = null; break;
      case 'focus': input.focus(); break;
    }
  });
  input.focus();
</script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
