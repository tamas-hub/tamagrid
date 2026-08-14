import type { AppServerEvent, JsonRpcMessage } from "./types";
import { isJsonObject } from "./types";

export const MAX_PROTOCOL_QUEUE_EVENTS = 1_024;
export const MAX_PROTOCOL_QUEUE_DELTA_BYTES = 1_024 * 1_024;
export const MAX_COALESCED_PROTOCOL_DELTA_BYTES = 128 * 1_024;

const COALESCIBLE_DELTA_METHODS = new Set([
  "item/agentMessage/delta",
  "item/plan/delta",
  "item/reasoning/summaryTextDelta",
  "item/commandExecution/outputDelta",
]);
const utf8Encoder = new TextEncoder();
const deltaByteCache = new WeakMap<AppServerEvent, number>();

export function protocolDeltaBytes(event: AppServerEvent): number {
  const cached = deltaByteCache.get(event);
  if (cached !== undefined) return cached;
  const message = event.message as JsonRpcMessage | undefined;
  const params = isJsonObject(message?.params) ? message.params : undefined;
  const bytes =
    typeof params?.delta === "string"
      ? utf8Encoder.encode(params.delta).byteLength
      : 0;
  deltaByteCache.set(event, bytes);
  return bytes;
}

export function protocolDeltaWouldOverflow(
  currentBytes: number,
  incomingBytes: number,
): boolean {
  return currentBytes + incomingBytes > MAX_PROTOCOL_QUEUE_DELTA_BYTES;
}

export function protocolEventCountWouldOverflow(eventCount: number): boolean {
  return eventCount >= MAX_PROTOCOL_QUEUE_EVENTS;
}

export function tryCoalesceAdjacentProtocolDelta(
  queue: AppServerEvent[],
  incoming: AppServerEvent,
): boolean {
  const incomingMessage = incoming.message as JsonRpcMessage | undefined;
  const method = incomingMessage?.method;
  const params = isJsonObject(incomingMessage?.params)
    ? incomingMessage.params
    : undefined;
  if (
    !method ||
    !params ||
    !COALESCIBLE_DELTA_METHODS.has(method) ||
    typeof params.delta !== "string" ||
    params.delta.length === 0
  )
    return false;

  // Only adjacent deltas are safe to merge. Scanning past a terminal,
  // approval, or error event would move later text ahead of that event.
  const index = queue.length - 1;
  if (index < 0) return false;
  const queuedMessage = queue[index].message as JsonRpcMessage | undefined;
  if (queuedMessage?.method !== method) return false;
  const queuedParams = isJsonObject(queuedMessage.params)
    ? queuedMessage.params
    : undefined;
  if (
    !queuedParams ||
    queuedParams.threadId !== params.threadId ||
    queuedParams.turnId !== params.turnId ||
    queuedParams.itemId !== params.itemId ||
    typeof queuedParams.delta !== "string"
  )
    return false;

  const combinedBytes =
    protocolDeltaBytes(queue[index]) + protocolDeltaBytes(incoming);
  if (combinedBytes > MAX_COALESCED_PROTOCOL_DELTA_BYTES) return false;

  const combinedEvent: AppServerEvent = {
    ...queue[index],
    message: {
      ...queuedMessage,
      params: {
        ...queuedParams,
        delta: `${queuedParams.delta}${params.delta}`,
      },
    },
  };
  deltaByteCache.set(combinedEvent, combinedBytes);
  queue[index] = combinedEvent;
  return true;
}
