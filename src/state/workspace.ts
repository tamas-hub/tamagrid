import type {
  AgentPaneData,
  AppLanguage,
  AppTheme,
  ApprovalPolicy,
  CodexPersonality,
  ComposerSendMode,
  PaneLayout,
  ReasoningSummary,
  SandboxMode,
  TimelineEvent,
} from "../components/types";
import type { CodexModel, JsonRpcId } from "../codex";
import { isJsonObject } from "../codex";

export interface PendingApproval {
  key: string;
  requestId: JsonRpcId;
  method: string;
  message: string;
  kind: "command" | "file";
  reason?: string;
  command?: string;
  cwd?: string;
  network?: string;
  actions?: string;
  policyChange?: string;
  changes?: string;
  itemId?: string;
  canApprove: boolean;
}

export interface PaneRuntimeState extends Omit<AgentPaneData, "approval"> {
  threadId?: string;
  loaded?: boolean;
  activeTurnId?: string;
  activeTurnKind?: "task" | "review";
  approval?: PendingApproval;
}

export interface PersistedWorkspace {
  version: 7;
  selectedPaneId: string;
  fontScale: number;
  layout: PaneLayout;
  theme: AppTheme;
  language: AppLanguage;
  sendMode: ComposerSendMode;
  panes: Array<{
    id: string;
    title: string;
    workingDirectory: string;
    sessionActive?: boolean;
    threadId?: string;
    model?: string;
    reasoning?: string;
    serviceTier?: string;
    approvalPolicy?: ApprovalPolicy;
    sandboxMode?: SandboxMode;
    personality?: CodexPersonality;
    reasoningSummary?: ReasoningSummary;
  }>;
}

export interface ModelCache {
  version: 1;
  cachedAt: string;
  executablePath: string;
  models: CodexModel[];
}

const WORKSPACE_KEY = "tamagrid.workspace.v1";
const MODEL_CACHE_KEY = "tamagrid.models.v1";
const LEGACY_WORKSPACE_KEY = "agentdeck.workspace.v1";
const LEGACY_MODEL_CACHE_KEY = "agentdeck.models.v1";
export const FONT_SCALE_MIN = 0.9;
export const FONT_SCALE_MAX = 2;
export const FONT_SCALE_STEP = 0.1;

export function normalizeFontScale(value: unknown): number {
  const numeric =
    typeof value === "number" && Number.isFinite(value) ? value : 1;
  const clamped = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, numeric));
  return Number(
    (Math.round(clamped / FONT_SCALE_STEP) * FONT_SCALE_STEP).toFixed(2),
  );
}

export function createDefaultPanes(): PaneRuntimeState[] {
  return [
    createPane("pane-left"),
    createPane("pane-right"),
    createPane("pane-bottom-left"),
    createPane("pane-bottom-right"),
  ];
}

function createPane(id: string): PaneRuntimeState {
  return {
    id,
    sessionActive: true,
    title: "",
    status: "Idle",
    workingDirectory: "",
    events: [],
  };
}

export function loadWorkspace(): PersistedWorkspace {
  const fallback: PersistedWorkspace = {
    version: 7,
    selectedPaneId: "pane-left",
    fontScale: 1,
    layout: "split-2",
    theme: "aurora",
    language: "en",
    sendMode: "modifier-enter",
    panes: createDefaultPanes().map(
      ({ id, title, workingDirectory, sessionActive }) => ({
        id,
        title,
        workingDirectory,
        sessionActive,
      }),
    ),
  };
  const storage = safeStorage();
  if (!storage) return fallback;
  try {
    const parsed: unknown = JSON.parse(
      readWithLegacyMigration(storage, WORKSPACE_KEY, LEGACY_WORKSPACE_KEY) ??
        "null",
    );
    if (
      !isJsonObject(parsed) ||
      (parsed.version !== 1 &&
        parsed.version !== 2 &&
        parsed.version !== 3 &&
        parsed.version !== 4 &&
        parsed.version !== 5 &&
        parsed.version !== 6 &&
        parsed.version !== 7) ||
      !Array.isArray(parsed.panes)
    )
      return fallback;
    const storedPanes = parsed.panes
      .filter(isJsonObject)
      .slice(0, 4)
      .map((pane, index) => {
        const sessionActive = pane.sessionActive !== false;
        return {
          id: typeof pane.id === "string" ? pane.id : defaultPane(index).id,
          title: sessionActive ? paneTitleValue(pane.title) : "",
          workingDirectory:
            typeof pane.workingDirectory === "string"
              ? pane.workingDirectory
              : "",
          sessionActive,
          threadId:
            sessionActive && typeof pane.threadId === "string"
              ? pane.threadId
              : undefined,
          model: typeof pane.model === "string" ? pane.model : undefined,
          reasoning:
            typeof pane.reasoning === "string" ? pane.reasoning : undefined,
          serviceTier:
            typeof pane.serviceTier === "string" ? pane.serviceTier : undefined,
          approvalPolicy: persistedApprovalPolicyValue(pane.approvalPolicy),
          sandboxMode: persistedSandboxModeValue(pane.sandboxMode),
          personality: personalityValue(pane.personality),
          reasoningSummary: reasoningSummaryValue(pane.reasoningSummary),
        };
      });
    if (storedPanes.length === 0) return fallback;
    const panes = createDefaultPanes().map((pane, index) => {
      const stored = storedPanes[index];
      if (!stored) {
        const { id, title, workingDirectory, sessionActive } = pane;
        return { id, title, workingDirectory, sessionActive };
      }
      return stored;
    });
    const layout = layoutValue(parsed.layout);
    const visiblePaneCount =
      layout === "split-2" ? 2 : layout === "columns-3" ? 3 : 4;
    const selectedPaneId =
      typeof parsed.selectedPaneId === "string" &&
      panes
        .slice(0, visiblePaneCount)
        .some((pane) => pane.id === parsed.selectedPaneId)
        ? parsed.selectedPaneId
        : panes[0].id;
    return {
      version: 7,
      selectedPaneId,
      fontScale: normalizeFontScale(parsed.fontScale),
      layout,
      theme: themeValue(parsed.theme),
      language: languageValue(parsed.language),
      sendMode: sendModeValue(parsed.sendMode),
      panes,
    };
  } catch {
    return fallback;
  }
}

