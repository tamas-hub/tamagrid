import { afterEach, describe, expect, it, vi } from "vitest";
import { PreviewCodexBridge } from "./bridge";
import type { AppServerEvent } from "./types";

afterEach(() => vi.useRealTimers());

describe("Preview App Server integration", () => {
  it("lists and expands stored threads without resuming them", async () => {
    const bridge = new PreviewCodexBridge();
    await bridge.connect(() => undefined);
    const list = (await bridge.request("thread/list", {
      limit: 25,
    })) as { data: Array<{ id: string }>; nextCursor: string | null };

    expect(list.data.length).toBeGreaterThanOrEqual(3);
    const detail = (await bridge.request("thread/read", {
      threadId: list.data[0].id,
      includeTurns: true,
    })) as { thread: { id: string; turns: unknown[] } };
    expect(detail.thread.id).toBe(list.data[0].id);
    expect(detail.thread.turns).not.toHaveLength(0);
  });

  it("streams two independent turns through one multiplexed connection", async () => {
    vi.useFakeTimers();
    const bridge = new PreviewCodexBridge();
    const events: AppServerEvent[] = [];
    await bridge.connect((event) => events.push(event));
    const left = (await bridge.request("thread/start", {})) as {
      thread: { id: string };
    };
    const right = (await bridge.request("thread/start", {})) as {
      thread: { id: string };
    };

    await Promise.all([
      bridge.request("turn/start", {
        threadId: left.thread.id,
        input: [{ type: "text", text: "left" }],
      }),
      bridge.request("turn/start", {
        threadId: right.thread.id,
        input: [{ type: "text", text: "right" }],
      }),
    ]);
    await vi.runAllTimersAsync();

    const messages = events.flatMap((event) =>
      event.message ? [event.message] : [],
    );
    expect(
      messages.some(
        (message) =>
          message.method === "turn/completed" &&
          (message.params as { threadId?: string }).threadId === left.thread.id,
      ),
    ).toBe(true);
    expect(
      messages.some(
        (message) =>
          message.method === "turn/completed" &&
          (message.params as { threadId?: string }).threadId ===
            right.thread.id,
      ),
    ).toBe(true);
  });

  it("waits for an explicit approval decision", async () => {
    vi.useFakeTimers();
    const bridge = new PreviewCodexBridge();
    const events: AppServerEvent[] = [];
    await bridge.connect((event) => events.push(event));
    const thread = (await bridge.request("thread/start", {})) as {
      thread: { id: string };
    };
    await bridge.request("turn/start", {
      threadId: thread.thread.id,
      input: [{ type: "text", text: "承認を確認" }],
    });
    await vi.advanceTimersByTimeAsync(250);
    const approval = events.find(
      (event) =>
        event.message?.method === "item/commandExecution/requestApproval",
    )?.message;

    expect(approval?.id).toEqual(expect.any(Number));
    expect(
      events.some((event) => event.message?.method === "turn/completed"),
    ).toBe(false);
    await bridge.approve(approval?.id as number, "decline");
    await vi.runAllTimersAsync();
    expect(
      events.some((event) => event.message?.method === "turn/completed"),
    ).toBe(true);
  });

  it("names a restored preview thread after its first new turn", async () => {
    vi.useFakeTimers();
    const bridge = new PreviewCodexBridge();
    const events: AppServerEvent[] = [];
    await bridge.connect((event) => events.push(event));
    await bridge.request("thread/resume", { threadId: "restored-preview" });

    await bridge.request("turn/start", {
      threadId: "restored-preview",
      input: [{ type: "text", text: "Restored chat title" }],
    });
    await vi.advanceTimersByTimeAsync(100);

    expect(
      events.some(
        (event) =>
          event.message?.method === "thread/name/updated" &&
          JSON.stringify(event.message).includes("Restored chat title"),
      ),
    ).toBe(true);
  });

  it("renames a thread and emits the stable name update", async () => {
    const bridge = new PreviewCodexBridge();
    const events: AppServerEvent[] = [];
    await bridge.connect((event) => events.push(event));
    const thread = (await bridge.request("thread/start", {})) as {
      thread: { id: string };
    };

    await bridge.request("thread/name/set", {
      threadId: thread.thread.id,
      name: "Edited from TamaGrid",
    });

    expect(
      events.some(
        (event) =>
          event.message?.method === "thread/name/updated" &&
          JSON.stringify(event.message).includes("Edited from TamaGrid"),
      ),
    ).toBe(true);
  });

  it("accepts same-turn steering with the exact active turn id", async () => {
    vi.useFakeTimers();
    const bridge = new PreviewCodexBridge();
    const events: AppServerEvent[] = [];
    await bridge.connect((event) => events.push(event));
    const thread = (await bridge.request("thread/start", {})) as {
      thread: { id: string };
    };
    const started = (await bridge.request("turn/start", {
      threadId: thread.thread.id,
      input: [{ type: "text", text: "slow task" }],
    })) as { turn: { id: string } };
    await vi.advanceTimersByTimeAsync(100);

    expect(
      events.some(
        (event) =>
          event.message?.method === "thread/name/updated" &&
          JSON.stringify(event.message).includes("slow task"),
      ),
    ).toBe(true);

    const steered = (await bridge.request("turn/steer", {
      threadId: thread.thread.id,
      expectedTurnId: started.turn.id,
      input: [{ type: "text", text: "focus on tests" }],
    })) as { turnId: string };
    expect(steered.turnId).toBe(started.turn.id);
    expect(
      events.some(
        (event) =>
          event.message?.method === "item/completed" &&
          JSON.stringify(event.message).includes("focus on tests"),
      ),
    ).toBe(true);
  });

  it("streams the standard inline code review lifecycle", async () => {
    vi.useFakeTimers();
    const bridge = new PreviewCodexBridge();
    const events: AppServerEvent[] = [];
    await bridge.connect((event) => events.push(event));
    const thread = (await bridge.request("thread/start", {})) as {
      thread: { id: string };
    };
    const review = (await bridge.request("review/start", {
      threadId: thread.thread.id,
      delivery: "inline",
      target: { type: "uncommittedChanges" },
    })) as { reviewThreadId: string; turn: { id: string } };
    await vi.runAllTimersAsync();

    expect(review.reviewThreadId).toBe(thread.thread.id);
    const itemTypes = events.flatMap((event) => {
      const params = event.message?.params as
        { item?: { type?: string } } | undefined;
      return params?.item?.type ? [params.item.type] : [];
    });
    expect(itemTypes).toContain("enteredReviewMode");
    expect(itemTypes).toContain("exitedReviewMode");
    expect(
      events.some((event) => event.message?.method === "turn/completed"),
    ).toBe(true);
  });
});
