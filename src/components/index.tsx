import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import packageMetadata from "../../package.json";
import type {
  CodexReviewTarget,
  CodexUsageSummary,
  CodexUsageWindow,
} from "../codex";
import type {
  AgentPaneProps,
  AppTheme,
  HeaderProps,
  HistoryDrawerProps,
  PaneLayout,
  SettingsProps,
} from "./types";
import { localizeEventTitle, useI18n } from "../i18n";

const glyph: Record<string, string> = {
  Running: "◌",
  Done: "✓",
  Approval: "!",
  Idle: "•",
  Error: "×",
};

const COMPOSER_MIN_LINES = 3;
const COMPOSER_MAX_LINES = 10;

function SendIcon() {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m3 3 3 9-3 9 19-9Z" />
      <path d="M6 12h16" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function ClearSessionIcon() {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function fitComposerHeight(textarea: HTMLTextAreaElement, hasContent: boolean) {
  const style = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(style.lineHeight) || 18;
  const verticalChrome =
    (Number.parseFloat(style.paddingTop) || 0) +
    (Number.parseFloat(style.paddingBottom) || 0) +
    (Number.parseFloat(style.borderTopWidth) || 0) +
    (Number.parseFloat(style.borderBottomWidth) || 0);
  const minimumHeight = lineHeight * COMPOSER_MIN_LINES + verticalChrome;
  const maximumHeight = lineHeight * COMPOSER_MAX_LINES + verticalChrome;

  textarea.style.height = "auto";
  const contentHeight = hasContent ? textarea.scrollHeight : minimumHeight;
  textarea.style.height = `${Math.ceil(
    Math.min(Math.max(contentHeight, minimumHeight), maximumHeight),
  )}px`;
  textarea.style.overflowY =
    textarea.scrollHeight > maximumHeight ? "auto" : "hidden";
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function runWindowAction(
  action: (appWindow: ReturnType<typeof getCurrentWindow>) => Promise<void>,
) {
  if (!isTauriRuntime()) return;
  void action(getCurrentWindow()).catch(() => undefined);
}

function WindowControls() {
  const { t } = useI18n();
  const native = isTauriRuntime();
  return (
    <div
      className={`window-controls${native ? " is-native" : ""}`}
      aria-hidden={!native}
    >
      <button
        type="button"
        className="window-control"
        tabIndex={native ? 0 : -1}
        aria-label={t("window.minimize")}
        title={t("window.minimize")}
        onClick={() => runWindowAction((appWindow) => appWindow.minimize())}
      >
        <span aria-hidden="true">—</span>
      </button>
      <button
        type="button"
        className="window-control"
        tabIndex={native ? 0 : -1}
        aria-label={t("window.maximizeRestore")}
        title={t("window.maximizeRestore")}
        onClick={() =>
          runWindowAction((appWindow) => appWindow.toggleMaximize())
        }
      >
        <span aria-hidden="true">▢</span>
      </button>
      <button
        type="button"
        className="window-control window-close"
        tabIndex={native ? 0 : -1}
        aria-label={t("window.close")}
        title={t("window.close")}
        onClick={() => runWindowAction((appWindow) => appWindow.close())}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

export function Header({
  connected = false,
  connecting = false,
  modelSource = "none",
  usage,
  fontScale = 1,
  fontScaleMin = 0.9,
  fontScaleMax = 2,
  fontScaleStep = 0.1,
  layout = "split-2",
  theme = "aurora",
  onSettings,
  onHistory,
  onLayoutChange,
  onThemeChange,
  onRefresh,
  onUsageOpen,
  onFontScaleChange,
}: HeaderProps) {
  const { t } = useI18n();
  const connectionLabel = connecting
    ? t("header.connecting")
    : connected
      ? t("header.connected")
      : t("common.offline");
  return (
    <header className="ad-header" data-tauri-drag-region>
      <div className="ad-header-brand" data-tauri-drag-region>
        <span className="ad-mark" aria-hidden="true" data-tauri-drag-region>
          ◆
        </span>
        <span className="ad-brand-lockup" data-tauri-drag-region>
          <span className="ad-brand" data-tauri-drag-region>
            TamaGrid
          </span>
          <span className="ad-kicker" data-tauri-drag-region>
            COCKPIT
          </span>
        </span>
      </div>
      <div className="ad-header-actions" data-tauri-drag-region>
        <div className="ad-header-control-rail">
          <div className="ad-header-status-rail">
            {modelSource === "cache" && (
              <span className="cache-label">{t("header.cachedModels")}</span>
            )}
            <span
              className={`connection ${connected ? "online" : ""} ${connecting ? "connecting" : ""}`}
            >
              <i />
              {connectionLabel}
            </span>
            <UsageMeter usage={usage} onClick={onUsageOpen} />
          </div>
          {onHistory && (
            <button
              type="button"
              className="header-tool"
              onClick={onHistory}
              disabled={!connected || connecting}
              aria-label={t("header.openHistory")}
            >
              <span aria-hidden="true">◷</span>
              <b>{t("header.history")}</b>
            </button>
          )}
          {onLayoutChange && (
            <label className="layout-picker">
              <span className="sr-only">{t("header.paneLayout")}</span>
              <select
                value={layout}
                onChange={(event) =>
                  onLayoutChange(event.target.value as PaneLayout)
                }
                aria-label={t("header.paneLayout")}
              >
                <option value="split-2">{t("layout.split2")}</option>
                <option value="columns-3">{t("layout.columns3")}</option>
                <option value="grid-4">{t("layout.grid4")}</option>
                <option value="columns-4">{t("layout.columns4")}</option>
                <option value="rows-4">{t("layout.rows4")}</option>
              </select>
            </label>
          )}
          {onThemeChange && (
            <label className="theme-picker">
              <span className="sr-only">{t("theme.label")}</span>
              <select
                value={theme}
                onChange={(event) =>
                  onThemeChange(event.target.value as AppTheme)
                }
                aria-label={t("theme.label")}
                title={t("theme.label")}
              >
                <option value="aurora">Aurora</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="green">Green</option>
              </select>
            </label>
          )}
          <div
            className="font-scale-controls"
            role="group"
            aria-label={t("font.label")}
          >
            <button
              type="button"
              onClick={() => onFontScaleChange?.(fontScale - fontScaleStep)}
              disabled={!onFontScaleChange || fontScale <= fontScaleMin}
              aria-label={t("font.smaller")}
              title={t("font.smaller")}
            >
              A−
            </button>
            <output aria-live="polite">{Math.round(fontScale * 100)}%</output>
            <button
              type="button"
              onClick={() => onFontScaleChange?.(fontScale + fontScaleStep)}
              disabled={!onFontScaleChange || fontScale >= fontScaleMax}
              aria-label={t("font.larger")}
              title={t("font.larger")}
            >
              A+
            </button>
          </div>
          {onRefresh && (
            <button
              className="icon-button header-refresh"
              onClick={onRefresh}
              aria-label={t("header.refreshModels")}
              disabled={!connected || connecting}
            >
              ↻
            </button>
          )}
          {onSettings && (
            <button
              className="icon-button"
              onClick={onSettings}
              aria-label={t("header.settings")}
            >
              ⚙
            </button>
          )}
        </div>
      </div>
      <WindowControls />
    </header>
  );
}

function UsageMeter({
  usage,
  onClick,
}: {
  usage?: CodexUsageSummary | null;
  onClick?: () => void;
}) {
  const { locale, t } = useI18n();
  const window = usage?.current;
  const remaining = window ? Math.round(window.remainingPercent) : undefined;
  const reset = window?.resetsAt
    ? formatResetTime(window.resetsAt, locale)
    : undefined;
  const tone = usageTone(remaining);
  const label =
    remaining === undefined
      ? t("usage.unavailableLabel")
      : t("usage.label", {
          remaining,
          reset: reset ? t("usage.resetSuffix", { reset }) : "",
        });
  return (
    <button
      type="button"
      className={`usage-meter usage-${tone}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <span className="usage-meter-copy">
        <small>CODEX REMAINING</small>
        <strong>{remaining === undefined ? "—" : `${remaining}%`}</strong>
      </span>
      <span className="usage-track" aria-hidden="true">
        <i style={{ width: `${remaining ?? 0}%` }} />
      </span>
      {reset && (
        <span className="usage-reset">
          {t("usage.reset")} {reset}
        </span>
      )}
    </button>
  );
}
export function StatusBadge({
  status,
}: {
  status: AgentPaneProps["pane"]["status"];
}) {
  const { t } = useI18n();
  const label = t(`status.${status}`);
  return (
    <span
      className={`status status-${status.toLowerCase()}`}
      aria-label={t("status.label", { status: label })}
    >
      <b>{glyph[status]}</b>
      <span className="status-label">{label}</span>
    </span>
  );
}
export function AgentPane({
  pane,
  titleValue,
  onTitleChange,
  sendMode = "modifier-enter",
  models = [],
  onWorkingDirectoryChange,
  onModelChange,
  onReasoningChange,
  onServiceTierChange,
  onApprovalPolicyChange,
  onSandboxModeChange,
  onPersonalityChange,
  onReasoningSummaryChange,
  onSend,
  onSteer,
  onStartReview,
  onPreparePullRequest,
  onStop,
  onApproval,
  onUseDefaultModel,
  onChooseModel,
  selected,
  onSelect,
  disabled,
  runDisabled,
  steerDisabled,
  dragging,
  dragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMove,
  onClearSession,
  onStartSession,
}: AgentPaneProps) {
  const { language, t } = useI18n();
  const [message, setMessage] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(titleValue ?? pane.title);
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [reviewKind, setReviewKind] =
    useState<CodexReviewTarget["type"]>("uncommittedChanges");
  const [reviewValue, setReviewValue] = useState("");
  const [controlPanel, setControlPanel] = useState<"codex" | "workflow" | null>(
    null,
  );
  const modelSelect = useRef<HTMLSelectElement>(null);
  const composerInput = useRef<HTMLTextAreaElement>(null);
  const timeline = useRef<HTMLDivElement>(null);
  const timelineStickToBottom = useRef(true);
  const sessionActive = pane.sessionActive !== false;
  const previousSessionActive = useRef(sessionActive);
  const selectedModel = models.find((model) => model.id === pane.model);
  useEffect(() => {
    if (!editingTitle) setTitleDraft(titleValue ?? pane.title);
  }, [editingTitle, pane.title, titleValue]);
  useLayoutEffect(() => {
    if (timeline.current) {
      timeline.current.scrollTop = timeline.current.scrollHeight;
      timelineStickToBottom.current = true;
    }
  }, [pane.approval, pane.error, pane.events]);
  useEffect(() => {
    const node = timeline.current;
    if (!node) return;
    let frame = 0;
    const updateStickiness = () => {
      const distance = node.scrollHeight - node.clientHeight - node.scrollTop;
      timelineStickToBottom.current = distance <= 24;
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            if (!timelineStickToBottom.current) return;
            window.cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(() => {
              node.scrollTop = node.scrollHeight;
            });
          });
    node.addEventListener("scroll", updateStickiness, { passive: true });
    observer?.observe(node);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      node.removeEventListener("scroll", updateStickiness);
    };
  }, []);
  useLayoutEffect(() => {
    if (composerInput.current)
      fitComposerHeight(composerInput.current, Boolean(message));
  }, [message]);
  useEffect(() => {
    if (!sessionActive) {
      setMessage("");
      setControlPanel(null);
      setEditingTitle(false);
    } else if (!previousSessionActive.current) {
      composerInput.current?.focus();
    }
    previousSessionActive.current = sessionActive;
  }, [sessionActive]);
  const sendMessage = () => {
    if (!message.trim()) return;
    if (pane.status === "Running") {
      if (steerDisabled) return;
      onSteer?.(message.trim());
    } else {
      onSend?.(message.trim());
    }
    setMessage("");
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage();
  };
  const saveTitle = async (event: FormEvent) => {
    event.preventDefault();
    const title = titleDraft.trim();
    if (!title) {
      setTitleError(t("pane.titleRequired"));
      return;
    }
    try {
      setTitleSaving(true);
      setTitleError("");
      await onTitleChange?.(title);
      setEditingTitle(false);
    } catch {
      setTitleError(t("pane.titleSaveError"));
    } finally {
      setTitleSaving(false);
    }
  };
  const reviewTarget = buildReviewTarget(reviewKind, reviewValue);
  const workflowDisabled =
    Boolean(disabled) ||
    Boolean(runDisabled) ||
    pane.status === "Running" ||
    pane.status === "Approval" ||
    Boolean(pane.unavailableModel);
  return (
    <section
      className={`agent-pane ${selected ? "selected" : ""} ${disabled ? "disabled" : ""} ${dragging ? "dragging" : ""} ${dragOver ? "drag-over" : ""}`}
      data-pane-id={pane.id}
      onClick={onSelect}
      onDragOver={(event) => {
        if (!onDrop) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragOver?.();
      }}
      onDrop={(event) => {
        if (!onDrop) return;
        event.preventDefault();
        onDrop();
      }}
      aria-label={t("pane.agentLabel", { title: pane.title })}
    >
      <div className="pane-head">
        <button
          className="pane-drag-handle"
          type="button"
          draggable
          aria-label={t("pane.drag", { title: pane.title })}
          title={t("pane.drag", { title: pane.title })}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", pane.id);
            onDragStart?.();
          }}
          onDragEnd={onDragEnd}
          onKeyDown={(event) => {
            if (!event.altKey) return;
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              event.preventDefault();
              onMove?.(-1);
            } else if (
              event.key === "ArrowRight" ||
              event.key === "ArrowDown"
            ) {
              event.preventDefault();
              onMove?.(1);
            }
          }}
        >
          ⠿
        </button>
        <div className="pane-title">
          {editingTitle ? (
            <form className="pane-title-form" onSubmit={saveTitle}>
              <input
                autoFocus
                value={titleDraft}
                maxLength={120}
                onChange={(event) => setTitleDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setEditingTitle(false);
                    setTitleError("");
                  }
                }}
                aria-label={t("pane.titleInput")}
                disabled={titleSaving}
              />
              <button
                className="pane-title-action save"
                type="submit"
                aria-label={t("common.save")}
                disabled={titleSaving || !titleDraft.trim()}
              >
                ✓
              </button>
              <button
                className="pane-title-action"
                type="button"
                aria-label={t("common.cancel")}
                onClick={() => {
                  setEditingTitle(false);
                  setTitleError("");
                }}
                disabled={titleSaving}
              >
                ×
              </button>
            </form>
          ) : (
            <div className="pane-title-line">
              <h2 title={pane.title}>{pane.title}</h2>
              {onTitleChange && sessionActive && (
                <button
                  className="pane-title-edit"
                  type="button"
                  aria-label={t("pane.editTitle", { title: pane.title })}
                  title={t("pane.editTitle", { title: pane.title })}
                  onClick={() => {
                    setTitleDraft(titleValue ?? pane.title);
                    setTitleError("");
                    setEditingTitle(true);
                  }}
                  disabled={
                    disabled || (Boolean(pane.threadId) && Boolean(runDisabled))
                  }
                >
                  ✎
                </button>
              )}
            </div>
          )}
          <code>{pane.threadId ?? pane.id}</code>
          {titleError && (
            <small className="pane-title-error" role="alert">
              {titleError}
            </small>
          )}
        </div>
        <div className="pane-head-actions">
          {sessionActive && onClearSession && (
            <button
              className="pane-session-clear"
              type="button"
              onClick={onClearSession}
              disabled={
                disabled ||
                pane.status === "Running" ||
                pane.status === "Approval"
              }
              aria-label={t("pane.clearSession", { title: pane.title })}
              title={`${t("pane.clearSession", { title: pane.title })} — ${t("pane.clearSessionHelp")}`}
            >
              <ClearSessionIcon />
            </button>
          )}
          <StatusBadge status={pane.status} />
        </div>
      </div>
      {sessionActive ? (
        <>
          <div className="timeline" aria-live="polite" ref={timeline}>
        {pane.events.length === 0 ? (
          <div className="empty-state">{t("timeline.waiting")}</div>
        ) : (
          pane.events.map((event) => (
            <article className={`event event-${event.kind}`} key={event.id}>
              <span className="event-icon">
                {event.kind === "user"
                  ? "›"
                  : event.kind === "assistant"
                    ? "✦"
                    : event.kind === "tool"
                      ? "⌘"
                      : event.kind === "file"
                        ? "□"
                        : event.kind === "error"
                          ? "×"
                          : "…"}
              </span>
              <div>
                <strong>{localizeEventTitle(language, event.title)}</strong>
                {event.detail && <p>{event.detail}</p>}
                <small>{event.time}</small>
              </div>
            </article>
          ))
        )}
      </div>
      {pane.unavailableModel && (
        <div className="model-warning" role="alert">
          <strong>{t("model.unavailable")}</strong>
          <p>
            {t("model.previous")}: <code>{pane.unavailableModel}</code>
          </p>
          <div>
            <button
              className="secondary"
              type="button"
              onClick={onUseDefaultModel}
            >
              {t("model.useDefault")}
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() => {
                onChooseModel?.();
                modelSelect.current?.focus();
              }}
            >
              {t("model.choose")}
            </button>
          </div>
        </div>
      )}
      {pane.approval && (
        <div className="approval" role="alert">
          <strong>
            {pane.approval.kind === "file"
              ? t("approval.fileRequired")
              : t("approval.commandRequired")}
          </strong>
          <p className="approval-notice">{t("approval.reviewNotice")}</p>
          <dl className="approval-details">
            {pane.approval.reason && (
              <div>
                <dt>{t("approval.reason")}</dt>
                <dd>{pane.approval.reason}</dd>
              </div>
            )}
            {pane.approval.command && (
              <div>
                <dt>{t("approval.command")}</dt>
                <dd>
                  <pre>{pane.approval.command}</pre>
                </dd>
              </div>
            )}
            {pane.approval.cwd && (
              <div>
                <dt>{t("approval.workingDirectory")}</dt>
                <dd>
                  <code>{pane.approval.cwd}</code>
                </dd>
              </div>
            )}
            {pane.approval.network && (
              <div>
                <dt>{t("approval.network")}</dt>
                <dd>
                  <code>{pane.approval.network}</code>
                </dd>
              </div>
            )}
            {pane.approval.actions && (
              <div>
                <dt>{t("approval.actions")}</dt>
                <dd>
                  <pre>{pane.approval.actions}</pre>
                </dd>
              </div>
            )}
            {pane.approval.policyChange && (
              <div>
                <dt>{t("approval.policyChange")}</dt>
                <dd>
                  <pre>{pane.approval.policyChange}</pre>
                </dd>
              </div>
            )}
            {pane.approval.changes && (
              <div>
                <dt>{t("approval.changes")}</dt>
                <dd>
                  <pre>{pane.approval.changes}</pre>
                </dd>
              </div>
            )}
            {pane.approval.itemId && (
              <div>
                <dt>{t("approval.itemId")}</dt>
                <dd>
                  <code>{pane.approval.itemId}</code>
                </dd>
              </div>
            )}
            {!pane.approval.reason &&
              !pane.approval.command &&
              !pane.approval.cwd &&
              !pane.approval.network &&
              !pane.approval.actions &&
              !pane.approval.policyChange &&
              !pane.approval.changes && (
                <div>
                  <dt>{t("approval.request")}</dt>
                  <dd>{pane.approval.message}</dd>
                </div>
              )}
          </dl>
          {!pane.approval.canApprove && (
            <p className="approval-missing" role="alert">
              {t("approval.missingDetails")}
            </p>
          )}
          <div className="approval-actions">
            <button
              className="approve"
              type="button"
              onClick={() => onApproval?.(pane.approval!.id, true)}
              disabled={!pane.approval.canApprove}
            >
              {t("approval.approve")}
            </button>
            <button
              className="deny"
              type="button"
              onClick={() => onApproval?.(pane.approval!.id, false)}
            >
              {t("approval.deny")}
            </button>
          </div>
        </div>
      )}
      {pane.error && (
        <div className="error-box" role="alert">
          × {pane.error}
        </div>
      )}
      <form className="composer" onSubmit={submit}>
        <div className="composer-input-row">
          <textarea
            ref={composerInput}
            rows={COMPOSER_MIN_LINES}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={
              runDisabled
                ? t("composer.connect")
                : pane.status === "Approval"
                  ? t("composer.answerApproval")
                  : pane.status === "Running"
                    ? steerDisabled
                      ? t("composer.reviewRunning")
                      : t("composer.steerPlaceholder")
                    : t("composer.placeholder")
            }
            aria-label={t("composer.label")}
            disabled={
              disabled ||
              runDisabled ||
              pane.status === "Approval" ||
              (pane.status === "Running" && steerDisabled)
            }
            onKeyDown={(event) => {
              if (
                event.key !== "Enter" ||
                event.nativeEvent.isComposing ||
                event.nativeEvent.keyCode === 229
              )
                return;
              const shouldSend =
                sendMode === "enter"
                  ? !event.shiftKey
                  : Boolean(event.metaKey || event.ctrlKey);
              if (shouldSend) {
                event.preventDefault();
                sendMessage();
              }
            }}
          />
          <div className="composer-actions">
            {pane.status === "Running" ? (
              <>
                <button
                  type="submit"
                  className="steer composer-action"
                  disabled={runDisabled || steerDisabled || !message.trim()}
                  aria-label={t("composer.steer")}
                  title={t("composer.steer")}
                >
                  <span aria-hidden="true">↳</span>
                </button>
                <button
                  type="button"
                  className="stop composer-action"
                  onClick={onStop}
                  disabled={runDisabled}
                  aria-label={t("composer.stop")}
                  title={t("composer.stop")}
                >
                  <span aria-hidden="true">■</span>
                </button>
              </>
            ) : (
              <button
                type="submit"
                className="send composer-action"
                disabled={
                  disabled ||
                  runDisabled ||
                  !message.trim() ||
                  Boolean(pane.unavailableModel) ||
                  pane.status === "Approval"
                }
                aria-label={t("composer.send")}
                title={t("composer.send")}
              >
                <SendIcon />
              </button>
            )}
          </div>
        </div>
        <div className="composer-toolbar">
          <label className="composer-select composer-model">
            <span>{t("pane.model")}</span>
            <select
              ref={modelSelect}
              value={pane.model ?? ""}
              onChange={(event) => onModelChange?.(event.target.value)}
              disabled={disabled || pane.status === "Running"}
              aria-label={t("pane.model")}
              title={t("pane.model")}
            >
              <option value="">{t("pane.codexDefault")}</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
          <label className="composer-select composer-reasoning">
            <span>{t("pane.reasoning")}</span>
            <select
              value={pane.reasoning ?? ""}
              onChange={(event) => onReasoningChange?.(event.target.value)}
              disabled={disabled || pane.status === "Running"}
              aria-label={t("pane.reasoning")}
              title={t("pane.reasoning")}
            >
              <option value="">{t("pane.modelDefault")}</option>
              {(selectedModel?.reasoningLevels ?? []).map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
          </label>
          <div className="composer-tool-group">
            <button
              type="button"
              className="composer-tool"
              aria-expanded={controlPanel === "codex"}
              aria-controls={`${pane.id}-codex-controls`}
              title={t("pane.codexControlsSummary")}
              onClick={() =>
                setControlPanel((current) =>
                  current === "codex" ? null : "codex",
                )
              }
            >
              <span aria-hidden="true">⚙</span>
              <span>{t("pane.codexControls")}</span>
            </button>
            <button
              type="button"
              className="composer-tool"
              aria-expanded={controlPanel === "workflow"}
              aria-controls={`${pane.id}-workflow-controls`}
              title={t("workflow.summary")}
              onClick={() =>
                setControlPanel((current) =>
                  current === "workflow" ? null : "workflow",
                )
              }
            >
              <span aria-hidden="true">⌘</span>
              <span>{t("workflow.title")}</span>
            </button>
          </div>
          <span
            className="composer-shortcut"
            title={
              sendMode === "enter"
                ? t("composer.enterHint")
                : t("composer.modifierHint")
            }
          >
            {sendMode === "enter"
              ? t("composer.enterHint")
              : t("composer.modifierHint")}
          </span>
        </div>

        {controlPanel === "codex" && (
          <section
            className="composer-popover"
            id={`${pane.id}-codex-controls`}
            aria-label={t("pane.codexControls")}
          >
            <div className="composer-popover-head">
              <div>
                <strong>{t("pane.codexControls")}</strong>
                <small>{t("pane.codexControlsSummary")}</small>
              </div>
              <button
                type="button"
                onClick={() => setControlPanel(null)}
                aria-label={t("common.close")}
                title={t("common.close")}
              >
                ×
              </button>
            </div>
            <div className="advanced-grid">
              <label className="working-directory-field">
                {t("pane.workingDirectory")}
                <input
                  value={pane.workingDirectory}
                  onChange={(event) =>
                    onWorkingDirectoryChange?.(event.target.value)
                  }
                  placeholder={t("pane.workingDirectoryPlaceholder")}
                  disabled={disabled || pane.status === "Running"}
                  aria-label={`${pane.title} ${t("pane.workingDirectory")}`}
                />
              </label>
              <label>
                {t("pane.approvalPolicy")}
                <select
                  value={pane.approvalPolicy ?? ""}
                  onChange={(event) =>
                    onApprovalPolicyChange?.(event.target.value)
                  }
                  disabled={disabled || pane.status === "Running"}
                  aria-label={`${pane.title} ${t("pane.approvalPolicy")}`}
                >
                  <option value="">{t("pane.codexDefault")}</option>
                  <option value="untrusted">{t("pane.untrustedOnly")}</option>
                  <option value="on-request">{t("pane.onRequest")}</option>
                  <option value="never">{t("pane.neverAsk")}</option>
                </select>
              </label>
              <label>
                {t("pane.sandbox")}
                <select
                  value={pane.sandboxMode ?? ""}
                  onChange={(event) =>
                    onSandboxModeChange?.(event.target.value)
                  }
                  disabled={disabled || pane.status === "Running"}
                  aria-label={`${pane.title} ${t("pane.sandbox")}`}
                >
                  <option value="">{t("pane.codexDefault")}</option>
                  <option value="read-only">{t("pane.readOnly")}</option>
                  <option value="workspace-write">
                    {t("pane.workspaceWrite")}
                  </option>
                  <option value="danger-full-access">
                    {t("pane.dangerFullAccess")}
                  </option>
                </select>
              </label>
              <label>
                {t("pane.personality")}
                <select
                  value={pane.personality ?? ""}
                  onChange={(event) =>
                    onPersonalityChange?.(event.target.value)
                  }
                  disabled={
                    disabled ||
                    pane.status === "Running" ||
                    selectedModel?.supportsPersonality === false
                  }
                  aria-label={`${pane.title} ${t("pane.personality")}`}
                >
                  <option value="">{t("pane.codexDefault")}</option>
                  <option value="none">{t("common.none")}</option>
                  <option value="friendly">{t("pane.friendly")}</option>
                  <option value="pragmatic">{t("pane.pragmatic")}</option>
                </select>
              </label>
              <label>
                {t("pane.reasoningSummary")}
                <select
                  value={pane.reasoningSummary ?? ""}
                  onChange={(event) =>
                    onReasoningSummaryChange?.(event.target.value)
                  }
                  disabled={disabled || pane.status === "Running"}
                  aria-label={`${pane.title} ${t("pane.reasoningSummary")}`}
                >
                  <option value="">{t("pane.codexDefault")}</option>
                  <option value="none">{t("pane.off")}</option>
                  <option value="auto">{t("pane.auto")}</option>
                  <option value="concise">{t("pane.concise")}</option>
                  <option value="detailed">{t("pane.detailed")}</option>
                </select>
              </label>
              <label className="service-tier-field">
                {t("pane.serviceTier")}
                <select
                  value={pane.serviceTier ?? ""}
                  onChange={(event) =>
                    onServiceTierChange?.(event.target.value)
                  }
                  disabled={
                    disabled ||
                    pane.status === "Running" ||
                    !selectedModel?.serviceTiers?.length
                  }
                  aria-label={`${pane.title} ${t("pane.serviceTier")}`}
                >
                  <option value="">{t("pane.modelDefault")}</option>
                  {(selectedModel?.serviceTiers ?? []).map((tier) => (
                    <option
                      key={tier.id}
                      value={tier.id}
                      title={tier.description}
                    >
                      {tier.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {pane.sandboxMode === "danger-full-access" && (
              <p className="danger-note" role="alert">
                {t("pane.dangerNote")}
              </p>
            )}
          </section>
        )}

        {controlPanel === "workflow" && (
          <section
            className="composer-popover"
            id={`${pane.id}-workflow-controls`}
            aria-label={t("workflow.title")}
          >
            <div className="composer-popover-head">
              <div>
                <strong>{t("workflow.title")}</strong>
                <small>{t("workflow.summary")}</small>
              </div>
              <button
                type="button"
                onClick={() => setControlPanel(null)}
                aria-label={t("common.close")}
                title={t("common.close")}
              >
                ×
              </button>
            </div>
            <div className="workflow-body">
              <div className="review-target-row">
                <label>
                  {t("workflow.reviewTarget")}
                  <select
                    value={reviewKind}
                    onChange={(event) => {
                      setReviewKind(
                        event.target.value as CodexReviewTarget["type"],
                      );
                      setReviewValue("");
                    }}
                    disabled={workflowDisabled}
                    aria-label={`${pane.title} ${t("workflow.reviewTarget")}`}
                  >
                    <option value="uncommittedChanges">
                      {t("workflow.workingTree")}
                    </option>
                    <option value="baseBranch">
                      {t("workflow.baseBranch")}
                    </option>
                    <option value="commit">{t("workflow.commit")}</option>
                    <option value="custom">{t("workflow.custom")}</option>
                  </select>
                </label>
                {reviewKind !== "uncommittedChanges" && (
                  <label>
                    {reviewKind === "baseBranch"
                      ? t("workflow.branch")
                      : reviewKind === "commit"
                        ? t("workflow.commitSha")
                        : t("workflow.instructions")}
                    <input
                      value={reviewValue}
                      onChange={(event) => setReviewValue(event.target.value)}
                      placeholder={
                        reviewKind === "baseBranch"
                          ? "main"
                          : reviewKind === "commit"
                            ? "abc1234"
                            : t("workflow.instructionsPlaceholder")
                      }
                      disabled={workflowDisabled}
                    />
                  </label>
                )}
              </div>
              <div className="workflow-actions">
                <button
                  className="secondary compact"
                  type="button"
                  disabled={workflowDisabled || !reviewTarget}
                  onClick={() => reviewTarget && onStartReview?.(reviewTarget)}
                >
                  ◎ {t("workflow.startReview")}
                </button>
                <button
                  className="secondary compact"
                  type="button"
                  disabled={workflowDisabled}
                  onClick={onPreparePullRequest}
                >
                  ⇧ {t("workflow.preparePr")}
                </button>
              </div>
              <p>{t("workflow.prGuard")}</p>
            </div>
          </section>
        )}

      </form>
        </>
      ) : (
        <div className="pane-empty-session">
          <button
            className="pane-session-start"
            type="button"
            onClick={onStartSession}
            aria-label={t("pane.startSession")}
            disabled={disabled}
          >
            <PlusIcon />
            <strong>{t("pane.startSession")}</strong>
          </button>
          <div>
            <strong>{t("pane.emptySessionTitle")}</strong>
            <p>{t("pane.emptySessionBody")}</p>
          </div>
        </div>
      )}
    </section>
  );
}
export function PaneGrid({
  children,
  layout = "split-2",
}: {
  children: ReactNode;
  layout?: PaneLayout;
}) {
  return (
    <main className="pane-grid" data-layout={layout}>
      {children}
    </main>
  );
}

export function HistoryDrawer({
  open,
  connected,
  loading = false,
  detailLoading = false,
  error,
  threads,
  nextCursor,
  expandedThreadId,
  expandedEvents,
  selectedPaneId,
  targetPanes,
  assignedPanes = {},
  onClose,
  onSearch,
  onRefresh,
  onLoadMore,
  onToggleThread,
  onSelectPane,
  onContinue,
}: HistoryDrawerProps) {
  const { language, locale, t } = useI18n();
  const [query, setQuery] = useState("");
  const selectedTarget =
    targetPanes.find((pane) => pane.id === selectedPaneId) ?? targetPanes[0];
  const selectedPaneTitle = selectedTarget?.title ?? t("pane.newChat");
  const canContinue = Boolean(selectedTarget) && !selectedTarget.busy;
  if (!open) return null;
  return (
    <div
      className="history-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside
        className="history-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
      >
        <div className="history-head">
          <div>
            <span className="section-kicker">{t("history.kicker")}</span>
            <h2 id="history-title">{t("history.title")}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </div>
        <form
          className="history-search"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch(query);
          }}
        >
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("history.searchPlaceholder")}
            aria-label={t("history.searchLabel")}
            disabled={!connected}
          />
          <button
            className="primary compact"
            type="submit"
            disabled={!connected}
          >
            {t("history.search")}
          </button>
          <button
            className="secondary compact"
            type="button"
            onClick={onRefresh}
            disabled={!connected || loading}
            aria-label={t("history.refresh")}
          >
            ↻
          </button>
        </form>
        <label className="history-target">
          <span>{t("history.target")}</span>
          <select
            value={selectedTarget?.id ?? ""}
            onChange={(event) => onSelectPane(event.target.value)}
            aria-label={t("history.targetLabel")}
            disabled={detailLoading || targetPanes.length === 0}
          >
            {targetPanes.map((pane) => (
              <option key={pane.id} value={pane.id}>
                {pane.title}
                {pane.busy ? ` (${t("history.running")})` : ""}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <div className="error-box" role="alert">
            × {error}
          </div>
        )}
        <div className="history-list" aria-live="polite">
          {loading && threads.length === 0 ? (
            <div className="history-empty">{t("history.loading")}</div>
          ) : threads.length === 0 ? (
            <div className="history-empty">
              {connected ? t("history.empty") : t("history.connectFirst")}
            </div>
          ) : (
            threads.map((thread) => {
              const expanded = expandedThreadId === thread.id;
              const assignedPane = assignedPanes[thread.id];
              return (
                <article
                  className={`history-card ${expanded ? "expanded" : ""}`}
                  key={thread.id}
                >
                  <button
                    type="button"
                    className="history-card-toggle"
                    onClick={() => onToggleThread(thread.id)}
                    aria-expanded={expanded}
                  >
                    <span>
                      <strong>
                        {thread.name || thread.preview || t("history.untitled")}
                      </strong>
                      <small>
                        {formatHistoryTime(
                          thread.updatedAt,
                          locale,
                          t("history.unknownDate"),
                        )}
                        {thread.source ? ` · ${thread.source}` : ""}
                        {thread.status ? ` · ${thread.status}` : ""}
                      </small>
                    </span>
                    <i aria-hidden="true">{expanded ? "⌃" : "⌄"}</i>
                  </button>
                  {thread.name && thread.preview && (
                    <p className="history-preview">{thread.preview}</p>
                  )}
                  {thread.cwd && (
                    <code className="history-cwd">{thread.cwd}</code>
                  )}
                  {expanded && (
                    <div className="history-detail">
                      {detailLoading ? (
                        <p>{t("history.detailLoading")}</p>
                      ) : expandedEvents?.length ? (
                        expandedEvents.map((event) => (
                          <div
                            className={`history-event event-${event.kind}`}
                            key={event.id}
                          >
                            <strong>
                              {localizeEventTitle(language, event.title)}
                            </strong>
                            {event.detail && <p>{event.detail}</p>}
                          </div>
                        ))
                      ) : (
                        <p>{t("history.noItems")}</p>
                      )}
                    </div>
                  )}
                  <div className="history-card-actions">
                    {assignedPane && (
                      <span>{t("history.openIn", { pane: assignedPane })}</span>
                    )}
                    <button
                      type="button"
                      className="secondary compact"
                      onClick={() => onContinue(thread)}
                      disabled={
                        !assignedPane && (!canContinue || detailLoading)
                      }
                    >
                      {assignedPane
                        ? t("history.showPane", { pane: assignedPane })
                        : t("history.continueIn", {
                            pane: selectedPaneTitle,
                          })}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
        {nextCursor && (
          <button
            type="button"
            className="secondary history-more"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? t("history.loading") : t("history.loadMore")}
          </button>
        )}
      </aside>
    </div>
  );
}
export function SettingsModal({
  open,
  codexPath,
  connected,
  connecting,
  version = "—",
  authStatus = "Unknown",
  connectionError,
  usage,
  fontScale = 1,
  fontScaleMin = 0.9,
  fontScaleMax = 2,
  fontScaleStep = 0.1,
  theme = "aurora",
  language = "en",
  sendMode = "modifier-enter",
  onClose,
  onChooseExecutable,
  onAutoDetect,
  onTestConnection,
  onDisconnect,
  onRefreshModels,
  onRefreshUsage,
  onFontScaleChange,
  onThemeChange,
  onLanguageChange,
  onSendModeChange,
}: SettingsProps) {
  const { t } = useI18n();
  const authStatusLabel =
    authStatus === "Sign-in required"
      ? t("auth.signInRequired")
      : authStatus === "Not required"
        ? t("auth.notRequired")
        : authStatus === "ChatGPT available"
          ? t("auth.chatgptAvailable")
          : authStatus === "API key available"
            ? t("auth.apiKeyAvailable")
            : authStatus === "Amazon Bedrock available"
              ? t("auth.bedrockAvailable")
              : authStatus === "Preview"
                ? t("auth.preview")
                : authStatus === "Unknown"
                  ? t("common.unknown")
                  : authStatus;
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="modal-head">
          <h2 id="settings-title">{t("settings.title")}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </div>
        <label>
          {t("settings.codexExecutable")}
          <input
            value={codexPath}
            placeholder={t("settings.codexPathPlaceholder")}
            readOnly
            aria-readonly="true"
          />
        </label>
        <p className="field-help">
          {t("settings.executableHelp")} <code>app-server</code>
        </p>
        <div className="settings-actions">
          <button
            className="secondary"
            onClick={onAutoDetect}
            disabled={connecting}
          >
            ⌕ {t("settings.autoDetect")}
          </button>
          <button
            className="secondary"
            onClick={onChooseExecutable}
            disabled={connecting}
          >
            … {t("settings.chooseExecutable")}
          </button>
          <button
            className="primary"
            onClick={onTestConnection}
            disabled={connecting}
          >
            {connecting ? t("settings.testing") : t("settings.testConnection")}
          </button>
          {connected && onDisconnect && (
            <button className="secondary" onClick={onDisconnect}>
              {t("settings.disconnect")}
            </button>
          )}
        </div>
        {connectionError && (
          <div className="error-box" role="alert">
            × {connectionError}
          </div>
        )}
        <div className="connection-details" aria-label={t("settings.status")}>
          <div className="connection-status-list">
            <span className="connection-detail">
              <span>TamaGrid</span> <b>{packageMetadata.version}</b>
            </span>
            <span className="connection-detail">
              <span>Codex</span> <b>{version}</b>
            </span>
            <span className="connection-detail">
              <span>{t("settings.appServer")}</span>{" "}
              <b>
                {connecting
                  ? t("common.starting")
                  : connected
                    ? t("common.ready")
                    : t("common.offline")}
              </b>
            </span>
            <span className="connection-detail">
              <span>{t("settings.authentication")}</span>{" "}
              <b>{authStatusLabel}</b>
            </span>
          </div>
          <div
            className="connection-language-options"
            role="radiogroup"
            aria-label={t("settings.languageTitle")}
          >
            {(["en", "ja"] as const).map((option) => {
              const code = option === "en" ? "EN" : "JP";
              const name =
                option === "en"
                  ? t("settings.english")
                  : t("settings.japanese");
              return (
                <button
                  key={option}
                  type="button"
                  className="connection-language-option"
                  aria-label={`${code} — ${name}`}
                  aria-pressed={language === option}
                  onClick={() => onLanguageChange?.(option)}
                >
                  {code}
                </button>
              );
            })}
          </div>
        </div>
        <section
          className="settings-section usage-section"
          aria-labelledby="usage-title"
        >
          <div className="settings-section-head">
            <div>
              <span className="section-kicker">
                {t("settings.usageKicker")}
              </span>
              <h3 id="usage-title">{t("settings.usageTitle")}</h3>
            </div>
            {onRefreshUsage && (
              <button
                className="secondary compact"
                onClick={onRefreshUsage}
                disabled={!connected || connecting}
              >
                ↻ {t("common.refresh")}
              </button>
            )}
          </div>
          {usage?.buckets.length ? (
            <div className="usage-buckets">
              {usage.buckets.map((bucket) => (
                <article className="usage-card" key={bucket.id}>
                  <div className="usage-card-head">
                    <strong>{bucket.label}</strong>
                    {bucket.planType && <span>{bucket.planType}</span>}
                  </div>
                  {bucket.primary && (
                    <UsageBar
                      label={t("usage.primary")}
                      window={bucket.primary}
                    />
                  )}
                  {bucket.secondary && (
                    <UsageBar
                      label={t("usage.secondary")}
                      window={bucket.secondary}
                    />
                  )}
                  {bucket.individualLimit && (
                    <div className="usage-meta-line">
                      <span>{t("usage.spendLimit")}</span>
                      <b>
                        {Math.round(bucket.individualLimit.remainingPercent)}%
                        {` ${t("usage.remaining")}`}
                      </b>
                    </div>
                  )}
                  {bucket.credits && (
                    <div className="usage-meta-line">
                      <span>{t("usage.credits")}</span>
                      <b>
                        {bucket.credits.unlimited
                          ? t("common.unlimited")
                          : (bucket.credits.balance ??
                            (bucket.credits.hasCredits
                              ? t("common.available")
                              : t("common.none")))}
                      </b>
                    </div>
                  )}
                  {bucket.spendControlReached && (
                    <p className="usage-warning">
                      {t("usage.spendControlReached")}
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="usage-unavailable">{t("usage.unavailable")}</p>
          )}
          {usage?.resetCredits !== undefined && (
            <p className="field-help">
              {t("settings.resetCredits")}: {usage.resetCredits}
            </p>
          )}
        </section>
        <section className="settings-section" aria-labelledby="font-size-title">
          <div className="settings-section-head">
            <div>
              <span className="section-kicker">
                {t("settings.accessibility")}
              </span>
              <h3 id="font-size-title">{t("settings.fontTitle")}</h3>
            </div>
            <output className="font-scale-output" htmlFor="font-scale-slider">
              {Math.round(fontScale * 100)}%
            </output>
          </div>
          <div className="font-scale-settings">
            <button
              className="secondary compact"
              type="button"
              onClick={() => onFontScaleChange?.(fontScale - fontScaleStep)}
              disabled={!onFontScaleChange || fontScale <= fontScaleMin}
              aria-label={t("font.smaller")}
            >
              A−
            </button>
            <input
              id="font-scale-slider"
              type="range"
              min={fontScaleMin}
              max={fontScaleMax}
              step={fontScaleStep}
              value={fontScale}
              onChange={(event) =>
                onFontScaleChange?.(Number(event.target.value))
              }
              aria-label={t("font.label")}
            />
            <button
              className="secondary compact"
              type="button"
              onClick={() => onFontScaleChange?.(fontScale + fontScaleStep)}
              disabled={!onFontScaleChange || fontScale >= fontScaleMax}
              aria-label={t("font.larger")}
            >
              A+
            </button>
          </div>
          <p className="field-help">{t("settings.fontHelp")}</p>
        </section>
        <section className="settings-section" aria-labelledby="send-mode-title">
          <div className="settings-section-head">
            <div>
              <span className="section-kicker">COMPOSER</span>
              <h3 id="send-mode-title">{t("settings.sendModeTitle")}</h3>
            </div>
          </div>
          <div
            className="send-mode-options"
            role="radiogroup"
            aria-label={t("settings.sendModeTitle")}
          >
            <button
              type="button"
              className="send-mode-option"
              aria-label={t("settings.enterToSend")}
              aria-pressed={sendMode === "enter"}
              onClick={() => onSendModeChange?.("enter")}
            >
              <kbd>Enter</kbd>
              <span>
                <strong>{t("settings.enterToSend")}</strong>
                <small>{t("settings.shiftEnterNewline")}</small>
              </span>
            </button>
            <button
              type="button"
              className="send-mode-option"
              aria-label={t("settings.modifierToSend")}
              aria-pressed={sendMode === "modifier-enter"}
              onClick={() => onSendModeChange?.("modifier-enter")}
            >
              <kbd>⌘/Ctrl</kbd>
              <span>
                <strong>{t("settings.modifierToSend")}</strong>
                <small>{t("settings.enterNewline")}</small>
              </span>
            </button>
          </div>
          <p className="field-help">{t("settings.sendModeHelp")}</p>
        </section>
        <section className="settings-section" aria-labelledby="theme-title">
          <div className="settings-section-head">
            <div>
              <span className="section-kicker">{t("settings.appearance")}</span>
              <h3 id="theme-title">{t("settings.themeTitle")}</h3>
            </div>
          </div>
          <div
            className="theme-options"
            role="radiogroup"
            aria-label={t("theme.label")}
          >
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className="theme-option"
                data-theme-option={option.id}
                aria-pressed={theme === option.id}
                onClick={() => onThemeChange?.(option.id)}
              >
                <span className="theme-swatch" aria-hidden="true" />
                <span>
                  <strong>{option.label}</strong>
                  <small>{t(option.descriptionKey)}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
        <button
          className="secondary"
          onClick={onRefreshModels}
          disabled={!connected || connecting}
        >
          ↻ {t("settings.refreshModels")}
        </button>
        <p className="privacy-note">{t("settings.privacy")}</p>
      </div>
    </div>
  );
}

const THEME_OPTIONS: Array<{
  id: AppTheme;
  label: string;
  descriptionKey:
    | "theme.auroraDescription"
    | "theme.darkDescription"
    | "theme.lightDescription"
    | "theme.greenDescription";
}> = [
  { id: "aurora", label: "Aurora", descriptionKey: "theme.auroraDescription" },
  { id: "dark", label: "Dark", descriptionKey: "theme.darkDescription" },
  { id: "light", label: "Light", descriptionKey: "theme.lightDescription" },
  { id: "green", label: "Green", descriptionKey: "theme.greenDescription" },
];

function buildReviewTarget(
  type: CodexReviewTarget["type"],
  value: string,
): CodexReviewTarget | null {
  const trimmed = value.trim();
  if (type === "uncommittedChanges") return { type };
  if (!trimmed) return null;
  if (type === "baseBranch") return { type, branch: trimmed };
  if (type === "commit") return { type, sha: trimmed };
  return { type: "custom", instructions: trimmed };
}

function UsageBar({
  label,
  window,
}: {
  label: string;
  window: CodexUsageWindow;
}) {
  const { locale, t } = useI18n();
  const remaining = Math.round(window.remainingPercent);
  const reset = window.resetsAt
    ? formatResetTime(window.resetsAt, locale)
    : undefined;
  return (
    <div className={`usage-bar usage-${usageTone(remaining)}`}>
      <div>
        <span>
          {label}
          {window.windowDurationMins
            ? ` · ${formatWindowDuration(window.windowDurationMins)}`
            : ""}
        </span>
        <strong>
          {remaining}% {t("usage.remaining")}
        </strong>
      </div>
      <span className="usage-track" aria-hidden="true">
        <i style={{ width: `${remaining}%` }} />
      </span>
      {reset && (
        <small>
          {t("usage.reset")} {reset}
        </small>
      )}
    </div>
  );
}

function usageTone(
  remaining: number | undefined,
): "good" | "watch" | "low" | "unknown" {
  if (remaining === undefined) return "unknown";
  if (remaining > 50) return "good";
  if (remaining > 20) return "watch";
  return "low";
}

function formatResetTime(epochSeconds: number, locale: string): string {
  const date = new Date(epochSeconds * 1000);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatWindowDuration(minutes: number): string {
  if (minutes % 10_080 === 0) return `${minutes / 10_080}w`;
  if (minutes % 1_440 === 0) return `${minutes / 1_440}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

function formatHistoryTime(
  epochSeconds: number,
  locale: string,
  unknownDate: string,
): string {
  if (!epochSeconds) return unknownDate;
  const date = new Date(epochSeconds * 1000);
  if (Number.isNaN(date.getTime())) return unknownDate;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export type {
  AgentPaneProps,
  HeaderProps,
  HistoryDrawerProps,
  SettingsProps,
} from "./types";
