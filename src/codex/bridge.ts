import { Channel, invoke } from "@tauri-apps/api/core";
import type {
  AppServerEvent,
  ConnectionInfo,
  DetectionResult,
  JsonObject,
  JsonRpcId,
} from "./types";

export type AppServerEventHandler = (event: AppServerEvent) => void;

export interface CodexBridge {
  readonly mode: "tauri" | "preview";
  detect(): Promise<DetectionResult>;
  chooseExecutable(): Promise<DetectionResult>;
  useAutoDetect(): Promise<DetectionResult>;
  connect(onEvent: AppServerEventHandler): Promise<ConnectionInfo>;
  disconnect(): Promise<void>;
  request(method: string, params: JsonObject): Promise<unknown>;
  approve(requestId: JsonRpcId, decision: "accept" | "decline"): Promise<void>;
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export class TauriCodexBridge implements CodexBridge {
  readonly mode = "tauri" as const;

  detect(): Promise<DetectionResult> {
    return invoke<DetectionResult>("detect_codex");
  }

  chooseExecutable(): Promise<DetectionResult> {
    return invoke<DetectionResult>("choose_codex_executable");
  }

  useAutoDetect(): Promise<DetectionResult> {
    return invoke<DetectionResult>("use_auto_detect_codex");
  }

  connect(onEvent: AppServerEventHandler): Promise<ConnectionInfo> {
    const onEventChannel = new Channel<AppServerEvent>();
    onEventChannel.onmessage = onEvent;
    return invoke<ConnectionInfo>("connect_app_server", {
      onEvent: onEventChannel,
    });
  }

  disconnect(): Promise<void> {
    return invoke("disconnect_app_server");
  }

  request(method: string, params: JsonObject): Promise<unknown> {
    const command = TAURI_REQUEST_COMMANDS[method];
    if (!command)
      return Promise.reject(
        new Error(`TamaGrid does not expose App Server method ${method}`),
      );
    if (method === "account/read" || method === "account/rateLimits/read")
      return invoke(command);
    return invoke(command, { params });
  }

  approve(requestId: JsonRpcId, decision: "accept" | "decline"): Promise<void> {
    return invoke("approve_request", { requestId, decision });
  }
}

const TAURI_REQUEST_COMMANDS: Readonly<Record<string, string>> = Object.freeze({
  "account/read": "codex_account_read",
  "account/rateLimits/read": "codex_rate_limits_read",
  "model/list": "codex_model_list",
  "thread/start": "codex_thread_start",
  "thread/list": "codex_thread_list",
  "thread/resume": "codex_thread_resume",
  "thread/read": "codex_thread_read",
  "thread/name/set": "codex_thread_name_set",
  "review/start": "codex_review_start",
  "turn/start": "codex_turn_start",
  "turn/steer": "codex_turn_steer",
  "turn/interrupt": "codex_turn_interrupt",
});

interface MockTurn {
  threadId: string;
  turnId: string;
  kind: "task" | "review";
  timers: number[];
}

export class PreviewCodexBridge implements CodexBridge {
  readonly mode = "preview" as const;
  private generation = 0;
  private sequence = 0;
  private threadCounter = 0;
  private readonly previewSessionId = Date.now().toString(36);
  private turnCounter = 0;
  private requestCounter = 1000;
  private onEvent: AppServerEventHandler = () => undefined;
  private activeTurns = new Map<string, MockTurn>();
  private pendingApprovals = new Map<
    string,
    { requestId: JsonRpcId; threadId: string; turnId: string }
  >();
  private readonly previewThreads: JsonObject[] = [
    {
      id: "preview-history-tamagrid",
      sessionId: "preview-history-tamagrid",
      name: "TamaGridの4Pane設計",
      preview: "4Paneで複数taskを監督できるレイアウトを整理する",
      cwd: "C:\\workspace\\tamagrid",
      createdAt: 1_785_960_000,
      updatedAt: 1_786_046_400,
      modelProvider: "openai",
      status: { type: "notLoaded" },
      source: "appServer",
    },
    {
      id: "preview-history-tests",
      sessionId: "preview-history-tests",
      name: "Windows build verification",
      preview: "TauriのテストとWindows installerを確認する",
      cwd: "C:\\workspace\\desktop-app",
      createdAt: 1_785_873_600,
      updatedAt: 1_785_960_000,
      modelProvider: "openai",
      status: { type: "notLoaded" },
      source: "cli",
    },
    {
      id: "preview-history-docs",
      sessionId: "preview-history-docs",
      name: null,
      preview: "Codex App Serverの履歴APIを調査する",
      cwd: "C:\\workspace\\protocol-notes",
      createdAt: 1_785_700_800,
      updatedAt: 1_785_787_200,
      modelProvider: "openai",
      status: { type: "notLoaded" },
      source: "vscode",
    },
  ];

