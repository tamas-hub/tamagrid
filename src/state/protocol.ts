import type { TimelineEvent } from "../components/types";
import type { JsonObject, JsonRpcId, JsonRpcMessage } from "../codex";
import { isJsonObject, rpcIdKey } from "../codex";
import type { PaneRuntimeState, PendingApproval } from "./workspace";

const MAX_DETAIL_LENGTH = 12_000;
const MAX_EVENTS = 200;

export function protocolThreadId(message: JsonRpcMessage): string | undefined {
  const params = isJsonObject(message.params) ? message.params : undefined;
  if (params && typeof params.threadId === "string") return params.threadId;
  if (
    params &&
    isJsonObject(params.thread) &&
    typeof params.thread.id === "string"
  )
    return params.thread.id;
  return undefined;
}

export function applyProtocolMessage(
  panes: PaneRuntimeState[],
  message: JsonRpcMessage,
): PaneRuntimeState[] {
  const threadId = protocolThreadId(message);
  if (!threadId) return panes;
  const index = panes.findIndex((pane) => pane.threadId === threadId);
  if (index < 0) return panes;
  const pane = panes[index];
  const params = isJsonObject(message.params) ? message.params : {};
  const nextPane = applyToPane(pane, message, params);
  if (nextPane === pane) return panes;
  const next = panes.slice();
  next[index] = nextPane;
  return next;
}

function applyToPane(
  pane: PaneRuntimeState,
  message: JsonRpcMessage,
  params: JsonObject,
): PaneRuntimeState {
  const method = message.method;
  if (!method) return pane;

  if (message.id !== undefined && isApprovalMethod(method)) {
    return applyApproval(pane, message.id, method, params);
  }

  switch (method) {
    case "turn/started": {
      const turn = isJsonObject(params.turn) ? params.turn : {};
      return {
        ...pane,
        status: "Running",
        activeTurnId: typeof turn.id === "string" ? turn.id : pane.activeTurnId,
        approval: undefined,
        error: undefined,
      };
    }
    case "turn/completed":
      return applyTurnCompleted(pane, params);
    case "thread/status/changed":
      return applyThreadStatus(pane, params);
    case "thread/name/updated": {
      const title =
        typeof params.threadName === "string" ? params.threadName.trim() : "";
      return title === pane.title ? pane : { ...pane, title };
    }
    case "item/started":
    case "item/completed": {
      const item = isJsonObject(params.item) ? params.item : undefined;
      if (!item) return pane;
      return upsertEvent(pane, eventFromItem(item));
    }
    case "item/agentMessage/delta":
      return appendDelta(pane, params, "assistant", "Codex");
    case "item/plan/delta":
      return appendDelta(pane, params, "progress", "Plan");
    case "item/reasoning/summaryTextDelta":
      return appendDelta(pane, params, "progress", "Reasoning summary");
    case "item/commandExecution/outputDelta":
      return appendDelta(pane, params, "tool", "Command output");
    case "turn/diff/updated":
      return upsertEvent(pane, {
        id: eventId(params, "diff"),
        kind: "file",
        title: "Working diff",
        detail: textValue(params.diff),
        time: nowLabel(),
      });
    case "turn/plan/updated":
      return upsertEvent(pane, {
        id: eventId(params, "plan"),
        kind: "progress",
        title: "Plan",
        detail: planText(params),
        time: nowLabel(),
      });
    case "error":
      return applyError(pane, params);
    case "serverRequest/resolved":
      return resolveServerRequest(pane, params);
    case "model/rerouted":
      return upsertEvent(pane, {
        id: eventId(params, "model-rerouted"),
        kind: "progress",
        title: "Model rerouted",
        detail:
          `${textValue(params.fromModel)} → ${textValue(params.toModel)}\n${textValue(params.reason)}`.trim(),
        time: nowLabel(),
      });
    default:
      return pane;
  }
}

