import {
  accessSync,
  constants,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
} from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { basename, extname, join } from "node:path";
import { tmpdir } from "node:os";

const REQUIRED_CLIENT_METHODS = [
  "initialize",
  "account/read",
  "account/rateLimits/read",
  "model/list",
  "thread/list",
  "thread/start",
  "thread/resume",
  "thread/read",
  "thread/name/set",
  "turn/start",
  "turn/steer",
  "turn/interrupt",
  "review/start",
];
const REQUIRED_SERVER_REQUESTS = [
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
];
const REQUIRED_NOTIFICATIONS = [
  "error",
  "thread/name/updated",
  "turn/started",
  "turn/completed",
  "item/started",
  "item/completed",
  "item/agentMessage/delta",
  "item/commandExecution/outputDelta",
  "serverRequest/resolved",
  "account/rateLimits/updated",
];
const THREAD_SOURCE_KINDS = [
  "cli",
  "vscode",
  "exec",
  "appServer",
  "subAgent",
  "subAgentReview",
  "subAgentCompact",
  "subAgentThreadSpawn",
  "subAgentOther",
  "unknown",
];
const APPROVAL_POLICIES = ["untrusted", "on-request", "never"];
const SANDBOX_MODES = ["read-only", "workspace-write", "danger-full-access"];
const PERSONALITIES = ["none", "friendly", "pragmatic"];

function parseExplicitExecutable(argv) {
  if (argv.length === 0) return undefined;
  if (argv.length === 2 && argv[0] === "--codex") return argv[1];
  throw new Error("Usage: pnpm check:app-server-schema -- --codex <path>");
}

function nativeCodexCandidates(explicit) {
  if (explicit) return [explicit];
  if (process.env.TAMAGRID_CODEX_EXECUTABLE)
    return [process.env.TAMAGRID_CODEX_EXECUTABLE];
  if (process.platform === "win32") {
    const npmCodexRoot = process.env.APPDATA
      ? join(
          process.env.APPDATA,
          "npm",
          "node_modules",
          "@openai",
          "codex",
          "node_modules",
        )
      : undefined;
    const vendorCandidates = npmCodexRoot
      ? [
          join(
            npmCodexRoot,
            "@openai",
            "codex-win32-x64",
            "vendor",
            "x86_64-pc-windows-msvc",
            "bin",
            "codex.exe",
          ),
          join(
            npmCodexRoot,
            "@openai",
            "codex-win32-arm64",
            "vendor",
            "aarch64-pc-windows-msvc",
            "bin",
            "codex.exe",
          ),
        ]
      : [];
    let result = "";
    try {
      result = execFileSync("where.exe", ["codex"], {
        encoding: "utf8",
        windowsHide: true,
      });
    } catch {
      // The fixed vendor paths above may still be valid when PATH has no Codex.
    }
    return [
      ...vendorCandidates,
      ...result
        .split(/\r?\n/u)
        .map((value) => value.trim())
        .filter((value) => extname(value).toLowerCase() === ".exe"),
    ];
  }
  try {
    return [execFileSync("which", ["codex"], { encoding: "utf8" }).trim()];
  } catch {
    return [];
  }
}

function resolveCodexExecutable(explicit) {
  for (const candidate of nativeCodexCandidates(explicit)) {
    if (!candidate || !existsSync(candidate)) continue;
    const resolved = realpathSync(candidate);
    if (!statSync(resolved).isFile()) continue;
    if (
      process.platform === "win32" &&
      extname(resolved).toLowerCase() !== ".exe"
    )
      continue;
    accessSync(resolved, constants.R_OK);
    try {
      const rawVersion = runCodex(resolved, ["--version"], 10_000)
        .split(/\r?\n/u)[0]
        .slice(0, 160);
      const version = rawVersion.match(
        /(?:codex-cli|codex)\s+\d+(?:\.\d+){1,3}(?:[-+][a-z0-9.-]+)?/iu,
      )?.[0];
      return { executable: resolved, version };
    } catch {
      if (explicit) break;
    }
  }
  throw new Error(
    "A Codex executable was not found. Set TAMAGRID_CODEX_EXECUTABLE or pass --codex <path>.",
  );
}