  private readonly rateLimits = {
    rateLimits: {
      limitId: "codex",
      limitName: "Codex",
      primary: {
        usedPercent: 34,
        windowDurationMins: 10_080,
        resetsAt: 1_893_456_000,
      },
      credits: { balance: "0", hasCredits: false, unlimited: false },
      planType: "preview",
    },
    rateLimitsByLimitId: {
      codex: {
        limitId: "codex",
        limitName: "Codex",
        primary: {
          usedPercent: 34,
          windowDurationMins: 10_080,
          resetsAt: 1_893_456_000,
        },
      },
      preview_rapid: {
        limitId: "preview_rapid",
        limitName: "Preview Rapid",
        primary: { usedPercent: 8, windowDurationMins: 300 },
      },
    },
    rateLimitResetCredits: { availableCount: 0 },
  };

  private readonly models = [
    {
      id: "preview-balanced",
      model: "preview-balanced",
      displayName: "Preview Balanced",
      description: "Browser preview fixture",
      hidden: false,
      isDefault: true,
      defaultReasoningEffort: "standard",
      defaultServiceTier: "standard",
      serviceTiers: [
        {
          id: "standard",
          name: "Standard",
          description: "Preview standard service tier",
        },
        {
          id: "priority",
          name: "Priority",
          description: "Preview priority service tier",
        },
      ],
      supportsPersonality: true,
      supportedReasoningEfforts: [
        { reasoningEffort: "standard", description: "Preview effort" },
      ],
    },
    {
      id: "preview-rapid",
      model: "preview-rapid",
      displayName: "Preview Rapid",
      description: "Browser preview fixture",
      hidden: false,
      isDefault: false,
      defaultReasoningEffort: "quick",
      serviceTiers: [],
      supportsPersonality: false,
      supportedReasoningEfforts: [
        { reasoningEffort: "quick", description: "Preview effort" },
      ],
    },
  ];

  async detect(): Promise<DetectionResult> {
    return {
      executablePath: "Preview mode (no executable)",
      version: "preview",
    };
  }

  chooseExecutable(): Promise<DetectionResult> {
    return this.detect();
  }

  useAutoDetect(): Promise<DetectionResult> {
    return this.detect();
  }

  async connect(onEvent: AppServerEventHandler): Promise<ConnectionInfo> {
    this.generation += 1;
    this.sequence = 0;
    this.onEvent = onEvent;
    return {
      generation: this.generation,
      executablePath: "Preview mode (no executable)",
      version: "preview",
      initialize: { platformFamily: "browser-preview", platformOs: "browser" },
      account: { account: { type: "preview" }, requiresOpenaiAuth: false },
      models: this.models,
      rateLimits: this.rateLimits,
    };
  }

  async disconnect(): Promise<void> {
    for (const turn of this.activeTurns.values())
      turn.timers.forEach(window.clearTimeout);
    this.activeTurns.clear();
    this.pendingApprovals.clear();
  }