function applyApproval(
  pane: PaneRuntimeState,
  requestId: JsonRpcId,
  method: string,
  params: JsonObject,
): PaneRuntimeState {
  const kind: PendingApproval["kind"] = method.includes("fileChange")
    ? "file"
    : "command";
  const reason = textValue(params.reason);
  const network = isJsonObject(params.networkApprovalContext)
    ? `${textValue(params.networkApprovalContext.protocol)}://${textValue(params.networkApprovalContext.host)}`
    : "";
  const command = textValue(params.command);
  const cwd = textValue(params.cwd);
  const itemId = textValue(params.itemId);
  const actions = Array.isArray(params.commandActions)
    ? jsonPreview(params.commandActions)
    : "";
  const policyChange = approvalPolicyChangeText(params);
  const requestedChanges = approvalChangesText(params);
  const recentFileChange = [...pane.events]
    .reverse()
    .find((event) => event.kind === "file" && event.detail)?.detail;
  const changes = requestedChanges || (kind === "file" ? recentFileChange : "");
  const subject =
    kind === "file"
      ? `Item: ${itemId}`
      : command || network || `Item: ${itemId}`;
  const approval: PendingApproval = {
    key: rpcIdKey(requestId),
    requestId,
    method,
    kind,
    message: truncate([reason, subject].filter(Boolean).join("\n")),
    reason: reason || undefined,
    command: command || undefined,
    cwd: cwd || undefined,
    network: network || undefined,
    actions: actions || undefined,
    policyChange: policyChange || undefined,
    changes: changes || undefined,
    itemId: itemId || undefined,
    canApprove:
      kind === "file"
        ? Boolean(changes)
        : Boolean(command || network || actions || policyChange),
  };
  return { ...pane, status: "Approval", approval, error: undefined };
}

function approvalChangesText(params: JsonObject): string {
  for (const value of [params.changes, params.fileChanges]) {
    if (Array.isArray(value)) {
      const text = fileChangesText({ changes: value });
      if (text) return text;
    }
  }
  return textValue(params.diff) || textValue(params.grantRoot);
}

function approvalPolicyChangeText(params: JsonObject): string {
  const changes = [
    params.proposedExecpolicyAmendment,
    params.proposedNetworkPolicyAmendment,
    params.proposedPermissions,
  ].filter((value) => value !== undefined && value !== null);
  return changes.length
    ? jsonPreview(changes.length === 1 ? changes[0] : changes)
    : "";
}

function applyTurnCompleted(
  pane: PaneRuntimeState,
  params: JsonObject,
): PaneRuntimeState {
  const turn = isJsonObject(params.turn) ? params.turn : {};
  const turnId = typeof turn.id === "string" ? turn.id : undefined;
  if (pane.activeTurnId && turnId && pane.activeTurnId !== turnId) return pane;
  const status = typeof turn.status === "string" ? turn.status : "completed";
  if (status === "failed") {
    const error = isJsonObject(turn.error)
      ? textValue(turn.error.message)
      : "Codex turn failed";
    return {
      ...pane,
      status: "Error",
      activeTurnId: undefined,
      activeTurnKind: undefined,
      approval: undefined,
      error,
      events: appendEvent(pane.events, {
        id: `turn-error-${turnId ?? Date.now()}`,
        kind: "error",
        title: "Turn failed",
        detail: error,
        time: nowLabel(),
      }),
    };
  }
  if (status === "interrupted") {
    return {
      ...pane,
      status: "Idle",
      activeTurnId: undefined,
      activeTurnKind: undefined,
      approval: undefined,
      error: undefined,
      events: appendEvent(pane.events, {
        id: `turn-interrupted-${turnId ?? Date.now()}`,
        kind: "progress",
        title: "Turn stopped",
        time: nowLabel(),
      }),
    };
  }
  return {
    ...pane,
    status: "Done",
    activeTurnId: undefined,
    activeTurnKind: undefined,
    approval: undefined,
    error: undefined,
  };
}

