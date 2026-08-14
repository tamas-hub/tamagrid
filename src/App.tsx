import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AgentPane,
  Header,
  HistoryDrawer,
  PaneGrid,
  SettingsModal,
} from "./components";
import type {
  AgentPaneData,
  AppLanguage,
  ApprovalPolicy,
  AppTheme,
  CodexPersonality,
  ComposerSendMode,
  ModelOption,
  PaneLayout,
  ReasoningSummary,
  SandboxMode,
} from "./components/types";
import { I18nProvider, translate } from "./i18n";
import {
  CodexAdapter,
  createCodexBridge,
  isPackagedSoakBuild,
  isJsonObject,
  packagedSoakMaxFrameGapMs,
  PACKAGED_SOAK_ITEM_ID,
  startPackagedSoakFrameMonitor,
  submitPackagedSoakReport,
  type AppServerEvent,
  type CodexModel,
  type CodexReviewTarget,
  type CodexThreadSummary,
  type CodexUsageSummary,
  type JsonObject,
  type JsonRpcMessage,
  waitForPackagedSoakCompletion,
} from "./codex";
import {
  MAX_PROTOCOL_QUEUE_DELTA_BYTES,
  protocolDeltaBytes,
  protocolDeltaWouldOverflow,
  protocolEventCountWouldOverflow,
  tryCoalesceAdjacentProtocolDelta,
} from "./codex/protocolQueue";
import {
  applyProtocolMessage,
  eventsFromThreadRead,
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  FONT_SCALE_STEP,
  loadModelCache,
  loadWorkspace,
  markPanesDisconnected,
  normalizeFontScale,
  protocolThreadId,
  reconcileModels,
  reorderPanes,
  runtimePanesFromWorkspace,
  saveModelCache,
  saveWorkspace,
  type PaneRuntimeState,
} from "./state";
import "./styles/tamagrid.css";

interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  generation: number;
  version: string;
  authStatus: string;
  error?: string;
}

