import type {
  CodexReviewTarget,
  CodexThreadSummary,
  CodexUsageSummary,
} from "../codex";
import type { AppLanguage } from "../i18n";

export type { AppLanguage } from "../i18n";

export type PaneStatus = "Running" | "Done" | "Approval" | "Idle" | "Error";
export type PaneLayout = "split-2" | "grid-4" | "columns-4" | "rows-4";
export type AppTheme = "aurora" | "dark" | "light" | "green";
export type ApprovalPolicy = "untrusted" | "on-request" | "never";
export type SandboxMode =
  "read-only" | "workspace-write" | "danger-full-access";
export type CodexPersonality = "none" | "friendly" | "pragmatic";
export type ReasoningSummary = "none" | "auto" | "concise" | "detailed";
export type ComposerSendMode = "modifier-enter" | "enter";
export type EventKind =
  "user" | "assistant" | "tool" | "file" | "error" | "progress";
export interface TimelineEvent {
  id: string;
  kind: EventKind;
  title: string;
  detail?: string;
  time?: string;
}
export interface AgentPaneData {
  id: string;
  threadId?: string;
  title: string;
  status: PaneStatus;
  workingDirectory: string;
  model?: string;
  reasoning?: string;
  serviceTier?: string;
  approvalPolicy?: ApprovalPolicy;
  sandboxMode?: SandboxMode;
  personality?: CodexPersonality;
  reasoningSummary?: ReasoningSummary;
  events: TimelineEvent[];
  approval?: {
    id: string;
    message: string;
    kind?: "command" | "file";
    reason?: string;
    command?: string;
    cwd?: string;
    network?: string;
    actions?: string;
    policyChange?: string;
    changes?: string;
    itemId?: string;
    canApprove: boolean;
  };
  error?: string;
  unavailableModel?: string;
}
export interface ModelOption {
  id: string;
  label: string;
  reasoningLevels?: string[];
  serviceTiers?: Array<{ id: string; name: string; description: string }>;
  supportsPersonality?: boolean;
}
export interface HeaderProps {
  connected?: boolean;
  connecting?: boolean;
  modelSource?: "live" | "cache" | "none";
  usage?: CodexUsageSummary | null;
  fontScale?: number;
  fontScaleMin?: number;
  fontScaleMax?: number;
  fontScaleStep?: number;
  layout?: PaneLayout;
  theme?: AppTheme;
  onSettings?: () => void;
  onHistory?: () => void;
  onLayoutChange?: (layout: PaneLayout) => void;
  onThemeChange?: (theme: AppTheme) => void;
  onRefresh?: () => void;
  onUsageOpen?: () => void;
  onFontScaleChange?: (scale: number) => void;
}
export interface AgentPaneProps {
  pane: AgentPaneData;
  models?: ModelOption[];
  onWorkingDirectoryChange?: (path: string) => void;
  titleValue?: string;
  onTitleChange?: (title: string) => void | Promise<void>;
  sendMode?: ComposerSendMode;
  onModelChange?: (id: string) => void;
  onReasoningChange?: (level: string) => void;
  onServiceTierChange?: (tier: string) => void;
  onApprovalPolicyChange?: (policy: string) => void;
  onSandboxModeChange?: (mode: string) => void;
  onPersonalityChange?: (personality: string) => void;
  onReasoningSummaryChange?: (summary: string) => void;
  onSend?: (message: string) => void;
  onSteer?: (message: string) => void;
  onStartReview?: (target: CodexReviewTarget) => void;
  onPreparePullRequest?: () => void;
  onStop?: () => void;
  onApproval?: (id: string, approved: boolean) => void;
  onUseDefaultModel?: () => void;
  onChooseModel?: () => void;
  selected?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
  runDisabled?: boolean;
  steerDisabled?: boolean;
  dragging?: boolean;
  dragOver?: boolean;
  onDragStart?: () => void;
  onDragOver?: () => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
  onMove?: (direction: -1 | 1) => void;
}
export interface SettingsProps {
  open: boolean;
  codexPath: string;
  connected?: boolean;
  connecting?: boolean;
  version?: string;
  authStatus?: string;
  connectionError?: string;
  usage?: CodexUsageSummary | null;
  fontScale?: number;
  fontScaleMin?: number;
  fontScaleMax?: number;
  fontScaleStep?: number;
  theme?: AppTheme;
  language?: AppLanguage;
  sendMode?: ComposerSendMode;
  onClose: () => void;
  onChooseExecutable: () => void;
  onAutoDetect: () => void;
  onTestConnection: () => void;
  onDisconnect?: () => void;
  onRefreshModels: () => void;
  onRefreshUsage?: () => void;
  onFontScaleChange?: (scale: number) => void;
  onThemeChange?: (theme: AppTheme) => void;
  onLanguageChange?: (language: AppLanguage) => void;
  onSendModeChange?: (mode: ComposerSendMode) => void;
}

export interface HistoryDrawerProps {
  open: boolean;
  connected: boolean;
  loading?: boolean;
  detailLoading?: boolean;
  error?: string;
  threads: CodexThreadSummary[];
  nextCursor?: string | null;
  expandedThreadId?: string;
  expandedEvents?: TimelineEvent[];
  selectedPaneTitle: string;
  canContinue: boolean;
  assignedPanes?: Record<string, string>;
  onClose: () => void;
  onSearch: (query: string) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onToggleThread: (threadId: string) => void;
  onContinue: (thread: CodexThreadSummary) => void;
}