export function runtimePanesFromWorkspace(
  workspace: PersistedWorkspace,
): PaneRuntimeState[] {
  return workspace.panes.map((pane) => ({
    ...pane,
    sessionActive: pane.sessionActive !== false,
    status: "Idle",
    loaded: false,
    events: [],
  }));
}

export function saveWorkspace(
  selectedPaneId: string,
  panes: PaneRuntimeState[],
  fontScale: number,
  layout: PaneLayout,
  theme: AppTheme,
  language: AppLanguage,
  sendMode: ComposerSendMode,
): void {
  const storage = safeStorage();
  if (!storage) return;
  const workspace: PersistedWorkspace = {
    version: 7,
    selectedPaneId,
    fontScale: normalizeFontScale(fontScale),
    layout,
    theme,
    language,
    sendMode,
    panes: panes.slice(0, 4).map((pane) => ({
      id: pane.id,
      title: pane.title,
      workingDirectory: pane.workingDirectory,
      sessionActive: pane.sessionActive !== false,
      threadId: pane.sessionActive === false ? undefined : pane.threadId,
      model: pane.model ?? pane.unavailableModel,
      reasoning: pane.reasoning,
      serviceTier: pane.serviceTier,
      // Elevated authority is deliberately session-only. A new launch always
      // returns to an approval-gated, workspace-scoped baseline.
      approvalPolicy:
        pane.approvalPolicy === "never" ? undefined : pane.approvalPolicy,
      sandboxMode:
        pane.sandboxMode === "danger-full-access"
          ? undefined
          : pane.sandboxMode,
      personality: pane.personality,
      reasoningSummary: pane.reasoningSummary,
    })),
  };
  try {
    storage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
  } catch {
    // Persistence failure must not stop active Codex threads.
  }
}

function defaultPane(index: number): PaneRuntimeState {
  return createDefaultPanes()[index] ?? createDefaultPanes()[0];
}

function layoutValue(value: unknown): PaneLayout {
  if (
    value === "split-2" ||
    value === "columns-3" ||
    value === "grid-4" ||
    value === "columns-4" ||
    value === "rows-4"
  )
    return value;
  return "split-2";
}

function themeValue(value: unknown): AppTheme {
  return value === "dark" || value === "light" || value === "green"
    ? value
    : "aurora";
}

function languageValue(value: unknown): AppLanguage {
  return value === "ja" ? "ja" : "en";
}

function sendModeValue(value: unknown): ComposerSendMode {
  return value === "enter" ? "enter" : "modifier-enter";
}

function paneTitleValue(value: unknown): string {
  if (typeof value !== "string") return "";
  const title = value.trim();
  return /^Thread [A-D]$/.test(title) ? "" : title;
}

