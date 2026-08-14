import { describe, expect, it } from "vitest";
import type { AppServerEvent, JsonObject } from "./types";
import {
  MAX_COALESCED_PROTOCOL_DELTA_BYTES,
  MAX_PROTOCOL_QUEUE_DELTA_BYTES,
  MAX_PROTOCOL_QUEUE_EVENTS,
  protocolDeltaBytes,
  protocolDeltaWouldOverflow,
  protocolEventCountWouldOverflow,
  tryCoalesceAdjacentProtocolDelta,
} from "./protocolQueue";

function event(
  sequence: number,
  method: string,
  params: JsonObject,
): AppServerEvent {
  return {
    generation: 1,
    sequence,
    eventType: "message",
    message: { method, params },
  };
}

function deltaEvent(sequence: number, itemId: string, delta: string) {
  return event(sequence, "item/agentMessage/delta", {
    threadId: "thread-1",
    turnId: "turn-1",
    itemId,
    delta,
  });
}

describe("renderer protocol queue bounds", () => {
  it("does not coalesce across terminal events", () => {
    const queue = [
      deltaEvent(1, "item-1", "before"),
      event(2, "item/completed", {
        threadId: "thread-1",
        turnId: "turn-1",
        item: { id: "item-1", type: "agentMessage" },
      }),
    ];

    expect(
      tryCoalesceAdjacentProtocolDelta(queue, deltaEvent(3, "item-1", "after")),
    ).toBe(false);
    queue.push(deltaEvent(3, "item-1", "after"));
    expect(queue.map((entry) => entry.message?.method)).toEqual([
      "item/agentMessage/delta",
      "item/completed",
      "item/agentMessage/delta",
    ]);
  });

  it("keeps a 100,000-delta flood bounded without losing payload", () => {
    const queue: AppServerEvent[] = [];
    let queuedDeltaBytes = 0;
    let deliveredDeltaBytes = 0;
    let maxQueueLength = 0;
    let maxQueuedDeltaBytes = 0;
    let maxCoalescedDeltaBytes = 0;
    let flushes = 0;

    const flush = () => {
      for (const queued of queue) {
        const bytes = protocolDeltaBytes(queued);
        deliveredDeltaBytes += bytes;
        maxCoalescedDeltaBytes = Math.max(maxCoalescedDeltaBytes, bytes);
      }
      queue.splice(0);
      queuedDeltaBytes = 0;
      flushes += 1;
    };

    let inputDeltaBytes = 0;
    for (let index = 0; index < 100_000; index += 1) {
      const incoming = deltaEvent(index + 1, "item-1", "delta-0123456789");
      const incomingBytes = protocolDeltaBytes(incoming);
      inputDeltaBytes += incomingBytes;

      if (protocolDeltaWouldOverflow(queuedDeltaBytes, incomingBytes)) flush();
      if (!tryCoalesceAdjacentProtocolDelta(queue, incoming)) {
        if (protocolEventCountWouldOverflow(queue.length)) flush();
        queue.push(incoming);
      }
      queuedDeltaBytes += incomingBytes;
      maxQueueLength = Math.max(maxQueueLength, queue.length);
      maxQueuedDeltaBytes = Math.max(maxQueuedDeltaBytes, queuedDeltaBytes);
    }
    flush();

    expect(deliveredDeltaBytes).toBe(inputDeltaBytes);
    expect(maxQueueLength).toBeLessThanOrEqual(MAX_PROTOCOL_QUEUE_EVENTS);
    expect(maxQueuedDeltaBytes).toBeLessThanOrEqual(
      MAX_PROTOCOL_QUEUE_DELTA_BYTES,
    );
    expect(maxCoalescedDeltaBytes).toBeLessThanOrEqual(
      MAX_COALESCED_PROTOCOL_DELTA_BYTES,
    );
    expect(flushes).toBeGreaterThan(1);
  });
});
