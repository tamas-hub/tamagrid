import { Channel, invoke } from "@tauri-apps/api/core";
import type { CodexBridge } from "./bridge";
import type {
  AppServerEvent,
  ConnectionInfo,
  DetectionResult,
  JsonObject,
  JsonRpcId,
} from "./types";

export const PACKAGED_SOAK_ITEM_ID = "tamagrid-packaged-soak-item";

const PACKAGED_SOAK_BUILD = import.meta.env.VITE_TAMAGRID_SOAK === "1";
const DEFAULT_SOAK_DURATION_MS = 180_000;
const COMPLETION_GRACE_MS = 45_000;
const textEncoder = new TextEncoder();

const SOAK_MODEL = {
  id: "tamagrid-packaged-soak",
  model: "tamagrid-packaged-soak",
  displayName: "Packaged soak fixture",
  description: "Local deterministic Tauri Channel fixture",
  hidden: false,
  isDefault: true,
  defaultReasoningEffort: "standard",
  supportedReasoningEfforts: [
    { reasoningEffort: "standard", description: "Packaged soak fixture" },
  ],
  serviceTiers: [],
  supportsPersonality: false,
};

const SOAK_RATE_LIMITS = {
  rateLimits: {
    limitId: "packaged-soak",
    limitName: "Packaged soak fixture",
    primary: { usedPercent: 0, windowDurationMins: 60 },
    credits: { balance: "0", hasCredits: false, unlimited: false },
    planType: "local-test",
  },
  rateLimitsByLimitId: {},
  rateLimitResetCredits: { availableCount: 0 },
};

export interface PackagedSoakDescriptor {
  durationMs: number;
  deltaEvents: number;
  deltaBytesPerEvent: number;
  expectedDeltaBytes: number;
  expectedLastSequence: number;
  threadId: string;
  turnId: string;
  itemId: string;
}

export interface PackagedSoakChannelResult {
  descriptor: PackagedSoakDescriptor;
  receivedDeltaEvents: number;
  receivedDeltaBytes: number;
  lastSequence: number;
  sequenceGaps: number;
  elapsedMs: number;
}

interface PackagedSoakTracker {
  descriptor?: PackagedSoakDescriptor;
  receivedDeltaEvents: number;
  receivedDeltaBytes: number;
  lastSequence: number;
  sequenceGaps: number;
  startedAt: number;
  settled: boolean;
  completion: Promise<PackagedSoakChannelResult>;
  resolve: (result: PackagedSoakChannelResult) => void;
  reject: (error: Error) => void;
}

export interface PackagedSoakFrameStats {
  frames: number;
  maxFrameGapMs: number;
}

export interface PackagedSoakFrameMonitor {
  snapshot(): PackagedSoakFrameStats;
  stop(): PackagedSoakFrameStats;
}

let tracker: PackagedSoakTracker | undefined;

export function isPackagedSoakBuild(): boolean {
  return PACKAGED_SOAK_BUILD;
}

export class PackagedSoakCodexBridge implements CodexBridge {
  readonly mode = "tauri" as const;
  private onEvent: (event: AppServerEvent) => void = () => undefined;
  private channel?: Channel<AppServerEvent>;

  detect(): Promise<DetectionResult> {
    return Promise.resolve({
      executablePath: "Packaged soak fixture (no Codex process)",
      version: "packaged-soak-test",
    });
  }

  chooseExecutable(): Promise<DetectionResult> {
    return this.detect();
  }

  useAutoDetect(): Promise<DetectionResult> {
    return this.detect();
  }

  async connect(
    onEvent: (event: AppServerEvent) => void,
  ): Promise<ConnectionInfo> {
    tracker = createTracker();
    this.onEvent = onEvent;
    this.channel = new Channel<AppServerEvent>();
    this.channel.onmessage = (event) => this.receive(event);
    return {
      generation: 1,
      executablePath: "Packaged soak fixture (no Codex process)",
      version: "packaged-soak-test",
      account: {
        account: { type: "packagedSoak" },
        requiresOpenaiAuth: false,
      },
      models: [SOAK_MODEL],
      rateLimits: SOAK_RATE_LIMITS,
    };
  }

  disconnect(): Promise<void> {
    return Promise.resolve();
  }

  async request(method: string, params: JsonObject): Promise<unknown> {
    switch (method) {
      case "account/read":
        return {
          account: { type: "packagedSoak" },
          requiresOpenaiAuth: false,
        };
      case "account/rateLimits/read":
        return SOAK_RATE_LIMITS;
      case "model/list":
        return { data: [SOAK_MODEL], nextCursor: null };
      case "thread/list":
        return { data: [], nextCursor: null, backwardsCursor: null };
      case "thread/start":
      case "thread/resume": {
        const threadId =
          typeof params.threadId === "string"
            ? params.threadId
            : "tamagrid-packaged-soak-thread";
        return {
          thread: {
            id: threadId,
            sessionId: threadId,
            name: "Packaged WebView soak",
            turns: [],
          },
          model: SOAK_MODEL.id,
          modelProvider: "local-test",
          cwd: "",
          sandbox: "read-only",
          approvalPolicy: "never",
        };
      }
      case "thread/read":
        return {
          thread: {
            id: String(params.threadId ?? "tamagrid-packaged-soak-thread"),
            name: "Packaged WebView soak",
            turns: [],
          },
        };
      case "thread/name/set":
      case "turn/interrupt":
        return {};
      case "turn/start":
        return this.startSoakTurn(params);
      default:
        throw new Error(`Packaged soak fixture does not implement ${method}`);
    }
  }

