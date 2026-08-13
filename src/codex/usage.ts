import { isJsonObject, type JsonObject } from "./types";

export interface CodexUsageWindow {
  usedPercent: number;
  remainingPercent: number;
  windowDurationMins?: number;
  resetsAt?: number;
}

export interface CodexUsageCredits {
  balance?: string;
  hasCredits: boolean;
  unlimited: boolean;
}

export interface CodexIndividualLimit {
  limit: string;
  used: string;
  remainingPercent: number;
  resetsAt: number;
}

export interface CodexUsageBucket {
  id: string;
  label: string;
  primary?: CodexUsageWindow;
  secondary?: CodexUsageWindow;
  credits?: CodexUsageCredits;
  individualLimit?: CodexIndividualLimit;
  planType?: string;
  spendControlReached?: boolean;
}

export interface CodexUsageSummary {
  current?: CodexUsageWindow;
  currentLabel: string;
  buckets: CodexUsageBucket[];
  resetCredits?: number;
}

type ParsedSnapshot = CodexUsageBucket;

export function usageSummaryFromResponse(
  value: unknown,
): CodexUsageSummary | null {
  if (!isJsonObject(value) || !isJsonObject(value.rateLimits)) return null;

  const legacy = parseSnapshot(value.rateLimits, "codex");
  const buckets: ParsedSnapshot[] = [];
  if (isJsonObject(value.rateLimitsByLimitId)) {
    for (const [id, snapshot] of Object.entries(value.rateLimitsByLimitId)) {
      if (isJsonObject(snapshot)) buckets.push(parseSnapshot(snapshot, id));
    }
  }

  if (buckets.length === 0) {
    buckets.push(legacy);
  } else {
    const legacyIndex = buckets.findIndex((bucket) => bucket.id === legacy.id);
    if (legacyIndex < 0) {
      buckets.unshift(legacy);
    } else {
      const bucket = buckets[legacyIndex];
      buckets[legacyIndex] = {
        ...legacy,
        ...bucket,
        primary: bucket.primary ?? legacy.primary,
        secondary: bucket.secondary ?? legacy.secondary,
        credits: bucket.credits ?? legacy.credits,
        individualLimit: bucket.individualLimit ?? legacy.individualLimit,
        planType: bucket.planType ?? legacy.planType,
        spendControlReached:
          bucket.spendControlReached ?? legacy.spendControlReached,
      };
    }
  }

  const resetCredits = isJsonObject(value.rateLimitResetCredits)
    ? finiteNumber(value.rateLimitResetCredits.availableCount)
    : undefined;
  const current =
    legacy.primary ?? buckets.find((bucket) => bucket.primary)?.primary;
  const currentBucket = legacy.primary
    ? legacy
    : (buckets.find((bucket) => bucket.primary) ?? legacy);

  return {
    current,
    currentLabel: currentBucket.label,
    buckets,
    resetCredits,
  };
}

function parseSnapshot(value: JsonObject, fallbackId: string): ParsedSnapshot {
  const id = stringValue(value.limitId) ?? fallbackId;
  const primary = parseWindow(value.primary);
  const secondary = parseWindow(value.secondary);
  return {
    id,
    label: stringValue(value.limitName) ?? humanizeLimitId(id),
    primary,
    secondary,
    credits: parseCredits(value.credits),
    individualLimit: parseIndividualLimit(value.individualLimit),
    planType: stringValue(value.planType),
    spendControlReached:
      typeof value.spendControlReached === "boolean"
        ? value.spendControlReached
        : undefined,
  };
}

function parseWindow(value: unknown): CodexUsageWindow | undefined {
  if (!isJsonObject(value)) return undefined;
  const usedPercent = finiteNumber(value.usedPercent);
  if (usedPercent === undefined) return undefined;
  const normalizedUsed = clamp(usedPercent, 0, 100);
  return {
    usedPercent: normalizedUsed,
    remainingPercent: clamp(100 - normalizedUsed, 0, 100),
    windowDurationMins: positiveNumber(value.windowDurationMins),
    resetsAt: positiveNumber(value.resetsAt),
  };
}

function parseCredits(value: unknown): CodexUsageCredits | undefined {
  if (!isJsonObject(value)) return undefined;
  if (
    typeof value.hasCredits !== "boolean" ||
    typeof value.unlimited !== "boolean"
  ) {
    return undefined;
  }
  return {
    balance: stringValue(value.balance),
    hasCredits: value.hasCredits,
    unlimited: value.unlimited,
  };
}

function parseIndividualLimit(
  value: unknown,
): CodexIndividualLimit | undefined {
  if (!isJsonObject(value)) return undefined;
  const limit = stringValue(value.limit);
  const used = stringValue(value.used);
  const remainingPercent = finiteNumber(value.remainingPercent);
  const resetsAt = positiveNumber(value.resetsAt);
  if (
    limit === undefined ||
    used === undefined ||
    remainingPercent === undefined ||
    resetsAt === undefined
  ) {
    return undefined;
  }
  return {
    limit,
    used,
    remainingPercent: clamp(remainingPercent, 0, 100),
    resetsAt,
  };
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function positiveNumber(value: unknown): number | undefined {
  const number = finiteNumber(value);
  return number !== undefined && number > 0 ? number : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function humanizeLimitId(id: string): string {
  return (
    id
      .replace(/^codex[_-]?/i, "Codex ")
      .replace(/[_-]+/g, " ")
      .trim() || "Codex"
  );
}