const initialWorkspace = loadWorkspace();
const initialModelCache = loadModelCache();
const PULL_REQUEST_PREP_PROMPT: Record<AppLanguage, string> = {
  ja: "Pull Requestの準備をしてください。現在のGit branch、working tree、staged・unstaged・untrackedの差分を確認し、必要なテストを実行または提案したうえで、PRタイトルと本文の案を作成してください。commit、push、remote branch作成、gh pr createなど外部状態を変更する操作はまだ実行せず、準備結果を提示して私の明示的な確認を待ってください。",
  en: "Prepare a Pull Request draft. Inspect the current Git branch and all staged, unstaged, and untracked changes. Run or recommend the necessary tests, then draft a PR title and body. Do not commit, push, create a remote branch, run gh pr create, or make any other external change yet. Present the preparation results and wait for my explicit confirmation.",
};
function App() {
  const adapterRef = useRef(new CodexAdapter(createCodexBridge()));
  const [panes, setPanes] = useState<PaneRuntimeState[]>(() =>
    runtimePanesFromWorkspace(initialWorkspace),
  );
  const panesRef = useRef(panes);
  const [models, setModels] = useState<CodexModel[]>(
    () => initialModelCache?.models ?? [],
  );
  const modelsRef = useRef(models);
  const [modelSource, setModelSource] = useState<"live" | "cache" | "none">(
    () => (initialModelCache ? "cache" : "none"),
  );
  const [usage, setUsage] = useState<CodexUsageSummary | null>(null);
  const [fontScale, setFontScale] = useState(initialWorkspace.fontScale);
  const [layout, setLayout] = useState<PaneLayout>(initialWorkspace.layout);
  const [theme, setTheme] = useState<AppTheme>(initialWorkspace.theme);
  const [language, setLanguage] = useState<AppLanguage>(
    initialWorkspace.language,
  );
  const [sendMode, setSendMode] = useState<ComposerSendMode>(
    initialWorkspace.sendMode,
  );
  const [selectedPaneId, setSelectedPaneId] = useState(
    initialWorkspace.selectedPaneId,
  );
  const [executablePath, setExecutablePath] = useState("");
  const executablePathRef = useRef(executablePath);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyThreads, setHistoryThreads] = useState<CodexThreadSummary[]>(
    [],
  );
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const historyCursorRef = useRef<string | null>(null);
  const historyQueryRef = useRef("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string>();
  const [expandedThreadId, setExpandedThreadId] = useState<string>();
  const [expandedEvents, setExpandedEvents] =
    useState<PaneRuntimeState["events"]>();
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);
  const historyDetailRequestRef = useRef(0);
  const [connection, setConnection] = useState<ConnectionState>({
    connected: false,
    connecting: false,
    generation: 0,
    version: "—",
    authStatus: "Unknown",
  });
  const connectionRef = useRef(connection);
  const activeGenerationRef = useRef(0);
  const minimumGenerationRef = useRef(1);
  const lastSequenceRef = useRef(0);
  const protocolQueueRef = useRef<AppServerEvent[]>([]);
  const protocolQueueDeltaBytesRef = useRef(0);
  const flushFrameRef = useRef<number | undefined>(undefined);
  const orphanMessagesRef = useRef(new Map<string, JsonRpcMessage[]>());
  const intentionalDisconnectRef = useRef(false);
  const refreshModelsRef = useRef<() => Promise<void>>(async () => undefined);
  const refreshUsageRef = useRef<() => Promise<void>>(async () => undefined);
  const usageRefreshTimerRef = useRef<number | undefined>(undefined);
  const packagedSoakStartedRef = useRef(false);
  const [draggingPaneId, setDraggingPaneId] = useState<string>();
  const [dragOverPaneId, setDragOverPaneId] = useState<string>();

  useEffect(() => {
    panesRef.current = panes;
  }, [panes]);
  useEffect(() => {
    modelsRef.current = models;
  }, [models]);
  useEffect(() => {
    executablePathRef.current = executablePath;
  }, [executablePath]);
  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--font-scale",
      String(fontScale),
    );
    document.documentElement.style.fontSize = `${16 * fontScale}px`;
    document.documentElement.dataset.fontScale =
      fontScale >= 1.7 ? "xl" : fontScale >= 1.4 ? "large" : "normal";
  }, [fontScale]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const scheduleUsageRefresh = useCallback((delay: number) => {
    if (usageRefreshTimerRef.current !== undefined)
      window.clearTimeout(usageRefreshTimerRef.current);
    usageRefreshTimerRef.current = window.setTimeout(() => {
      usageRefreshTimerRef.current = undefined;
      void refreshUsageRef.current();
    }, delay);
  }, []);

  const flushProtocolQueue = useCallback(() => {
    flushFrameRef.current = undefined;
    const queued = protocolQueueRef.current
      .splice(0)
      .sort((left, right) => left.sequence - right.sequence);
    protocolQueueDeltaBytesRef.current = 0;
    if (queued.length === 0) return;

    for (const event of queued) {
      const message = event.message as JsonRpcMessage | undefined;
      if (message?.method === "account/updated") {
        const params = isJsonObject(message.params) ? message.params : {};
        setConnection((current) => ({
          ...current,
          authStatus: authStatusFromUpdate(params),
        }));
        void refreshModelsRef.current();
        scheduleUsageRefresh(150);
      }
      if (
        message?.method === "account/rateLimits/updated" ||
        message?.method === "turn/completed"
      ) {
        scheduleUsageRefresh(350);
      }
    }

    setPanes((current) => {
      let next = current;
      for (const event of queued) {
        const message = event.message as JsonRpcMessage | undefined;
        if (!message) continue;
        const threadId = protocolThreadId(message);
        if (threadId && !next.some((pane) => pane.threadId === threadId)) {
          const orphans = orphanMessagesRef.current.get(threadId) ?? [];
          orphans.push(message);
          orphanMessagesRef.current.set(threadId, orphans.slice(-100));
          continue;
        }
        next = applyProtocolMessage(next, message);
      }
      panesRef.current = next;
      return next;
    });
  }, [scheduleUsageRefresh]);

  const onAppServerEvent = useCallback(
    (event: AppServerEvent) => {
      if (event.generation < minimumGenerationRef.current) return;
      if (event.generation > activeGenerationRef.current) {
        activeGenerationRef.current = event.generation;
        lastSequenceRef.current = 0;
      }
      if (
        event.generation !== activeGenerationRef.current ||
        event.sequence <= lastSequenceRef.current
      )
        return;
      lastSequenceRef.current = event.sequence;

      if (event.eventType === "message" && event.message) {
        const incomingDeltaBytes = protocolDeltaBytes(event);
        const cancelScheduledFlush = () => {
          if (flushFrameRef.current !== undefined) {
            window.cancelAnimationFrame(flushFrameRef.current);
            flushFrameRef.current = undefined;
          }
        };
        if (incomingDeltaBytes > MAX_PROTOCOL_QUEUE_DELTA_BYTES) {
          cancelScheduledFlush();
          flushProtocolQueue();
          protocolQueueRef.current.push(event);
          protocolQueueDeltaBytesRef.current = incomingDeltaBytes;
          flushProtocolQueue();
          return;
        }
        if (
          protocolDeltaWouldOverflow(
            protocolQueueDeltaBytesRef.current,
            incomingDeltaBytes,
          )
        ) {
          cancelScheduledFlush();
          flushProtocolQueue();
        }
        if (
          !tryCoalesceAdjacentProtocolDelta(protocolQueueRef.current, event)
        ) {
          if (
            protocolEventCountWouldOverflow(protocolQueueRef.current.length)
          ) {
            cancelScheduledFlush();
            // Flush synchronously at the hard limit. Terminal and approval
            // events are never discarded, while adjacent deltas are normally
            // coalesced before reaching this path.
            flushProtocolQueue();
          }
          protocolQueueRef.current.push(event);
        }
        protocolQueueDeltaBytesRef.current += incomingDeltaBytes;
        if (flushFrameRef.current === undefined) {
          flushFrameRef.current =
            window.requestAnimationFrame(flushProtocolQueue);
        }
        return;
      }

      if (event.eventType === "stderr") return;
      if (event.eventType === "disconnected" || event.eventType === "exited") {
        if (intentionalDisconnectRef.current) return;
        const detail =
          event.detail ??
          (event.exitCode == null
            ? "Codex App Server exited unexpectedly."
            : `Codex App Server exited with code ${event.exitCode}.`);
        setConnection((current) => ({
          ...current,
          connected: false,
          connecting: false,
          error: detail,
        }));
        setUsage(null);
        setPanes((current) => {
          const next = markPanesDisconnected(current, detail);
          panesRef.current = next;
          return next;
        });
        return;
      }
      if (event.eventType === "transportError") {
        setConnection((current) => ({
          ...current,
          error: event.detail ?? "App Server transport error",
        }));
      }
    },
    [flushProtocolQueue],
  );

  const attachThread = useCallback(
    (
      paneId: string,
      threadId: string,
      events?: PaneRuntimeState["events"],
      patch: Partial<PaneRuntimeState> = {},
    ) => {
      const orphans = orphanMessagesRef.current.get(threadId) ?? [];
      orphanMessagesRef.current.delete(threadId);
      setPanes((current) => {
        let next = current.map((pane) =>
          pane.id === paneId
            ? {
                ...pane,
                ...patch,
                threadId,
                loaded: true,
                status: "Idle" as const,
                error: undefined,
                events: events ?? pane.events,
              }
            : pane,
        );
        for (const message of orphans)
          next = applyProtocolMessage(next, message);
        panesRef.current = next;
        return next;
      });
    },
    [],
  );

  const resumePane = useCallback(
    async (pane: PaneRuntimeState) => {
      if (!pane.threadId || pane.unavailableModel) return;
      const adapter = adapterRef.current;
      try {
        const resumed = await adapter.resumeThread(pane.threadId, {
          ...threadOptionsFromPane(pane),
        });
        let history: PaneRuntimeState["events"] | undefined;
        let title: string | undefined;
        try {
          const threadRead = await adapter.readThread(resumed.thread.id);
          history = eventsFromThreadRead(threadRead);
          title = threadTitleFromRead(threadRead);
        } catch {
          // A restored thread remains usable even if old history cannot be rendered.
        }
        attachThread(
          pane.id,
          resumed.thread.id,
          history,
          title ? { title } : {},
        );
      } catch (error) {
        const detail = errorMessage(error);
        setPanes((current) =>
          current.map((candidate) =>
            candidate.id === pane.id
              ? {
                  ...candidate,
                  loaded: false,
                  status: "Error",
                  error: `Thread restore failed: ${detail}`,
                }
              : candidate,
          ),
        );
      }
    },
    [attachThread],
  );

  const connectAppServer = useCallback(async () => {
    if (connectionRef.current.connecting) return;
    intentionalDisconnectRef.current = false;
    minimumGenerationRef.current = activeGenerationRef.current + 1;
    setConnection((current) => ({
      ...current,
      connecting: true,
      connected: false,
      error: undefined,
    }));
    try {
      const info = await adapterRef.current.connect(onAppServerEvent);
      activeGenerationRef.current = info.generation;
      minimumGenerationRef.current = info.generation;
      const liveModels = adapterRef.current.modelsFromConnection(info);
      const reconciled = reconcileModels(
        panesRef.current.map((pane) => ({ ...pane, loaded: false })),
        liveModels,
      );
      panesRef.current = reconciled;
      setPanes(reconciled);
      setModels(liveModels);
      modelsRef.current = liveModels;
      setModelSource("live");
      setExecutablePath(info.executablePath);
      executablePathRef.current = info.executablePath;
      saveModelCache(info.executablePath, liveModels);
      setUsage(adapterRef.current.usageFromConnection(info));
      setConnection({
        connected: true,
        connecting: false,
        generation: info.generation,
        version: info.version,
        authStatus: authStatusFromAccount(info.account),
      });
      await Promise.allSettled(reconciled.map(resumePane));
    } catch (error) {
      const detail = errorMessage(error);
      setConnection((current) => ({
        ...current,
        connected: false,
        connecting: false,
        error: detail,
      }));
      setModelSource(modelsRef.current.length > 0 ? "cache" : "none");
      setUsage(null);
      setSettingsOpen(true);
    }
  }, [onAppServerEvent, resumePane]);

  const disconnectAppServer = useCallback(async () => {
    intentionalDisconnectRef.current = true;
    try {
      await adapterRef.current.disconnect();
    } catch (error) {
      setConnection((current) => ({ ...current, error: errorMessage(error) }));
    } finally {
      setConnection((current) => ({
        ...current,
        connected: false,
        connecting: false,
      }));
      setUsage(null);
      setHistoryOpen(false);
      setHistoryThreads([]);
      setHistoryCursor(null);
      historyCursorRef.current = null;
      setPanes((current) => {
        const next = current.map((pane) => ({
          ...pane,
          loaded: false,
          activeTurnId: undefined,
          approval: undefined,
          status: "Idle" as const,
        }));
        panesRef.current = next;
        return next;
      });
      intentionalDisconnectRef.current = false;
    }
  }, []);

  const refreshModels = useCallback(async () => {
    if (!connectionRef.current.connected || connectionRef.current.connecting)
      return;
    try {
      const liveModels = await adapterRef.current.listModels();
      setModels(liveModels);
      modelsRef.current = liveModels;
      setModelSource("live");
      saveModelCache(executablePathRef.current, liveModels);
      setPanes((current) => {
        const next = reconcileModels(current, liveModels);
        panesRef.current = next;
        return next;
      });
      setConnection((current) => ({ ...current, error: undefined }));
    } catch (error) {
      setModelSource(modelsRef.current.length > 0 ? "cache" : "none");
      setConnection((current) => ({
        ...current,
        error: `Model discovery failed: ${errorMessage(error)}`,
      }));
    }
  }, []);
  refreshModelsRef.current = refreshModels;

  const refreshUsage = useCallback(async () => {
    if (!connectionRef.current.connected || connectionRef.current.connecting)
      return;
    try {
      const nextUsage = await adapterRef.current.readRateLimits();
      setUsage(nextUsage);
    } catch (error) {
      setConnection((current) => ({
        ...current,
        error: `Usage refresh failed: ${errorMessage(error)}`,
      }));
    }
  }, []);
  refreshUsageRef.current = refreshUsage;

  const loadHistory = useCallback(
    async (reset: boolean, queryOverride?: string) => {
      if (!connectionRef.current.connected || historyLoading) return;
      const query = queryOverride ?? historyQueryRef.current;
      const cursor = reset ? null : historyCursorRef.current;
      historyQueryRef.current = query;
      setHistoryLoading(true);
      setHistoryError(undefined);
      if (reset) {
        setExpandedThreadId(undefined);
        setExpandedEvents(undefined);
      }
      try {
        const page = await adapterRef.current.listThreads(cursor, query);
        setHistoryThreads((current) => {
          if (reset) return page.data;
          const merged = new Map(current.map((thread) => [thread.id, thread]));
          page.data.forEach((thread) => merged.set(thread.id, thread));
          return [...merged.values()];
        });
        setHistoryCursor(page.nextCursor);
        historyCursorRef.current = page.nextCursor;
      } catch (error) {
        setHistoryError(`History load failed: ${errorMessage(error)}`);
      } finally {
        setHistoryLoading(false);
      }
    },
    [historyLoading],
  );

  const toggleHistoryThread = useCallback(
    async (threadId: string) => {
      if (expandedThreadId === threadId) {
        historyDetailRequestRef.current += 1;
        setExpandedThreadId(undefined);
        setExpandedEvents(undefined);
        return;
      }
      setExpandedThreadId(threadId);
      setExpandedEvents(undefined);
      setHistoryDetailLoading(true);
      setHistoryError(undefined);
      const requestId = ++historyDetailRequestRef.current;
      try {
        const result = await adapterRef.current.readThread(threadId);
        if (requestId === historyDetailRequestRef.current)
          setExpandedEvents(eventsFromThreadRead(result));
      } catch (error) {
        if (requestId === historyDetailRequestRef.current)
          setHistoryError(`History detail failed: ${errorMessage(error)}`);
      } finally {
        if (requestId === historyDetailRequestRef.current)
          setHistoryDetailLoading(false);
      }
    },
    [expandedThreadId],
  );

  const continueHistoryThread = useCallback(
    async (thread: CodexThreadSummary) => {
      const assigned = panesRef.current.find(
        (pane) => pane.threadId === thread.id,
      );
      if (assigned) {
        const title = threadTitle(thread);
        if (title && assigned.title !== title) {
          setPanes((current) => {
            const next = current.map((pane) =>
              pane.id === assigned.id ? { ...pane, title } : pane,
            );
            panesRef.current = next;
            return next;
          });
        }
        setSelectedPaneId(assigned.id);
        if (panesRef.current.indexOf(assigned) > 1) setLayout("grid-4");
        setHistoryOpen(false);
        return;
      }
      const pane = panesRef.current.find(
        (candidate) => candidate.id === selectedPaneId,
      );
      if (!pane || pane.status === "Running" || pane.status === "Approval") {
        setHistoryError(
          "選択中のPaneは実行中です。停止または完了後に継続してください。",
        );
        return;
      }
      const workingDirectory = thread.cwd || pane.workingDirectory;
      setHistoryDetailLoading(true);
      setHistoryError(undefined);
      try {
        const configuredPane = { ...pane, workingDirectory };
        const resumed = await adapterRef.current.resumeThread(
          thread.id,
          threadOptionsFromPane(configuredPane),
        );
        let events =
          expandedThreadId === thread.id ? expandedEvents : undefined;
        if (!events) {
          events = eventsFromThreadRead(
            await adapterRef.current.readThread(resumed.thread.id),
          );
        }
        attachThread(pane.id, resumed.thread.id, events, {
          workingDirectory,
          title: threadTitle(thread),
        });
        setHistoryOpen(false);
      } catch (error) {
        setHistoryError(`Thread resume failed: ${errorMessage(error)}`);
      } finally {
        setHistoryDetailLoading(false);
      }
    },
    [attachThread, expandedEvents, expandedThreadId, selectedPaneId],
  );

  useEffect(() => {
    const adapter = adapterRef.current;
    void connectAppServer();
    return () => {
      intentionalDisconnectRef.current = true;
      if (flushFrameRef.current !== undefined)
        window.cancelAnimationFrame(flushFrameRef.current);
      if (usageRefreshTimerRef.current !== undefined)
        window.clearTimeout(usageRefreshTimerRef.current);
      void adapter.disconnect();
    };
  }, [connectAppServer]);

  const persistenceFingerprint = JSON.stringify(
    panes.map((pane) => ({
      id: pane.id,
      title: pane.title,
      workingDirectory: pane.workingDirectory,
      threadId: pane.threadId,
      model: pane.model ?? pane.unavailableModel,
      reasoning: pane.reasoning,
      serviceTier: pane.serviceTier,
      approvalPolicy: pane.approvalPolicy,
      sandboxMode: pane.sandboxMode,
      personality: pane.personality,
      reasoningSummary: pane.reasoningSummary,
    })),
  );
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        saveWorkspace(
          selectedPaneId,
          panesRef.current,
          fontScale,
          layout,
          theme,
          language,
          sendMode,
        ),
      200,
    );
    return () => window.clearTimeout(timer);
  }, [
    fontScale,
    layout,
    language,
    sendMode,
    theme,
    selectedPaneId,
    persistenceFingerprint,
  ]);

  const changeFontScale = useCallback((nextScale: number) => {
    setFontScale(normalizeFontScale(nextScale));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key === ",") {
        event.preventDefault();
        setSettingsOpen(true);
      } else if (["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        const pane = panesRef.current[Number(event.key) - 1];
        if (pane) {
          setSelectedPaneId(pane.id);
          if (Number(event.key) > 2)
            setLayout((current) =>
              current === "split-2" ? "grid-4" : current,
            );
        }
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setFontScale((current) =>
          normalizeFontScale(current + FONT_SCALE_STEP),
        );
      } else if (event.key === "-") {
        event.preventDefault();
        setFontScale((current) =>
          normalizeFontScale(current - FONT_SCALE_STEP),
        );
      } else if (event.key === "0") {
        event.preventDefault();
        setFontScale(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const ensureThread = useCallback(
    async (pane: PaneRuntimeState): Promise<string> => {
      const adapter = adapterRef.current;
      if (pane.threadId && pane.loaded) return pane.threadId;
      if (pane.threadId) {
        const resumed = await adapter.resumeThread(pane.threadId, {
          ...threadOptionsFromPane(pane),
        });
        const title = threadTitleFromRead(resumed);
        attachThread(
          pane.id,
          resumed.thread.id,
          undefined,
          title ? { title } : {},
        );
        return resumed.thread.id;
      }
      const started = await adapter.startThread({
        ...threadOptionsFromPane(pane),
      });
      const title = threadTitleFromRead(started);
      attachThread(
        pane.id,
        started.thread.id,
        undefined,
        title ? { title } : {},
      );
      if (pane.title.trim()) {
        try {
          await adapter.renameThread(started.thread.id, pane.title.trim());
        } catch {
          // Older App Server builds may still run the turn and name it later.
        }
      }
      return started.thread.id;
    },
    [attachThread],
  );

  const sendTurn = useCallback(
    async (paneId: string, text: string) => {
      if (!connectionRef.current.connected) return;
      const pane = panesRef.current.find(
        (candidate) => candidate.id === paneId,
      );
      if (
        !pane ||
        pane.status === "Running" ||
        pane.status === "Approval" ||
        pane.unavailableModel
      )
        return;
      setPanes((current) =>
        current.map((candidate) =>
          candidate.id === paneId
            ? {
                ...candidate,
                status: "Running",
                activeTurnKind: "task",
                error: undefined,
              }
            : candidate,
        ),
      );
      try {
        const threadId = await ensureThread(pane);
        const result = await adapterRef.current.startTurn(threadId, text, {
          ...threadOptionsFromPane(pane),
          effort: pane.reasoning,
          summary: pane.reasoningSummary,
        });
        setPanes((current) => {
          const next = current.map((candidate) =>
            candidate.id === paneId
              ? {
                  ...candidate,
                  threadId,
                  loaded: true,
                  activeTurnId: result.turn.id,
                  activeTurnKind: "task" as const,
                  status: "Running" as const,
                }
              : candidate,
          );
          panesRef.current = next;
          return next;
        });
      } catch (error) {
        const detail = errorMessage(error);
        setPanes((current) =>
          current.map((candidate) =>
            candidate.id === paneId
              ? {
                  ...candidate,
                  status: "Error",
                  activeTurnId: undefined,
                  activeTurnKind: undefined,
                  error: detail,
                }
              : candidate,
          ),
        );
      }
    },
    [ensureThread],
  );

  useEffect(() => {
    if (
      !isPackagedSoakBuild() ||
      !connection.connected ||
      packagedSoakStartedRef.current
    )
      return;
    packagedSoakStartedRef.current = true;
    let cancelled = false;
    const frameMonitor = startPackagedSoakFrameMonitor();

    const run = async () => {
      const paneId = panesRef.current[0]?.id;
      if (!paneId) throw new Error("The packaged soak has no target pane");
      await sendTurn(paneId, "Run the deterministic packaged WebView soak");
      const channel = await waitForPackagedSoakCompletion();
      await waitForPackagedSoakRender(() => {
        const pane = panesRef.current.find(
          (candidate) => candidate.id === paneId,
        );
        const event = pane?.events.find(
          (candidate) => candidate.id === PACKAGED_SOAK_ITEM_ID,
        );
        return pane?.status === "Done" && Boolean(event?.detail);
      });
      if (cancelled) return;

      const frame = frameMonitor.stop();
      const pane = panesRef.current.find(
        (candidate) => candidate.id === paneId,
      );
      const assistantEvent = pane?.events.find(
        (event) => event.id === channel.descriptor.itemId,
      );
      const paneElement = Array.from(
        document.querySelectorAll<HTMLElement>(".agent-pane"),
      ).find((element) => element.dataset.paneId === paneId);
      const timeline = paneElement?.querySelector<HTMLElement>(".timeline");
      const renderedAssistant =
        paneElement?.querySelector<HTMLElement>(".event-assistant p");
      const timelineDistance = timeline
        ? timeline.scrollHeight - timeline.clientHeight - timeline.scrollTop
        : Number.POSITIVE_INFINITY;
      const failures: string[] = [];
      const maxFrameGapThresholdMs = packagedSoakMaxFrameGapMs();
      if (channel.receivedDeltaEvents !== channel.descriptor.deltaEvents)
        failures.push("delta event count mismatch");
      if (channel.receivedDeltaBytes !== channel.descriptor.expectedDeltaBytes)
        failures.push("delta byte count mismatch");
      if (channel.sequenceGaps !== 0)
        failures.push("Tauri Channel sequence gap detected");
      if (channel.lastSequence !== channel.descriptor.expectedLastSequence)
        failures.push("terminal sequence mismatch");
      if (channel.elapsedMs < channel.descriptor.durationMs * 0.9)
        failures.push("stream completed too early");
      if (frame.frames < Math.max(30, channel.descriptor.durationMs / 100))
        failures.push("animation frame heartbeat was too sparse");
      if (frame.maxFrameGapMs >= maxFrameGapThresholdMs)
        failures.push(
          `WebView was unresponsive for at least ${maxFrameGapThresholdMs} ms`,
        );
      if (pane?.status !== "Done")
        failures.push("pane did not reach the Done state");
      if (pane?.activeTurnId !== undefined)
        failures.push("active turn id was not cleared");
      if (!assistantEvent?.detail?.includes("output truncated by TamaGrid"))
        failures.push(
          "authoritative assistant output was not safely truncated",
        );
      if (renderedAssistant?.textContent !== assistantEvent?.detail)
        failures.push("rendered assistant text does not match pane state");
      if (timelineDistance > 24)
        failures.push("timeline did not remain scrolled to the latest row");

      await submitPackagedSoakReport({
        passed: failures.length === 0,
        failures,
        durationMs: channel.descriptor.durationMs,
        elapsedMs: Math.round(channel.elapsedMs),
        expectedDeltaEvents: channel.descriptor.deltaEvents,
        receivedDeltaEvents: channel.receivedDeltaEvents,
        expectedDeltaBytes: channel.descriptor.expectedDeltaBytes,
        receivedDeltaBytes: channel.receivedDeltaBytes,
        expectedLastSequence: channel.descriptor.expectedLastSequence,
        lastSequence: channel.lastSequence,
        sequenceGaps: channel.sequenceGaps,
        animationFrames: frame.frames,
        maxFrameGapMs: Math.round(frame.maxFrameGapMs),
        maxFrameGapThresholdMs,
        finalPaneStatus: pane?.status ?? "missing",
        activeTurnCleared: pane?.activeTurnId === undefined,
        renderedAssistantChars: renderedAssistant?.textContent?.length ?? 0,
        timelineDistancePx: Number.isFinite(timelineDistance)
          ? Math.round(timelineDistance)
          : null,
        documentVisibility: document.visibilityState,
      });
    };

    void run().catch(async (error) => {
      const frame = frameMonitor.stop();
      if (cancelled) return;
      try {
        await submitPackagedSoakReport({
          passed: false,
          failures: [errorMessage(error)],
          animationFrames: frame.frames,
          maxFrameGapMs: Math.round(frame.maxFrameGapMs),
          documentVisibility: document.visibilityState,
        });
      } catch {
        // The Node runner has its own process timeout for failures that prevent
        // the test-only reporting command from responding.
      }
    });

    return () => {
      cancelled = true;
      frameMonitor.stop();
    };
  }, [connection.connected, sendTurn]);

  const steerTurn = useCallback(async (paneId: string, text: string) => {
    const pane = panesRef.current.find((candidate) => candidate.id === paneId);
    if (
      !pane?.threadId ||
      !pane.activeTurnId ||
      pane.status !== "Running" ||
      pane.activeTurnKind === "review"
    )
      return;
    try {
      await adapterRef.current.steerTurn(
        pane.threadId,
        pane.activeTurnId,
        text,
      );
    } catch (error) {
      const detail = `Steer failed: ${errorMessage(error)}`;
      setPanes((current) =>
        current.map((candidate) =>
          candidate.id === paneId
            ? {
                ...candidate,
                error: detail,
                events: [
                  ...candidate.events,
                  {
                    id: `steer-error-${Date.now()}`,
                    kind: "error" as const,
                    title: "Additional instruction failed",
                    detail,
                    time: new Date().toLocaleTimeString("ja-JP"),
                  },
                ].slice(-200),
              }
            : candidate,
        ),
      );
    }
  }, []);

  const startReview = useCallback(
    async (paneId: string, target: CodexReviewTarget) => {
      if (!connectionRef.current.connected) return;
      const pane = panesRef.current.find(
        (candidate) => candidate.id === paneId,
      );
      if (
        !pane ||
        pane.status === "Running" ||
        pane.status === "Approval" ||
        pane.unavailableModel
      )
        return;
      setPanes((current) =>
        current.map((candidate) =>
          candidate.id === paneId
            ? {
                ...candidate,
                status: "Running",
                activeTurnKind: "review",
                error: undefined,
              }
            : candidate,
        ),
      );
      try {
        const threadId = await ensureThread(pane);
        const result = await adapterRef.current.startReview(threadId, target);
        setPanes((current) => {
          const next = current.map((candidate) =>
            candidate.id === paneId
              ? {
                  ...candidate,
                  threadId: result.reviewThreadId,
                  loaded: true,
                  activeTurnId: result.turn.id,
                  activeTurnKind: "review" as const,
                  status: "Running" as const,
                }
              : candidate,
          );
          panesRef.current = next;
          return next;
        });
      } catch (error) {
        const detail = errorMessage(error);
        setPanes((current) =>
          current.map((candidate) =>
            candidate.id === paneId
              ? {
                  ...candidate,
                  status: "Error",
                  activeTurnId: undefined,
                  activeTurnKind: undefined,
                  error: `Review failed: ${detail}`,
                }
              : candidate,
          ),
        );
      }
    },
    [ensureThread],
  );

  const stopTurn = useCallback(async (paneId: string) => {
    const pane = panesRef.current.find((candidate) => candidate.id === paneId);
    if (!pane?.threadId || !pane.activeTurnId) return;
    try {
      await adapterRef.current.interrupt(pane.threadId, pane.activeTurnId);
    } catch (error) {
      setPanes((current) =>
        current.map((candidate) =>
          candidate.id === paneId
            ? {
                ...candidate,
                status: "Error",
                error: `Stop failed: ${errorMessage(error)}`,
              }
            : candidate,
        ),
      );
    }
  }, []);

  const answerApproval = useCallback(
    async (paneId: string, approved: boolean) => {
      const pane = panesRef.current.find(
        (candidate) => candidate.id === paneId,
      );
      if (!pane?.approval) return;
      const approval = pane.approval;
      try {
        await adapterRef.current.approve(approval.requestId, approved);
        setPanes((current) =>
          current.map((candidate) =>
            candidate.id === paneId && candidate.approval?.key === approval.key
              ? {
                  ...candidate,
                  approval: undefined,
                  status: candidate.activeTurnId ? "Running" : "Idle",
                }
              : candidate,
          ),
        );
      } catch (error) {
        setPanes((current) =>
          current.map((candidate) =>
            candidate.id === paneId
              ? {
                  ...candidate,
                  status: "Error",
                  error: `Approval response failed: ${errorMessage(error)}`,
                }
              : candidate,
          ),
        );
      }
    },
    [],
  );

  const updatePane = useCallback(
    (paneId: string, patch: Partial<PaneRuntimeState>) => {
      setPanes((current) => {
        const next = current.map((pane) =>
          pane.id === paneId ? { ...pane, ...patch } : pane,
        );
        panesRef.current = next;
        return next;
      });
    },
    [],
  );

  const renamePane = useCallback(
    async (paneId: string, requestedTitle: string) => {
      const title = requestedTitle.trim();
      if (!title) throw new Error("A thread title is required.");
      const pane = panesRef.current.find(
        (candidate) => candidate.id === paneId,
      );
      if (!pane) return;
      if (pane.threadId) {
        if (!connectionRef.current.connected)
          throw new Error("Connect to Codex before renaming this chat.");
        await adapterRef.current.renameThread(pane.threadId, title);
      }
      updatePane(paneId, { title });
    },
    [updatePane],
  );

  const changePaneModel = useCallback(
    (paneId: string, modelId: string) => {
      const model = modelsRef.current.find(
        (candidate) => candidate.id === modelId,
      );
      const patch: Partial<PaneRuntimeState> = {
        model: modelId || undefined,
        reasoning: undefined,
        serviceTier: undefined,
        unavailableModel: undefined,
      };
      if (model?.supportsPersonality === false) patch.personality = undefined;
      updatePane(paneId, patch);
    },
    [updatePane],
  );

  const changeLayout = useCallback(
    (nextLayout: PaneLayout) => {
      setLayout(nextLayout);
      if (nextLayout === "split-2") {
        const selectedIndex = panesRef.current.findIndex(
          (pane) => pane.id === selectedPaneId,
        );
        if (selectedIndex > 1) setSelectedPaneId(panesRef.current[0].id);
      }
    },
    [selectedPaneId],
  );

  const movePane = useCallback((sourceId: string, targetId: string) => {
    setPanes((current) => {
      const next = reorderPanes(current, sourceId, targetId);
      panesRef.current = next;
      return next;
    });
  }, []);

  const movePaneByOffset = useCallback(
    (paneId: string, offset: -1 | 1) => {
      const current = panesRef.current;
      const index = current.findIndex((pane) => pane.id === paneId);
      const target = current[index + offset];
      if (!target) return;
      movePane(paneId, target.id);
    },
    [movePane],
  );

  const autoDetect = useCallback(async () => {
    try {
      const result = await adapterRef.current.useAutoDetect();
      setExecutablePath(result.executablePath);
      setConnection((current) => ({
        ...current,
        version: result.version,
        error: undefined,
      }));
    } catch (error) {
      setConnection((current) => ({ ...current, error: errorMessage(error) }));
    }
  }, []);

  const chooseExecutable = useCallback(async () => {
    try {
      const result = await adapterRef.current.chooseExecutable();
      setExecutablePath(result.executablePath);
      setConnection((current) => ({
        ...current,
        version: result.version,
        error: undefined,
      }));
    } catch (error) {
      const detail = errorMessage(error);
      if (!/cancelled/i.test(detail))
        setConnection((current) => ({ ...current, error: detail }));
    }
  }, []);

  const modelOptions = useMemo<ModelOption[]>(
    () =>
      models.map((model) => ({
        id: model.id,
        label: model.displayName,
        reasoningLevels: model.supportedReasoningEfforts.map(
          (option) => option.reasoningEffort,
        ),
        serviceTiers: model.serviceTiers,
        supportsPersonality: model.supportsPersonality,
      })),
    [models],
  );

  const visiblePanes = layout === "split-2" ? panes.slice(0, 2) : panes;
  const selectedPane =
    panes.find((pane) => pane.id === selectedPaneId) ?? panes[0];
  const displayPaneTitle = (pane: PaneRuntimeState) =>
    pane.title || translate(language, "pane.newChat");
  const assignedPanes = Object.fromEntries(
    panes
      .filter((pane): pane is PaneRuntimeState & { threadId: string } =>
        Boolean(pane.threadId),
      )
      .map((pane) => [pane.threadId, displayPaneTitle(pane)]),
  );

  return (
    <I18nProvider language={language}>
      <div className="app-shell">
        <Header
          connected={connection.connected}
          connecting={connection.connecting}
          modelSource={modelSource}
          usage={usage}
          fontScale={fontScale}
          fontScaleMin={FONT_SCALE_MIN}
          fontScaleMax={FONT_SCALE_MAX}
          fontScaleStep={FONT_SCALE_STEP}
          layout={layout}
          theme={theme}
          onRefresh={() => void refreshModels()}
          onHistory={() => {
            setHistoryOpen(true);
            void loadHistory(true);
          }}
          onLayoutChange={changeLayout}
          onThemeChange={setTheme}
          onUsageOpen={() => setSettingsOpen(true)}
          onFontScaleChange={changeFontScale}
          onSettings={() => setSettingsOpen(true)}
        />
        {adapterRef.current.mode === "preview" && (
          <div className="preview-banner" role="status">
            {translate(language, "preview.banner")}
          </div>
        )}
        <PaneGrid layout={layout}>
          {visiblePanes.map((pane) => {
            const viewPane: AgentPaneData = {
              ...pane,
              title: displayPaneTitle(pane),
              approval: pane.approval
                ? {
                    id: pane.approval.key,
                    message: pane.approval.message,
                    kind: pane.approval.kind,
                    reason: pane.approval.reason,
                    command: pane.approval.command,
                    cwd: pane.approval.cwd,
                    network: pane.approval.network,
                    actions: pane.approval.actions,
                    policyChange: pane.approval.policyChange,
                    changes: pane.approval.changes,
                    itemId: pane.approval.itemId,
                    canApprove: pane.approval.canApprove,
                  }
                : undefined,
            };
            return (
              <AgentPane
                key={pane.id}
                pane={viewPane}
                titleValue={pane.title}
                sendMode={sendMode}
                models={modelOptions}
                selected={selectedPaneId === pane.id}
                onSelect={() => setSelectedPaneId(pane.id)}
                dragging={draggingPaneId === pane.id}
                dragOver={
                  dragOverPaneId === pane.id && draggingPaneId !== pane.id
                }
                onDragStart={() => {
                  setDraggingPaneId(pane.id);
                  setDragOverPaneId(undefined);
                }}
                onDragOver={() => {
                  if (draggingPaneId && draggingPaneId !== pane.id)
                    setDragOverPaneId(pane.id);
                }}
                onDrop={() => {
                  if (draggingPaneId) movePane(draggingPaneId, pane.id);
                  setDraggingPaneId(undefined);
                  setDragOverPaneId(undefined);
                }}
                onDragEnd={() => {
                  setDraggingPaneId(undefined);
                  setDragOverPaneId(undefined);
                }}
                onMove={(direction) => movePaneByOffset(pane.id, direction)}
                disabled={connection.connecting}
                runDisabled={!connection.connected}
                onWorkingDirectoryChange={(workingDirectory) =>
                  updatePane(pane.id, { workingDirectory })
                }
                onTitleChange={(title) => renamePane(pane.id, title)}
                onModelChange={(model) => changePaneModel(pane.id, model)}
                onReasoningChange={(reasoning) =>
                  updatePane(pane.id, { reasoning: reasoning || undefined })
                }
                onServiceTierChange={(serviceTier) =>
                  updatePane(pane.id, {
                    serviceTier: serviceTier || undefined,
                  })
                }
                onApprovalPolicyChange={(approvalPolicy) =>
                  updatePane(pane.id, {
                    approvalPolicy:
                      (approvalPolicy as ApprovalPolicy) || undefined,
                  })
                }
                onSandboxModeChange={(sandboxMode) =>
                  updatePane(pane.id, {
                    sandboxMode: (sandboxMode as SandboxMode) || undefined,
                  })
                }
                onPersonalityChange={(personality) =>
                  updatePane(pane.id, {
                    personality: (personality as CodexPersonality) || undefined,
                  })
                }
                onReasoningSummaryChange={(reasoningSummary) =>
                  updatePane(pane.id, {
                    reasoningSummary:
                      (reasoningSummary as ReasoningSummary) || undefined,
                  })
                }
                onUseDefaultModel={() =>
                  updatePane(pane.id, {
                    model: undefined,
                    reasoning: undefined,
                    serviceTier: undefined,
                    unavailableModel: undefined,
                  })
                }
                onChooseModel={() => setSelectedPaneId(pane.id)}
                onSend={(message) => void sendTurn(pane.id, message)}
                onSteer={(message) => void steerTurn(pane.id, message)}
                steerDisabled={pane.activeTurnKind === "review"}
                onStartReview={(target) => void startReview(pane.id, target)}
                onPreparePullRequest={() =>
                  void sendTurn(pane.id, PULL_REQUEST_PREP_PROMPT[language])
                }
                onStop={() => void stopTurn(pane.id)}
                onApproval={(_id, approved) =>
                  void answerApproval(pane.id, approved)
                }
              />
            );
          })}
        </PaneGrid>
        <HistoryDrawer
          open={historyOpen}
          connected={connection.connected}
          loading={historyLoading}
          detailLoading={historyDetailLoading}
          error={historyError}
          threads={historyThreads}
          nextCursor={historyCursor}
          expandedThreadId={expandedThreadId}
          expandedEvents={expandedEvents}
          selectedPaneTitle={
            selectedPane
              ? displayPaneTitle(selectedPane)
              : translate(language, "pane.newChat")
          }
          canContinue={
            Boolean(selectedPane) &&
            selectedPane.status !== "Running" &&
            selectedPane.status !== "Approval"
          }
          assignedPanes={assignedPanes}
          onClose={() => setHistoryOpen(false)}
          onSearch={(query) => void loadHistory(true, query)}
          onRefresh={() => void loadHistory(true)}
          onLoadMore={() => void loadHistory(false)}
          onToggleThread={(threadId) => void toggleHistoryThread(threadId)}
          onContinue={(thread) => void continueHistoryThread(thread)}
        />
        <SettingsModal
          open={settingsOpen}
          codexPath={executablePath}
          connected={connection.connected}
          connecting={connection.connecting}
          version={connection.version}
          authStatus={connection.authStatus}
          connectionError={connection.error}
          usage={usage}
          fontScale={fontScale}
          fontScaleMin={FONT_SCALE_MIN}
          fontScaleMax={FONT_SCALE_MAX}
          fontScaleStep={FONT_SCALE_STEP}
          theme={theme}
          language={language}
          sendMode={sendMode}
          onClose={() => setSettingsOpen(false)}
          onChooseExecutable={() => void chooseExecutable()}
          onAutoDetect={() => void autoDetect()}
          onTestConnection={() => void connectAppServer()}
          onDisconnect={() => void disconnectAppServer()}
          onRefreshModels={() => void refreshModels()}
          onRefreshUsage={() => void refreshUsage()}
          onFontScaleChange={changeFontScale}
          onThemeChange={setTheme}
          onLanguageChange={setLanguage}
          onSendModeChange={setSendMode}
        />
      </div>
    </I18nProvider>
  );
}

function threadTitle(thread: CodexThreadSummary): string {
  return thread.name?.trim() || thread.preview.trim();
}

function threadTitleFromRead(result: JsonObject): string | undefined {
  const thread = isJsonObject(result.thread) ? result.thread : undefined;
  if (!thread) return undefined;
  const name = typeof thread.name === "string" ? thread.name.trim() : "";
  if (name) return name;
  const preview =
    typeof thread.preview === "string" ? thread.preview.trim() : "";
  return preview || undefined;
}

function authStatusFromAccount(result: JsonObject): string {
  const account = isJsonObject(result.account) ? result.account : undefined;
  if (!account)
    return result.requiresOpenaiAuth === true
      ? "Sign-in required"
      : "Not required";
  switch (account.type) {
    case "chatgpt":
      return "ChatGPT available";
    case "apiKey":
      return "Codex API key available";
    case "amazonBedrock":
      return "Amazon Bedrock available";
    case "preview":
      return "Preview";
    default:
      return "Available";
  }
}

function authStatusFromUpdate(params: JsonObject): string {
  if (params.authMode === null) return "Sign-in required";
  if (typeof params.authMode === "string")
    return `${params.authMode} available`;
  return "Unknown";
}

async function waitForPackagedSoakRender(ready: () => boolean): Promise<void> {
  const deadline = performance.now() + 10_000;
  while (!ready()) {
    if (performance.now() >= deadline)
      throw new Error("The packaged soak terminal state was not rendered");
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() => resolve()),
    );
  }
  await new Promise<void>((resolve) =>
    window.requestAnimationFrame(() => resolve()),
  );
  await new Promise<void>((resolve) =>
    window.requestAnimationFrame(() => resolve()),
  );
  await new Promise<void>((resolve) => window.setTimeout(resolve, 200));
}

function threadOptionsFromPane(pane: PaneRuntimeState) {
  return {
    model: pane.model,
    cwd: pane.workingDirectory,
    serviceTier: pane.serviceTier,
    approvalPolicy: pane.approvalPolicy,
    sandboxMode: pane.sandboxMode,
    personality: pane.personality,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

export default App;
