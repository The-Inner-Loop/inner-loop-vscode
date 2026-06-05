import * as http from "http";
import * as https from "https";
import { URL } from "url";
import { ChatMessage } from "../agent/types";

/**
 * Minimal Ollama HTTP client (PRD 12). Uses Node's built-in http/https only —
 * no external HTTP dependency, no cloud calls.
 */

export interface OllamaModel {
  name: string;
  size?: number;
  modified_at?: string;
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  /** When true, ask Ollama to constrain output to JSON. */
  json?: boolean;
  temperature?: number;
  /** Abort the request when this signal fires (e.g. user cancellation). */
  signal?: AbortSignal;
}

function requestJson<T>(
  urlString: string,
  method: "GET" | "POST",
  body?: unknown,
  timeoutMs = 120_000,
  signal?: AbortSignal
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Request aborted."));
      return;
    }
    const url = new URL(urlString);
    const lib = url.protocol === "https:" ? https : http;
    const payload = body ? JSON.stringify(body) : undefined;

    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          if ((res.statusCode ?? 500) >= 400) {
            reject(new Error(`Ollama HTTP ${res.statusCode}: ${raw}`));
            return;
          }
          try {
            resolve(JSON.parse(raw) as T);
          } catch (e) {
            reject(new Error(`Invalid JSON from Ollama: ${(e as Error).message}`));
          }
        });
      }
    );

    const onAbort = () => req.destroy(new Error("Request aborted."));
    signal?.addEventListener("abort", onAbort, { once: true });

    req.on("timeout", () => {
      req.destroy(new Error("Ollama request timed out."));
    });
    req.on("error", (err) => reject(err));
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

export class OllamaClient {
  constructor(private readonly baseUrl: string) {}

  /** Health check + list installed models (GET /api/tags). */
  async listModels(): Promise<OllamaModel[]> {
    const data = await requestJson<{ models?: OllamaModel[] }>(
      `${this.baseUrl}/api/tags`,
      "GET",
      undefined,
      8_000
    );
    return data.models ?? [];
  }

  async isReachable(): Promise<boolean> {
    try {
      await this.listModels();
      return true;
    } catch {
      return false;
    }
  }

  async hasModel(model: string): Promise<boolean> {
    const models = await this.listModels();
    // Ollama tags often include a ":tag" suffix (e.g. qwen3-coder:latest).
    return models.some(
      (m) => m.name === model || m.name.split(":")[0] === model.split(":")[0]
    );
  }

  /** Non-streaming chat (POST /api/chat). Returns the assistant message text. */
  async chat(options: ChatOptions): Promise<string> {
    const data = await requestJson<{ message?: { content?: string } }>(
      `${this.baseUrl}/api/chat`,
      "POST",
      {
        model: options.model,
        messages: options.messages,
        stream: false,
        ...(options.json ? { format: "json" } : {}),
        options: {
          temperature: options.temperature ?? 0.2,
        },
      },
      120_000,
      options.signal
    );
    return data.message?.content ?? "";
  }

  /**
   * Generate an embedding vector for text (POST /api/embeddings).
   * Used for semantic memory retrieval. Returns [] on failure so callers can
   * gracefully fall back to keyword search.
   */
  async embed(model: string, text: string): Promise<number[]> {
    try {
      const data = await requestJson<{ embedding?: number[] }>(
        `${this.baseUrl}/api/embeddings`,
        "POST",
        { model, prompt: text },
        20_000
      );
      return data.embedding ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Streaming chat (POST /api/chat, stream:true → NDJSON). Invokes `onToken`
   * for each content chunk and resolves with the full concatenated text.
   */
  chatStream(
    options: ChatOptions,
    onToken: (chunk: string) => void
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (options.signal?.aborted) {
        reject(new Error("Request aborted."));
        return;
      }
      const url = new URL(`${this.baseUrl}/api/chat`);
      const lib = url.protocol === "https:" ? https : http;
      const payload = JSON.stringify({
        model: options.model,
        messages: options.messages,
        stream: true,
        options: { temperature: options.temperature ?? 0.2 },
      });

      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
          timeout: 180_000,
        },
        (res) => {
          if ((res.statusCode ?? 500) >= 400) {
            reject(new Error(`Ollama HTTP ${res.statusCode}`));
            return;
          }
          let full = "";
          let buffer = "";
          res.on("data", (c) => {
            buffer += c.toString("utf8");
            let nl: number;
            // NDJSON: one JSON object per line.
            while ((nl = buffer.indexOf("\n")) >= 0) {
              const line = buffer.slice(0, nl).trim();
              buffer = buffer.slice(nl + 1);
              if (!line) {
                continue;
              }
              try {
                const obj = JSON.parse(line) as {
                  message?: { content?: string };
                  done?: boolean;
                };
                const chunk = obj.message?.content ?? "";
                if (chunk) {
                  full += chunk;
                  onToken(chunk);
                }
              } catch {
                // Ignore partial/non-JSON lines.
              }
            }
          });
          res.on("end", () => resolve(full));
        }
      );

      const onAbort = () => {
        req.destroy(new Error("Request aborted."));
        reject(new Error("Request aborted."));
      };
      options.signal?.addEventListener("abort", onAbort, { once: true });

      req.on("timeout", () => req.destroy(new Error("Ollama stream timed out.")));
      req.on("error", (err) => reject(err));
      req.write(payload);
      req.end();
    });
  }
}