function runCodex(executable, args, timeout) {
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    timeout,
    maxBuffer: 1024 * 1024,
  });
  if (result.error)
    throw new Error(`Codex command failed: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(
      `Codex command exited with status ${result.status ?? "unknown"}`,
    );
  return result.stdout.trim();
}

function readJson(schemaRoot, relativePath) {
  return JSON.parse(readFileSync(join(schemaRoot, relativePath), "utf8"));
}

function collectMethods(value, methods = new Set()) {
  if (!value || typeof value !== "object") return methods;
  const method = value.properties?.method;
  if (typeof method?.const === "string") methods.add(method.const);
  if (Array.isArray(method?.enum)) {
    for (const entry of method.enum)
      if (typeof entry === "string") methods.add(entry);
  }
  for (const entry of Object.values(value)) collectMethods(entry, methods);
  return methods;
}

function assertIncludesAll(actual, expected, label) {
  const missing = expected.filter((entry) => !actual.has(entry));
  if (missing.length > 0)
    throw new Error(`${label} is missing: ${missing.join(", ")}`);
}

function collectEnumValues(value, values = new Set()) {
  if (!value || typeof value !== "object") return values;
  if (typeof value.const === "string") values.add(value.const);
  if (Array.isArray(value.enum)) {
    for (const entry of value.enum)
      if (typeof entry === "string") values.add(entry);
  }
  for (const entry of Object.values(value)) collectEnumValues(entry, values);
  return values;
}

function assertEnumIncludes(schema, expected, label) {
  const actual = collectEnumValues(schema);
  const missing = expected.filter((entry) => !actual.has(entry));
  if (missing.length > 0)
    throw new Error(`${label} changed or removed: ${missing.join(", ")}`);
}

function assertProperties(schema, expected, label) {
  const actual = new Set(Object.keys(schema.properties ?? {}));
  const missing = expected.filter((entry) => !actual.has(entry));
  if (missing.length > 0)
    throw new Error(
      `${label} fields changed or removed: ${missing.join(", ")}`,
    );
}

const explicit = parseExplicitExecutable(process.argv.slice(2));
const resolvedCodex = resolveCodexExecutable(explicit);
const executable = resolvedCodex.executable;
const temporaryRoot = mkdtempSync(
  join(tmpdir(), "tamagrid-app-server-schema-"),
);
try {
  runCodex(
    executable,
    ["app-server", "generate-json-schema", "--out", temporaryRoot],
    30_000,
  );

  const clientMethods = collectMethods(
    readJson(temporaryRoot, "ClientRequest.json"),
  );
  const serverRequests = collectMethods(
    readJson(temporaryRoot, "ServerRequest.json"),
  );
  const notifications = collectMethods(
    readJson(temporaryRoot, "ServerNotification.json"),
  );
  assertIncludesAll(clientMethods, REQUIRED_CLIENT_METHODS, "Client API");
  assertIncludesAll(serverRequests, REQUIRED_SERVER_REQUESTS, "Approval API");
  assertIncludesAll(notifications, REQUIRED_NOTIFICATIONS, "Notification API");

  const modelList = readJson(temporaryRoot, "v2/ModelListParams.json");
  assertProperties(
    modelList,
    ["cursor", "includeHidden", "limit"],
    "model/list",
  );

  const accountRead = readJson(temporaryRoot, "v2/GetAccountParams.json");
  assertProperties(accountRead, ["refreshToken"], "account/read");

  const threadList = readJson(temporaryRoot, "v2/ThreadListParams.json");
  assertProperties(
    threadList,
    [
      "cursor",
      "limit",
      "sortKey",
      "sortDirection",
      "archived",
      "sourceKinds",
      "searchTerm",
    ],
    "thread/list",
  );
  assertEnumIncludes(
    threadList.definitions?.ThreadSortKey,
    ["updated_at"],
    "thread/list sort key",
  );
  assertEnumIncludes(
    threadList.definitions?.SortDirection,
    ["desc"],
    "thread/list sort direction",
  );
  assertEnumIncludes(
    threadList.definitions?.ThreadSourceKind,
    THREAD_SOURCE_KINDS,
    "thread/list source kinds",
  );

  const threadStart = readJson(temporaryRoot, "v2/ThreadStartParams.json");
  assertProperties(
    threadStart,
    [
      "model",
      "cwd",
      "serviceTier",
      "approvalPolicy",
      "sandbox",
      "personality",
      "ephemeral",
      "serviceName",
    ],
    "thread/start",
  );
  assertEnumIncludes(
    threadStart.definitions?.AskForApproval,
    APPROVAL_POLICIES,
    "thread/start approval policy",
  );
  assertEnumIncludes(
    threadStart.definitions?.SandboxMode,
    SANDBOX_MODES,
    "thread/start sandbox",
  );
  assertEnumIncludes(
    threadStart.definitions?.Personality,
    PERSONALITIES,
    "thread/start personality",
  );

  const threadResume = readJson(temporaryRoot, "v2/ThreadResumeParams.json");
  assertProperties(
    threadResume,
    [
      "threadId",
      "model",
      "cwd",
      "serviceTier",
      "approvalPolicy",
      "sandbox",
      "personality",
    ],
    "thread/resume",
  );
  assertProperties(
    readJson(temporaryRoot, "v2/ThreadReadParams.json"),
    ["threadId", "includeTurns"],
    "thread/read",
  );
  assertProperties(
    readJson(temporaryRoot, "v2/ThreadSetNameParams.json"),
    ["threadId", "name"],
    "thread/name/set",
  );

  const turnStart = readJson(temporaryRoot, "v2/TurnStartParams.json");
  assertProperties(
    turnStart,
    [
      "threadId",
      "input",
      "model",
      "cwd",
      "effort",
      "serviceTier",
      "approvalPolicy",
      "sandboxPolicy",
      "summary",
      "personality",
    ],
    "turn/start",
  );
  assertEnumIncludes(
    turnStart.definitions?.AskForApproval,
    APPROVAL_POLICIES,
    "turn/start approval policy",
  );
  assertEnumIncludes(
    turnStart.definitions?.SandboxPolicy,
    ["readOnly", "workspaceWrite", "dangerFullAccess"],
    "turn/start sandbox policy",
  );
  assertEnumIncludes(
    turnStart.definitions?.ReasoningSummary,
    ["none", "auto", "concise", "detailed"],
    "turn/start reasoning summary",
  );
  assertEnumIncludes(
    turnStart.definitions?.Personality,
    PERSONALITIES,
    "turn/start personality",
  );
  assertEnumIncludes(
    turnStart.definitions?.UserInput,
    ["text"],
    "turn/start user input",
  );
  assertProperties(
    readJson(temporaryRoot, "v2/TurnSteerParams.json"),
    ["threadId", "expectedTurnId", "input"],
    "turn/steer",
  );
  assertProperties(
    readJson(temporaryRoot, "v2/TurnInterruptParams.json"),
    ["threadId", "turnId"],
    "turn/interrupt",
  );

  const reviewStart = readJson(temporaryRoot, "v2/ReviewStartParams.json");
  assertProperties(
    reviewStart,
    ["threadId", "delivery", "target"],
    "review/start",
  );
  assertEnumIncludes(
    reviewStart.definitions?.ReviewDelivery,
    ["inline"],
    "review/start delivery",
  );
  assertEnumIncludes(
    reviewStart.definitions?.ReviewTarget,
    ["uncommittedChanges", "baseBranch", "commit", "custom"],
    "review/start target",
  );

  assertEnumIncludes(
    readJson(temporaryRoot, "CommandExecutionRequestApprovalResponse.json")
      .definitions?.CommandExecutionApprovalDecision,
    ["accept", "decline"],
    "command approval response",
  );
  assertEnumIncludes(
    readJson(temporaryRoot, "FileChangeRequestApprovalResponse.json")
      .definitions?.FileChangeApprovalDecision,
    ["accept", "decline"],
    "file approval response",
  );

  console.log("App Server schema compatibility check passed.");
  console.log(`Codex: ${resolvedCodex.version || basename(executable)}`);
  console.log(`Client methods checked: ${REQUIRED_CLIENT_METHODS.length}`);
  console.log(`Server requests checked: ${REQUIRED_SERVER_REQUESTS.length}`);
  console.log(`Notifications checked: ${REQUIRED_NOTIFICATIONS.length}`);
} finally {
  if (
    basename(temporaryRoot).startsWith("tamagrid-app-server-schema-") &&
    temporaryRoot.startsWith(tmpdir())
  )
    rmSync(temporaryRoot, { recursive: true, force: true });
}
