import { describe, expect, it } from "vitest";
import type { JsonRpcMessage } from "../codex";
import { applyProtocolMessage } from "./protocol";
import { createDefaultPanes } from "./workspace";

function apply(message: JsonRpcMessage) {
  const panes = createDefaultPanes();
  panes[0] = { ...panes[0], threadId: "thread-a", loaded: true };
  panes[1] = { ...panes[1], threadId: "thread-b", loaded: true };
  return applyProtocolMessage(panes, message);
}

describe("App Server protocol routing", () => {
  it("routes an approval only to its thread and preserves the exact request id type", () => {
    const panes = apply({
      id: 42,
      method: "item/commandExecution/requestApproval",
      params: {
        threadId: "thread-b",
        turnId: "turn-b",
        itemId: "command-b",
        command: "pnpm test",
        cwd: "C:\\workspace\\tamagrid",
        reason: "Run the test suite before release",
        networkApprovalContext: { protocol: "https", host: "example.com" },
        commandActions: [{ type: "read", path: "package.json" }],
      },
    });

    expect(panes[0].approval).toBeUndefined();
    expect(panes[1].status).toBe("Approval");
    expect(panes[1].approval?.requestId).toBe(42);
    expect(panes[1].approval?.key).toBe("n:42");
    expect(panes[1].approval).toMatchObject({
      command: "pnpm test",
      cwd: "C:\\workspace\\tamagrid",
      reason: "Run the test suite before release",
      network: "https://example.com",
      itemId: "command-b",
    });
    expect(panes[1].approval?.actions).toContain("package.json");
  });

  it("keeps interleaved deltas isolated by thread and item", () => {
    let panes = apply({
      method: "turn/started",
      params: { threadId: "thread-a", turn: { id: "turn-a" } },
    });
    panes = applyProtocolMessage(panes, {
      method: "item/agentMessage/delta",
      params: {
        threadId: "thread-a",
        turnId: "turn-a",
        itemId: "item-a",
        delta: "left",
      },
    });
    panes = applyProtocolMessage(panes, {
      method: "item/agentMessage/delta",
      params: {
        threadId: "thread-b",
        turnId: "turn-b",
        itemId: "item-b",
        delta: "right",
      },
    });

    expect(panes[0].events.find((event) => event.id === "item-a")?.detail).toBe(
      "left",
    );
    expect(
      panes[0].events.find((event) => event.id === "item-b"),
    ).toBeUndefined();
    expect(panes[1].events.find((event) => event.id === "item-b")?.detail).toBe(
      "right",
    );
  });

  it("uses turn/completed as the terminal status", () => {
    const panes = apply({
      method: "turn/completed",
      params: {
        threadId: "thread-a",
        turn: {
          id: "turn-a",
          status: "failed",
          error: { message: "rate limited" },
        },
      },
    });
    expect(panes[0].status).toBe("Error");
    expect(panes[0].error).toBe("rate limited");
  });

  it("shows a retrying error without declaring the turn terminal", () => {
    const panes = apply({
      method: "error",
      params: {
        threadId: "thread-a",
        turnId: "turn-a",
        willRetry: true,
        error: { message: "temporary" },
      },
    });
    expect(panes[0].status).toBe("Idle");
    expect(panes[0].events[panes[0].events.length - 1]?.title).toContain(
      "retrying",
    );
  });

  it("renders the standard reviewer result as an assistant event", () => {
    const panes = apply({
      method: "item/completed",
      params: {
        threadId: "thread-a",
        turnId: "review-a",
        item: {
          id: "review-result",
          type: "exitedReviewMode",
          review: "No blocking findings.",
        },
      },
    });
    expect(panes[0].events[0]).toMatchObject({
      kind: "assistant",
      title: "Code review",
      detail: "No blocking findings.",
    });
  });

  it("uses Codex thread name updates as the pane title", () => {
    const panes = apply({
      method: "thread/name/updated",
      params: {
        threadId: "thread-a",
        threadName: "Windows installer verification",
      },
    });
    expect(panes[0].title).toBe("Windows installer verification");
    expect(panes[1].title).toBe("");
  });
});
