import type { AppServerEventHandler, CodexBridge } from "./bridge";
import type {
  CodexModel,
  CodexReviewTarget,
  CodexThreadSummary,
  ConnectionInfo,
  JsonObject,
  JsonRpcId,
  ReviewStartResult,
  ThreadStartResult,
  TurnStartResult,
} from "./types";
import { isCodexModel, isJsonObject } from "./types";
import { usageSummaryFromResponse, type CodexUsageSummary } from "./usage";

export interface ThreadOptions {
  model?: string;
  cwd?: string;
  serviceTier?: string;
  approvalPolicy?: "untrusted" | "on-request" | "never";
  sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
  personality?: "none" | "friendly" | "pragmatic";
}

export interface TurnOptions extends ThreadOptions {
  effort?: string;
  summary?: "none" | "auto" | "concise" | "detailed";
}

export interface ThreadListPage {
  data: CodexThreadSummary[];
  nextCursor: string | null;
}

export class CodexAdapter {
  constructor(private readonly bridge: CodexBridge) {}

  get mode(): CodexBridge["mode"] {
    return this.bridge.mode;
  }

  detect() {
    return this.bridge.detect();
  }

  chooseExecutable() {
    return this.bridge.chooseExecutable();
  }

  useAutoDetect() {
    return this.bridge.useAutoDetect();
  }

  connect(onEvent: AppServerEventHandler) {
    return this.bridge.connect(onEvent);
  }

  disconnect() {
    return this.bridge.disconnect();
  }

  modelsFromConnection(connection: ConnectionInfo): CodexModel[] {
    return connection.models.filter(isCodexModel);
  }

  async listModels(): Promise<CodexModel[]> {
    const models: CodexModel[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 100; page += 1) {
      const result = await this.bridge.request("model/list", {
        limit: 100,
        includeHidden: false,
        cursor,
      });
      if (!isJsonObject(result) || !Array.isArray(result.data))
        throw new Error("model/list returned an invalid response");
      models.push(...result.data.filter(isCodexModel));
      cursor = typeof result.nextCursor === "string" ? result.nextCursor : null;
      if (!cursor) return models;
    }
    throw new Error("model/list exceeded the pagination safety limit");
  }

  async readAccount(): Promise<JsonObject> {
    const result = await this.bridge.request("account/read", {
      refreshToken: false,
    });
    if (!isJsonObject(result))
      throw new Error("account/read returned an invalid response");
    return result;
  }

  async listThreads(
    cursor: string | null = null,
    searchTerm = "",
  ): Promise<ThreadListPage> {
    const params: JsonObject = { cursor, limit: 25 };
    if (searchTerm.trim()) params.searchTerm = searchTerm.trim();
    const result = await this.bridge.request("thread/list", params);
    if (!isJsonObject(result) || !Array.isArray(result.data))
      throw new Error("thread/list returned an invalid response");
    return {
      data: result.data
        .filter(isJsonObject)
        .map(threadSummaryFromJson)
        .filter((thread): thread is CodexThreadSummary => Boolean(thread)),
      nextCursor:
        typeof result.nextCursor === "string" ? result.nextCursor : null,
    };
  }

  usageFromConnection(connection: ConnectionInfo): CodexUsageSummary | null {
    return usageSummaryFromResponse(connection.rateLimits);
  }

  async readRateLimits(): Promise<CodexUsageSummary | null> {
    const result = await this.bridge.request("account/rateLimits/read", {});
    return usageSummaryFromResponse(result);
  }

  async startThread(options: ThreadOptions): Promise<ThreadStartResult> {
    const params: JsonObject = { ephemeral: false, serviceName: "tamagrid" };
    applyThreadOptions(params, options);
    const result = await this.bridge.request("thread/start", params);
    if (
      !isJsonObject(result) ||
      !isJsonObject(result.thread) ||
      typeof result.thread.id !== "string"
    ) {
      throw new Error("thread/start returned an invalid response");
    }
    return result as ThreadStartResult;
  }

  async resumeThread(
    threadId: string,
    options: ThreadOptions,
  ): Promise<ThreadStartResult> {
    const params: JsonObject = { threadId };
    applyThreadOptions(params, options);
    const result = await this.bridge.request("thread/resume", params);
    if (
      !isJsonObject(result) ||
      !isJsonObject(result.thread) ||
      typeof result.thread.id !== "string"
    ) {
      throw new Error("thread/resume returned an invalid response");
    }
    return result as ThreadStartResult;
  }