  async request(method: string, params: JsonObject): Promise<unknown> {
    switch (method) {
      case "account/read":
        return { account: { type: "preview" }, requiresOpenaiAuth: false };
      case "account/rateLimits/read":
        return this.rateLimits;
      case "model/list":
        return { data: this.models, nextCursor: null };
      case "thread/list": {
        const query =
          typeof params.searchTerm === "string" ? params.searchTerm : "";
        const start = Number(params.cursor ?? 0) || 0;
        const limit = Number(params.limit ?? 25) || 25;
        const filtered = this.previewThreads.filter((thread) => {
          if (!query) return true;
          return `${String(thread.name ?? "")} ${String(thread.preview ?? "")}`.includes(
            query,
          );
        });
        const data = filtered.slice(start, start + limit);
        const next = start + data.length;
        return {
          data,
          nextCursor: next < filtered.length ? String(next) : null,
        };
      }
      case "thread/start": {
        const id = `preview-thread-${this.previewSessionId}-${++this.threadCounter}`;
        const timestamp = Math.floor(Date.now() / 1000);
        this.previewThreads.unshift({
          id,
          sessionId: id,
          name: null,
          preview: "TamaGridで開始した新しいtask",
          cwd: typeof params.cwd === "string" ? params.cwd : "",
          createdAt: timestamp,
          updatedAt: timestamp,
          modelProvider: "openai",
          status: { type: "idle" },
          source: "appServer",
        });
        return { thread: { id, sessionId: id }, model: this.models[0].id };
      }
      case "thread/resume": {
        const threadId = String(params.threadId);
        if (!this.previewThreads.some((thread) => thread.id === threadId)) {
          const timestamp = Math.floor(Date.now() / 1000);
          this.previewThreads.unshift({
            id: threadId,
            sessionId: threadId,
            name: null,
            preview: null,
            cwd: typeof params.cwd === "string" ? params.cwd : "",
            createdAt: timestamp,
            updatedAt: timestamp,
            modelProvider: "openai",
            status: { type: "idle" },
            source: "appServer",
          });
        }
        return {
          thread: {
            id: threadId,
            sessionId: threadId,
          },
        };
      }
      case "thread/read":
        return this.readPreviewThread(String(params.threadId));
      case "thread/name/set": {
        const threadId = String(params.threadId);
        const name = typeof params.name === "string" ? params.name.trim() : "";
        const thread = this.previewThreads.find(
          (candidate) => candidate.id === threadId,
        );
        if (!thread || !name)
          throw new Error("Preview thread cannot be renamed");
        thread.name = name;
        thread.updatedAt = Math.floor(Date.now() / 1000);
        this.emitMessage({
          method: "thread/name/updated",
          params: { threadId, threadName: name },
        });
        return {};
      }
      case "turn/start":
        return this.startPreviewTurn(params);
      case "turn/steer":
        return this.steerPreviewTurn(params);
      case "turn/interrupt":
        return this.interruptPreviewTurn(params);
      case "review/start":
        return this.startPreviewReview(params);
      default:
        throw new Error(`Preview bridge does not implement ${method}`);
    }
  }

  private readPreviewThread(threadId: string): JsonObject {
    const summary =
      this.previewThreads.find((thread) => thread.id === threadId) ?? {};
    return {
      thread: {
        ...summary,
        id: threadId,
        turns: [
          {
            id: `preview-history-turn-${threadId}`,
            status: "completed",
            items: [
              {
                id: `preview-history-user-${threadId}`,
                type: "userMessage",
                content: [
                  {
                    type: "text",
                    text:
                      typeof summary.preview === "string"
                        ? summary.preview
                        : "過去のtaskを開く",
                  },
                ],
              },
              {
                id: `preview-history-agent-${threadId}`,
                type: "agentMessage",
                text: "この履歴は内容を展開してから、選択中のPaneでそのまま継続できます。",
              },
            ],
          },
        ],
      },
    };
  }

  async approve(
    requestId: JsonRpcId,
    decision: "accept" | "decline",
  ): Promise<void> {
    const key = `${typeof requestId}:${requestId}`;
    const pending = this.pendingApprovals.get(key);
    if (!pending) throw new Error("Preview approval is no longer pending");
    this.pendingApprovals.delete(key);
    this.emitMessage({
      method: "serverRequest/resolved",
      params: { requestId, threadId: pending.threadId },
    });
    this.finishPreviewTurn(
      pending.threadId,
      pending.turnId,
      decision === "accept"
        ? "承認されました。左右のPaneは独立したthreadとして動作します。"
        : "操作は拒否されました。turnは安全に続行されました。",
    );
  }