  approve(requestId: JsonRpcId, decision: "accept" | "decline"): Promise<void> {
    void requestId;
    void decision;
    return Promise.reject(
      new Error("The packaged soak fixture does not request approval"),
    );
  }

  private async startSoakTurn(params: JsonObject): Promise<JsonObject> {
    if (!tracker || !this.channel)
      throw new Error("The packaged soak channel is not connected");
    tracker.startedAt = performance.now();
    const result = await invoke<JsonObject>("run_protocol_soak", {
      onEvent: this.channel,
      params: {
        threadId: String(params.threadId ?? "tamagrid-packaged-soak-thread"),
        durationMs: packagedSoakDurationMs(),
      },
    });
    tracker.descriptor = parseDescriptor(result.soak);
    return result;
  }

  private receive(event: AppServerEvent): void {
    const current = tracker;
    if (!current || current.settled) return;
    const expectedSequence = current.lastSequence + 1;
    if (event.sequence !== expectedSequence) current.sequenceGaps += 1;
    current.lastSequence = event.sequence;

    const message = isRecord(event.message) ? event.message : undefined;
    const params = isRecord(message?.params) ? message.params : undefined;
    if (
      message?.method === "item/agentMessage/delta" &&
      typeof params?.delta === "string"
    ) {
      current.receivedDeltaEvents += 1;
      current.receivedDeltaBytes += textEncoder.encode(params.delta).byteLength;
    }

    try {
      this.onEvent(event);
    } catch (error) {
      current.settled = true;
      current.reject(
        error instanceof Error
          ? error
          : new Error("Renderer event callback failed"),
      );
      return;
    }

    if (event.eventType === "soakComplete") {
      if (!current.descriptor) {
        current.settled = true;
        current.reject(
          new Error(
            "The packaged soak completed before its descriptor arrived",
          ),
        );
        return;
      }
      current.settled = true;
      current.resolve({
        descriptor: current.descriptor,
        receivedDeltaEvents: current.receivedDeltaEvents,
        receivedDeltaBytes: current.receivedDeltaBytes,
        lastSequence: current.lastSequence,
        sequenceGaps: current.sequenceGaps,
        elapsedMs: performance.now() - current.startedAt,
      });
    }
  }
}

export async function waitForPackagedSoakCompletion(): Promise<PackagedSoakChannelResult> {
  if (!PACKAGED_SOAK_BUILD || !tracker)
    throw new Error("The packaged soak tracker is not active");
  const timeoutMs = packagedSoakDurationMs() + COMPLETION_GRACE_MS;
  return Promise.race([
    tracker.completion,
    new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error("The packaged soak stream timed out")),
        timeoutMs,
      );
    }),
  ]);
}

export async function submitPackagedSoakReport(
  report: JsonObject,
): Promise<void> {
  if (!PACKAGED_SOAK_BUILD)
    throw new Error("Packaged soak reporting is disabled in this build");
  await invoke("complete_protocol_soak", { report });
}

export function startPackagedSoakFrameMonitor(): PackagedSoakFrameMonitor {
  let active = true;
  let frameId = 0;
  let frames = 0;
  let last = performance.now();
  let maxFrameGapMs = 0;
  const tick = (now: number) => {
    if (!active) return;
    frames += 1;
    maxFrameGapMs = Math.max(maxFrameGapMs, now - last);
    last = now;
    frameId = window.requestAnimationFrame(tick);
  };
  frameId = window.requestAnimationFrame(tick);
  const snapshot = () => ({ frames, maxFrameGapMs });
  return {
    snapshot,
    stop() {
      if (active) {
        active = false;
        window.cancelAnimationFrame(frameId);
      }
      return snapshot();
    },
  };
}

function createTracker(): PackagedSoakTracker {
  let resolve!: (result: PackagedSoakChannelResult) => void;
  let reject!: (error: Error) => void;
  const completion = new Promise<PackagedSoakChannelResult>(
    (resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    },
  );
  return {
    receivedDeltaEvents: 0,
    receivedDeltaBytes: 0,
    lastSequence: 0,
    sequenceGaps: 0,
    startedAt: performance.now(),
    settled: false,
    completion,
    resolve,
    reject,
  };
}

function packagedSoakDurationMs(): number {
  const configured = Number(
    import.meta.env.VITE_TAMAGRID_SOAK_DURATION_MS ?? DEFAULT_SOAK_DURATION_MS,
  );
  return Number.isSafeInteger(configured)
    ? configured
    : DEFAULT_SOAK_DURATION_MS;
}

function parseDescriptor(value: unknown): PackagedSoakDescriptor {
  if (!isRecord(value))
    throw new Error("The packaged soak descriptor is missing");
  const numericFields = [
    "durationMs",
    "deltaEvents",
    "deltaBytesPerEvent",
    "expectedDeltaBytes",
    "expectedLastSequence",
  ] as const;
  for (const field of numericFields) {
    if (!Number.isSafeInteger(value[field]) || Number(value[field]) <= 0)
      throw new Error(`The packaged soak descriptor has an invalid ${field}`);
  }
  for (const field of ["threadId", "turnId", "itemId"] as const) {
    if (typeof value[field] !== "string" || value[field].length === 0)
      throw new Error(`The packaged soak descriptor has an invalid ${field}`);
  }
  return value as unknown as PackagedSoakDescriptor;
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