function applyThreadStatus(
  pane: PaneRuntimeState,
  params: JsonObject,
): PaneRuntimeState {
  const status = params.status;
  if (isJsonObject(status)) {
    const type = textValue(status.type);
    const flags = Array.isArray(status.activeFlags) ? status.activeFlags : [];
    if (flags.includes("waitingOnApproval"))
      return { ...pane, status: "Approval" };
    if (type === "active") return { ...pane, status: "Running" };
    if (type === "systemError") return { ...pane, status: "Error" };
    if (type === "idle" && pane.status === "Running")
      return { ...pane, status: "Done" };
  }
  return pane;
}

function applyError(
  pane: PaneRuntimeState,
  params: JsonObject,
): PaneRuntimeState {
  const error = isJsonObject(params.error)
    ? textValue(params.error.message)
    : "Unknown App Server error";
  const willRetry = params.willRetry === true;
  return {
    ...pane,
    error: willRetry ? pane.error : error,
    events: appendEvent(pane.events, {
      id: eventId(params, willRetry ? "retry" : "error"),
      kind: willRetry ? "progress" : "error",
      title: willRetry ? "Temporary error — retrying" : "App Server error",
      detail: error,
      time: nowLabel(),
    }),
  };
}

function resolveServerRequest(
  pane: PaneRuntimeState,
  params: JsonObject,
): PaneRuntimeState {
  if (!pane.approval) return pane;
  const requestId = params.requestId;
  if (
    (typeof requestId !== "string" && typeof requestId !== "number") ||
    rpcIdKey(requestId) !== pane.approval.key
  )
    return pane;
  return {
    ...pane,
    approval: undefined,
    status: pane.activeTurnId ? "Running" : "Idle",
  };
}

function appendDelta(
  pane: PaneRuntimeState,
  params: JsonObject,
  kind: TimelineEvent["kind"],
  title: string,
): PaneRuntimeState {
  const id =
    typeof params.itemId === "string" ? params.itemId : eventId(params, kind);
  const delta = textValue(params.delta);
  const existing = pane.events.find((event) => event.id === id);
  return upsertEvent(pane, {
    id,
    kind,
    title: existing?.title ?? title,
    detail: truncate(`${existing?.detail ?? ""}${delta}`),
    time: existing?.time ?? nowLabel(),
  });
}

function upsertEvent(
  pane: PaneRuntimeState,
  event: TimelineEvent | null,
): PaneRuntimeState {
  if (!event) return pane;
  const index = pane.events.findIndex((candidate) => candidate.id === event.id);
  if (index < 0) return { ...pane, events: appendEvent(pane.events, event) };
  const events = pane.events.slice();
  events[index] = event;
  return { ...pane, events };
}

function appendEvent(
  events: TimelineEvent[],
  event: TimelineEvent,
): TimelineEvent[] {
  return [...events, event].slice(-MAX_EVENTS);
}

export function eventFromItem(item: JsonObject): TimelineEvent | null {
  const id = typeof item.id === "string" ? item.id : `item-${Date.now()}`;
  const type = textValue(item.type);
  switch (type) {
    case "userMessage":
      return {
        id,
        kind: "user",
        title: "You",
        detail: userMessageText(item),
        time: nowLabel(),
      };
    case "agentMessage":
      return {
        id,
        kind: "assistant",
        title: item.phase === "commentary" ? "Codex update" : "Codex",
        detail: textValue(item.text),
        time: nowLabel(),
      };
    case "commandExecution":
      return {
        id,
        kind: "tool",
        title: "Command",
        detail: truncate(
          [textValue(item.command), textValue(item.aggregatedOutput)]
            .filter(Boolean)
            .join("\n\n"),
        ),
        time: nowLabel(),
      };
    case "fileChange":
      return {
        id,
        kind: "file",
        title: "File changes",
        detail: fileChangesText(item),
        time: nowLabel(),
      };
    case "plan":
      return {
        id,
        kind: "progress",
        title: "Plan",
        detail: textValue(item.text),
        time: nowLabel(),
      };
    case "reasoning":
      return {
        id,
        kind: "progress",
        title: "Reasoning summary",
        detail: summaryText(item.summary),
        time: nowLabel(),
      };
    case "mcpToolCall":
      return {
        id,
        kind: "tool",
        title: `${textValue(item.server)} / ${textValue(item.tool)}`.trim(),
        detail: jsonPreview(item.arguments),
        time: nowLabel(),
      };
    case "webSearch":
      return {
        id,
        kind: "tool",
        title: "Web search",
        detail: textValue(item.query),
        time: nowLabel(),
      };
    case "contextCompaction":
      return {
        id,
        kind: "progress",
        title: "Context compacted",
        time: nowLabel(),
      };
    case "enteredReviewMode":
      return {
        id,
        kind: "progress",
        title: "Code review started",
        detail: textValue(item.review),
        time: nowLabel(),
      };
    case "exitedReviewMode":
      return {
        id,
        kind: "assistant",
        title: "Code review",
        detail: textValue(item.review),
        time: nowLabel(),
      };
    default:
      return type
        ? { id, kind: "progress", title: humanize(type), time: nowLabel() }
        : null;
  }
}

