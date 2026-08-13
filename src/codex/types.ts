export type JsonRpcId = string | number;
export type JsonObject = Record<string, unknown>;

export interface ReasoningEffortOption {
  reasoningEffort: string;
  description: string;
}

export interface ModelServiceTier {
  id: string;
  name: string;
  description: string;
}

export interface CodexModel {
  id: string;
  model: string;
  displayName: string;
  description: string;
  hidden: boolean;
  isDefault: boolean;
  defaultReasoningEffort: string;
  supportedReasoningEfforts: ReasoningEffortOption[];
  inputModalities?: string[];
  supportsPersonality?: boolean;
  defaultServiceTier?: string | null;
  serviceTiers?: ModelServiceTier[];
}

export interface CodexThreadSummary {
  id: string;
  name?: string | null;
  preview: string;
  cwd: string;
  createdAt: number;
  updatedAt: number;
  modelProvider: string;
  status?: string;
  source?: string;
}

export interface DetectionResult {
  executablePath: string;
  version: string;
}

export interface ConnectionInfo extends DetectionResult {
  generation: number;
  initialize: JsonObject;
  account: JsonObject;
  models: unknown[];
  rateLimits?: unknown;
}

export interface AppServerEvent {
  generation: number;
  sequence: number;
  eventType:
    | "message"
    | "stderr"
    | "malformedJson"
    | "malformedJsonRpc"
    | "unknownResponse"
    | "unsupportedServerRequest"
    | "transportError"
    | "disconnected"
    | "exited"
    | string;
  message?: JsonObject;
  detail?: string;
  exitCode?: number | null;
}

export interface JsonRpcMessage extends JsonObject {
  id?: JsonRpcId;
  method?: string;
  params?: JsonObject;
  result?: unknown;
  error?: JsonObject;
}

export interface ThreadStartResult extends JsonObject {
  thread: JsonObject & { id: string };
}

export interface TurnStartResult extends JsonObject {
  turn: JsonObject & { id: string; status?: string };
}

export type CodexReviewTarget =
  | { type: "uncommittedChanges" }
  | { type: "baseBranch"; branch: string }
  | { type: "commit"; sha: string; title?: string }
  | { type: "custom"; instructions: string };

export interface ReviewStartResult extends JsonObject {
  reviewThreadId: string;
  turn: JsonObject & { id: string; status?: string };
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isCodexModel(value: unknown): value is CodexModel {
  if (!isJsonObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.model === "string" &&
    typeof value.displayName === "string" &&
    typeof value.defaultReasoningEffort === "string" &&
    Array.isArray(value.supportedReasoningEfforts)
  );
}

export function rpcIdKey(id: JsonRpcId): string {
  return `${typeof id === "number" ? "n" : "s"}:${id}`;
}