  async readThread(threadId: string): Promise<JsonObject> {
    const result = await this.bridge.request("thread/read", {
      threadId,
      includeTurns: true,
    });
    if (!isJsonObject(result))
      throw new Error("thread/read returned an invalid response");
    return result;
  }

  async renameThread(threadId: string, name: string): Promise<void> {
    const result = await this.bridge.request("thread/name/set", {
      threadId,
      name,
    });
    if (!isJsonObject(result))
      throw new Error("thread/name/set returned an invalid response");
  }

  async startTurn(
    threadId: string,
    text: string,
    options: TurnOptions,
  ): Promise<TurnStartResult> {
    const params: JsonObject = { threadId, text };
    const cwd = options.cwd?.trim();
    if (options.model) params.model = options.model;
    if (options.effort) params.effort = options.effort;
    if (options.summary) params.summary = options.summary;
    if (options.serviceTier) params.serviceTier = options.serviceTier;
    if (options.approvalPolicy) params.approvalPolicy = options.approvalPolicy;
    if (options.personality) params.personality = options.personality;
    if (options.sandboxMode) params.sandboxMode = options.sandboxMode;
    if (cwd) params.cwd = cwd;
    const result = await this.bridge.request("turn/start", params);
    if (
      !isJsonObject(result) ||
      !isJsonObject(result.turn) ||
      typeof result.turn.id !== "string"
    ) {
      throw new Error("turn/start returned an invalid response");
    }
    return result as TurnStartResult;
  }

  async steerTurn(
    threadId: string,
    turnId: string,
    text: string,
  ): Promise<void> {
    const result = await this.bridge.request("turn/steer", {
      threadId,
      expectedTurnId: turnId,
      text,
    });
    if (!isJsonObject(result) || result.turnId !== turnId)
      throw new Error("turn/steer returned an invalid response");
  }

  async startReview(
    threadId: string,
    target: CodexReviewTarget,
  ): Promise<ReviewStartResult> {
    const result = await this.bridge.request("review/start", {
      threadId,
      target,
    });
    if (
      !isJsonObject(result) ||
      typeof result.reviewThreadId !== "string" ||
      !isJsonObject(result.turn) ||
      typeof result.turn.id !== "string"
    ) {
      throw new Error("review/start returned an invalid response");
    }
    return result as ReviewStartResult;
  }

  interrupt(threadId: string, turnId: string): Promise<unknown> {
    return this.bridge.request("turn/interrupt", { threadId, turnId });
  }

  approve(requestId: JsonRpcId, approved: boolean): Promise<void> {
    return this.bridge.approve(requestId, approved ? "accept" : "decline");
  }
}

function applyThreadOptions(params: JsonObject, options: ThreadOptions): void {
  const cwd = options.cwd?.trim();
  if (options.model) params.model = options.model;
  if (cwd) params.cwd = cwd;
  if (options.serviceTier) params.serviceTier = options.serviceTier;
  if (options.approvalPolicy) params.approvalPolicy = options.approvalPolicy;
  if (options.sandboxMode) params.sandbox = options.sandboxMode;
  if (options.personality) params.personality = options.personality;
}

function threadSummaryFromJson(value: JsonObject): CodexThreadSummary | null {
  if (typeof value.id !== "string") return null;
  const status = isJsonObject(value.status)
    ? typeof value.status.type === "string"
      ? value.status.type
      : undefined
    : typeof value.status === "string"
      ? value.status
      : undefined;
  const source = isJsonObject(value.source)
    ? typeof value.source.type === "string"
      ? value.source.type
      : undefined
    : typeof value.source === "string"
      ? value.source
      : undefined;
  return {
    id: value.id,
    name: typeof value.name === "string" ? value.name : null,
    preview: typeof value.preview === "string" ? value.preview : "",
    cwd: typeof value.cwd === "string" ? value.cwd : "",
    createdAt: typeof value.createdAt === "number" ? value.createdAt : 0,
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : 0,
    modelProvider:
      typeof value.modelProvider === "string" ? value.modelProvider : "",
    status,
    source,
  };
}
