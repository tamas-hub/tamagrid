import { describe, expect, it } from "vitest";
import { CodexAdapter } from "./adapter";
import type { CodexBridge } from "./bridge";

describe("CodexAdapter thread lifecycle", () => {
  it("serializes thread resumes so four panes do not overload App Server", async () => {
    const calls: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const bridge: CodexBridge = {
      mode: "preview",
      detect: async () => Promise.reject(new Error("unused")),
      chooseExecutable: async () => Promise.reject(new Error("unused")),
      useAutoDetect: async () => Promise.reject(new Error("unused")),
      connect: async () => Promise.reject(new Error("unused")),
      disconnect: async () => undefined,
      approve: async () => undefined,
      request: async (method, params) => {
        if (method !== "thread/resume") throw new Error(`unexpected ${method}`);
        const threadId = String(params.threadId);
        calls.push(threadId);
        if (threadId === "thread-one") await firstGate;
        return { thread: { id: threadId } };
      },
    };
    const adapter = new CodexAdapter(bridge);

    const first = adapter.resumeThread("thread-one", {});
    const second = adapter.resumeThread("thread-two", {});
    await Promise.resolve();
    expect(calls).toEqual(["thread-one"]);

    releaseFirst();
    await first;
    await second;
    expect(calls).toEqual(["thread-one", "thread-two"]);
  });
});