  private startPreviewTurn(params: JsonObject): unknown {
    const threadId = String(params.threadId);
    const turnId = `preview-turn-${++this.turnCounter}`;
    const input = Array.isArray(params.input) ? params.input : [];
    const text =
      typeof params.text === "string"
        ? params.text
        : input
            .filter(
              (item): item is JsonObject =>
                typeof item === "object" && item !== null,
            )
            .map((item) => (typeof item.text === "string" ? item.text : ""))
            .join("\n");
    const timers: number[] = [];
    const schedule = (delay: number, callback: () => void) =>
      timers.push(window.setTimeout(callback, delay));
    this.activeTurns.set(threadId, {
      threadId,
      turnId,
      kind: "task",
      timers,
    });
    schedule(20, () =>
      this.emitMessage({
        method: "turn/started",
        params: {
          threadId,
          turn: { id: turnId, status: "inProgress", items: [] },
        },
      }),
    );
    schedule(50, () =>
      this.emitMessage({
        method: "item/started",
        params: {
          threadId,
          turnId,
          startedAtMs: Date.now(),
          item: {
            id: `user-${turnId}`,
            type: "userMessage",
            content: [{ type: "text", text }],
          },
        },
      }),
    );
    schedule(90, () => {
      const thread = this.previewThreads.find(
        (candidate) => candidate.id === threadId,
      );
      if (
        !thread ||
        (typeof thread.name === "string" && thread.name.trim().length > 0)
      )
        return;
      const threadName = previewThreadTitle(text);
      thread.name = threadName;
      thread.preview = text;
      thread.updatedAt = Math.floor(Date.now() / 1000);
      this.emitMessage({
        method: "thread/name/updated",
        params: { threadId, threadName },
      });
    });
    if (/承認|approve|command/i.test(text)) {
      schedule(180, () => {
        const requestId = ++this.requestCounter;
        this.pendingApprovals.set(`${typeof requestId}:${requestId}`, {
          requestId,
          threadId,
          turnId,
        });
        this.emitMessage({
          id: requestId,
          method: "item/commandExecution/requestApproval",
          params: {
            threadId,
            turnId,
            itemId: `command-${turnId}`,
            command: "pnpm test",
            reason: "Preview approval flow",
            startedAtMs: Date.now(),
          },
        });
      });
    } else {
      const finishDelay = /stop|slow|停止/i.test(text) ? 1_500 : 160;
      schedule(finishDelay, () =>
        this.finishPreviewTurn(
          threadId,
          turnId,
          "TamaGrid preview: streaming、Stop、model discovery、復元状態を確認できます。",
        ),
      );
    }
    return { turn: { id: turnId, status: "inProgress", items: [] } };
  }

  private steerPreviewTurn(params: JsonObject): unknown {
    const threadId = String(params.threadId);
    const expectedTurnId = String(params.expectedTurnId);
    const active = this.activeTurns.get(threadId);
    if (!active || active.turnId !== expectedTurnId)
      throw new Error("Preview turn is no longer active");
    if (active.kind === "review")
      throw new Error("Code review turns cannot be steered");
    const input = Array.isArray(params.input) ? params.input : [];
    const text =
      typeof params.text === "string"
        ? params.text
        : input
            .filter(isPreviewJsonObject)
            .map((item) => (typeof item.text === "string" ? item.text : ""))
            .filter(Boolean)
            .join("\n");
    const itemId = `steer-${++this.requestCounter}`;
    this.emitMessage({
      method: "item/completed",
      params: {
        threadId,
        turnId: active.turnId,
        completedAtMs: Date.now(),
        item: {
          id: itemId,
          type: "userMessage",
          content: [{ type: "text", text }],
        },
      },
    });
    this.emitMessage({
      method: "item/completed",
      params: {
        threadId,
        turnId: active.turnId,
        completedAtMs: Date.now(),
        item: {
          id: `${itemId}-ack`,
          type: "agentMessage",
          phase: "commentary",
          text: "追加入力を受け付けました。現在のturnへ反映します。",
        },
      },
    });
    return { turnId: active.turnId };
  }