export function reorderPanes(
  panes: PaneRuntimeState[],
  sourceId: string,
  targetId: string,
): PaneRuntimeState[] {
  if (sourceId === targetId) return panes;
  const sourceIndex = panes.findIndex((pane) => pane.id === sourceId);
  const targetIndex = panes.findIndex((pane) => pane.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return panes;
  const next = panes.slice();
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

function persistedApprovalPolicyValue(
  value: unknown,
): ApprovalPolicy | undefined {
  return value === "untrusted" || value === "on-request" || value === "never"
    ? value === "never"
      ? undefined
      : value
    : undefined;
}

function persistedSandboxModeValue(value: unknown): SandboxMode | undefined {
  return value === "read-only" ||
    value === "workspace-write" ||
    value === "danger-full-access"
    ? value === "danger-full-access"
      ? undefined
      : value
    : undefined;
}

function personalityValue(value: unknown): CodexPersonality | undefined {
  return value === "none" || value === "friendly" || value === "pragmatic"
    ? value
    : undefined;
}

function reasoningSummaryValue(value: unknown): ReasoningSummary | undefined {
  return value === "none" ||
    value === "auto" ||
    value === "concise" ||
    value === "detailed"
    ? value
    : undefined;
}

export function loadModelCache(): ModelCache | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const parsed: unknown = JSON.parse(
      readWithLegacyMigration(
        storage,
        MODEL_CACHE_KEY,
        LEGACY_MODEL_CACHE_KEY,
      ) ?? "null",
    );
    if (
      !isJsonObject(parsed) ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.models)
    )
      return null;
    const models = parsed.models.filter(isCachedModel);
    if (models.length !== parsed.models.length) return null;
    return {
      version: 1,
      cachedAt: typeof parsed.cachedAt === "string" ? parsed.cachedAt : "",
      executablePath:
        typeof parsed.executablePath === "string" ? parsed.executablePath : "",
      models,
    };
  } catch {
    return null;
  }
}

export function saveModelCache(
  executablePath: string,
  models: CodexModel[],
): void {
  const storage = safeStorage();
  if (!storage) return;
  const cache: ModelCache = {
    version: 1,
    cachedAt: new Date().toISOString(),
    executablePath,
    models,
  };
  try {
    storage.setItem(MODEL_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Cache is optional and never the source of truth while connected.
  }
}

function isCachedModel(value: unknown): value is CodexModel {
  if (!isJsonObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.model === "string" &&
    typeof value.displayName === "string" &&
    typeof value.defaultReasoningEffort === "string" &&
    Array.isArray(value.supportedReasoningEfforts)
  );
}

export function reconcileModels(
  panes: PaneRuntimeState[],
  models: CodexModel[],
): PaneRuntimeState[] {
  const available = new Set(models.map((model) => model.id));
  return panes.map((pane) => {
    if (pane.unavailableModel && available.has(pane.unavailableModel)) {
      return {
        ...pane,
        model: pane.unavailableModel,
        unavailableModel: undefined,
      };
    }
    if (pane.model && !available.has(pane.model)) {
      return {
        ...pane,
        model: undefined,
        reasoning: undefined,
        serviceTier: undefined,
        unavailableModel: pane.model,
      };
    }
    const model = models.find((candidate) => candidate.id === pane.model);
    if (model) {
      const reasoning = model.supportedReasoningEfforts.some(
        (option) => option.reasoningEffort === pane.reasoning,
      )
        ? pane.reasoning
        : undefined;
      const serviceTier = model.serviceTiers?.some(
        (tier) => tier.id === pane.serviceTier,
      )
        ? pane.serviceTier
        : undefined;
      const personality =
        model.supportsPersonality === false ? undefined : pane.personality;
      if (
        reasoning !== pane.reasoning ||
        serviceTier !== pane.serviceTier ||
        personality !== pane.personality
      ) {
        return { ...pane, reasoning, serviceTier, personality };
      }
    }
    return pane;
  });
}

export function markPanesDisconnected(
  panes: PaneRuntimeState[],
  detail: string,
): PaneRuntimeState[] {
  return panes.map((pane) => {
    if (pane.status !== "Running" && pane.status !== "Approval") return pane;
    const event: TimelineEvent = {
      id: `disconnect-${Date.now()}-${pane.id}`,
      kind: "error",
      title: "App Server disconnected",
      detail,
    };
    return {
      ...pane,
      status: "Error",
      loaded: false,
      activeTurnId: undefined,
      activeTurnKind: undefined,
      approval: undefined,
      error: detail,
      events: [...pane.events, event].slice(-200),
    };
  });
}

function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readWithLegacyMigration(
  storage: Storage,
  key: string,
  legacyKey: string,
): string | null {
  const current = storage.getItem(key);
  if (current !== null) return current;
  const legacy = storage.getItem(legacyKey);
  if (legacy === null) return null;
  try {
    storage.setItem(key, legacy);
  } catch {
    // Reading legacy state is still useful when migration cannot be persisted.
  }
  return legacy;
}