export function eventsFromThreadRead(result: JsonObject): TimelineEvent[] {
  const thread = isJsonObject(result.thread) ? result.thread : undefined;
  if (!thread || !Array.isArray(thread.turns)) return [];
  const events: TimelineEvent[] = [];
  for (const turn of thread.turns) {
    if (!isJsonObject(turn) || !Array.isArray(turn.items)) continue;
    for (const item of turn.items) {
      if (!isJsonObject(item)) continue;
      const event = eventFromItem(item);
      if (event) events.push(event);
    }
  }
  return events.slice(-MAX_EVENTS);
}

function userMessageText(item: JsonObject): string {
  if (!Array.isArray(item.content)) return "";
  return truncate(
    item.content
      .filter(isJsonObject)
      .map(
        (content) =>
          textValue(content.text) ||
          textValue(content.url) ||
          textValue(content.path),
      )
      .filter(Boolean)
      .join("\n"),
  );
}

function fileChangesText(item: JsonObject): string {
  if (!Array.isArray(item.changes)) return "";
  return truncate(
    item.changes
      .filter(isJsonObject)
      .map((change) => {
        const kind = isJsonObject(change.kind)
          ? textValue(change.kind.type)
          : textValue(change.kind);
        return [
          `${kind || "update"} ${textValue(change.path)}`,
          textValue(change.diff),
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n"),
  );
}

function planText(params: JsonObject): string {
  const explanation = textValue(params.explanation);
  const steps = Array.isArray(params.plan)
    ? params.plan
        .filter(isJsonObject)
        .map((step) => {
          const status = textValue(step.status);
          const mark =
            status === "completed" ? "✓" : status === "inProgress" ? "→" : "·";
          return `${mark} ${textValue(step.step)}`.trim();
        })
        .filter(Boolean)
        .join("\n")
    : "";
  return truncate([explanation, steps].filter(Boolean).join("\n\n"));
}

function summaryText(value: unknown): string {
  if (typeof value === "string") return truncate(value);
  if (Array.isArray(value))
    return truncate(
      value
        .map((part) =>
          typeof part === "string"
            ? part
            : isJsonObject(part)
              ? textValue(part.text)
              : "",
        )
        .filter(Boolean)
        .join("\n"),
    );
  return "";
}

function jsonPreview(value: unknown): string {
  try {
    return truncate(JSON.stringify(value, null, 2));
  } catch {
    return "";
  }
}

function textValue(value: unknown): string {
  if (typeof value === "string") return truncate(value);
  if (Array.isArray(value) && value.every((part) => typeof part === "string"))
    return truncate(value.join(" "));
  return "";
}

function truncate(value: string): string {
  return value.length > MAX_DETAIL_LENGTH
    ? `${value.slice(0, MAX_DETAIL_LENGTH)}\n… output truncated by TamaGrid`
    : value;
}

function eventId(params: JsonObject, prefix: string): string {
  const turnId = typeof params.turnId === "string" ? params.turnId : "global";
  return `${prefix}-${turnId}`;
}

function nowLabel(): string {
  return new Date().toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function isApprovalMethod(method: string): boolean {
  return (
    method === "item/commandExecution/requestApproval" ||
    method === "item/fileChange/requestApproval"
  );
}