  private startPreviewReview(params: JsonObject): unknown {
    const threadId = String(params.threadId);
    if (this.activeTurns.has(threadId))
      throw new Error("Preview thread already has an active turn");
    const turnId = `preview-review-${++this.turnCounter}`;
    const target = isPreviewJsonObject(params.target) ? params.target : {};
    const reviewLabel = previewReviewLabel(target);
    const timers: number[] = [];
    const schedule = (delay: number, callback: () => void) =>
      timers.push(window.setTimeout(callback, delay));
    this.activeTurns.set(threadId, {
      threadId,
      turnId,
      kind: "review",
      timers,
    });
    schedule(20, () =>
      this.emitMessage({
        method: "turn/started",
        params: {
          threadId,
          turn: { id: turnId, status: "inProgress", items: [] },
        },
      }),
    );
    schedule(70, () =>
      this.emitMessage({
        method: "item/completed",
        params: {
          threadId,
          turnId,
          completedAtMs: Date.now(),
          item: {
            id: `review-enter-${turnId}`,
            type: "enteredReviewMode",
            review: reviewLabel,
          },
        },
      }),
    );
    schedule(260, () => {
      this.emitMessage({
        method: "item/completed",
        params: {
          threadId,
          turnId,
          completedAtMs: Date.now(),
          item: {
            id: `review-exit-${turnId}`,
            type: "exitedReviewMode",
            review:
              "Preview review complete: 重大な問題はありません。実配布版ではCodex reviewerの結果をここへ表示します。",
          },
        },
      });
      this.emitMessage({
        method: "turn/completed",
        params: {
          threadId,
          turn: { id: turnId, status: "completed", items: [], error: null },
        },
      });
      this.activeTurns.delete(threadId);
    });
    return {
      reviewThreadId: threadId,
      turn: { id: turnId, status: "inProgress", items: [] },
    };
  }

  private finishPreviewTurn(
    threadId: string,
    turnId: string,
    answer: string,
  ): void {
    const itemId = `agent-${turnId}`;
    this.emitMessage({
      method: "item/started",
      params: {
        threadId,
        turnId,
        startedAtMs: Date.now(),
        item: { id: itemId, type: "agentMessage", text: "" },
      },
    });
    const chunks = answer.match(/.{1,16}/gu) ?? [answer];
    chunks.forEach((delta, index) => {
      window.setTimeout(
        () =>
          this.emitMessage({
            method: "item/agentMessage/delta",
            params: { threadId, turnId, itemId, delta },
          }),
        index * 35,
      );
    });
    window.setTimeout(
      () => {
        this.emitMessage({
          method: "item/completed",
          params: {
            threadId,
            turnId,
            completedAtMs: Date.now(),
            item: { id: itemId, type: "agentMessage", text: answer },
          },
        });
        this.emitMessage({
          method: "turn/completed",
          params: {
            threadId,
            turn: { id: turnId, status: "completed", items: [], error: null },
          },
        });
        this.activeTurns.delete(threadId);
      },
      chunks.length * 35 + 20,
    );
  }

  private interruptPreviewTurn(params: JsonObject): unknown {
    const threadId = String(params.threadId);
    const active = this.activeTurns.get(threadId);
    if (active) {
      active.timers.forEach(window.clearTimeout);
      this.activeTurns.delete(threadId);
      this.emitMessage({
        method: "turn/completed",
        params: {
          threadId,
          turn: {
            id: active.turnId,
            status: "interrupted",
            items: [],
            error: null,
          },
        },
      });
    }
    return {};
  }

  private emitMessage(message: JsonObject): void {
    this.onEvent({
      generation: this.generation,
      sequence: ++this.sequence,
      eventType: "message",
      message,
    });
  }
}

export function createCodexBridge(): CodexBridge {
  return isTauriRuntime() ? new TauriCodexBridge() : new PreviewCodexBridge();
}

function isPreviewJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function previewReviewLabel(target: JsonObject): string {
  switch (target.type) {
    case "baseBranch":
      return `base branch ${String(target.branch ?? "")}`.trim();
    case "commit":
      return `commit ${String(target.sha ?? "")}`.trim();
    case "custom":
      return String(target.instructions ?? "custom review");
    default:
      return "uncommitted changes";
  }
}

function previewThreadTitle(text: string): string {
  const firstLine = text.split(/\r?\n/u)[0]?.trim() || "New chat";
  return firstLine.length > 42 ? `${firstLine.slice(0, 41)}…` : firstLine;
}
