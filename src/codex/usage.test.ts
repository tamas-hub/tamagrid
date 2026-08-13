import { describe, expect, it } from "vitest";
import { usageSummaryFromResponse } from "./usage";

describe("Codex usage summary", () => {
  it("converts used percentage into a remaining percentage", () => {
    const summary = usageSummaryFromResponse({
      rateLimits: {
        limitId: "codex",
        limitName: "Codex",
        primary: {
          usedPercent: 82,
          windowDurationMins: 10_080,
          resetsAt: 1_787_011_245,
        },
      },
    });

    expect(summary?.current).toEqual({
      usedPercent: 82,
      remainingPercent: 18,
      windowDurationMins: 10_080,
      resetsAt: 1_787_011_245,
    });
  });

  it("keeps dynamically named usage buckets", () => {
    const summary = usageSummaryFromResponse({
      rateLimits: {
        limitId: "codex",
        primary: { usedPercent: 20 },
        credits: { balance: "7", hasCredits: true, unlimited: false },
      },
      rateLimitsByLimitId: {
        codex: { limitId: "codex", primary: { usedPercent: 20 } },
        future_pool: {
          limitId: "future_pool",
          limitName: "Future pool",
          primary: { usedPercent: 35 },
        },
      },
    });

    expect(summary?.buckets.map((bucket) => bucket.label)).toEqual([
      "Codex",
      "Future pool",
    ]);
    expect(summary?.buckets[1].primary?.remainingPercent).toBe(65);
    expect(summary?.buckets[0].credits?.balance).toBe("7");
  });

  it("rejects responses without the backward-compatible rateLimits field", () => {
    expect(usageSummaryFromResponse({ rateLimitsByLimitId: {} })).toBeNull();
  });
});
