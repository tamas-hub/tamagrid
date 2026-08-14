import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const options = parseOptions(process.argv.slice(2));
if (!new Set(["win32", "darwin"]).has(process.platform)) {
  throw new Error(
    "The packaged WebView soak currently supports Windows and macOS",
  );
}

const temporaryRoot = resolve(tmpdir());
const resultDirectory = await mkdtemp(
  join(temporaryRoot, "tamagrid-packaged-soak-"),
);
const resultPath = join(resultDirectory, "result.json");
const processTreeResultPath = join(resultDirectory, "process-tree.json");
const tauriCli = join(root, "node_modules", "@tauri-apps", "cli", "tauri.js");

try {
  await access(tauriCli);
  if (!options.skipBuild) {
    const buildArguments = [
      tauriCli,
      "build",
      "--no-bundle",
      "--features",
      "packaged-soak-test",
      "--config",
      "src-tauri/tauri.soak.conf.json",
    ];
    if (options.target) buildArguments.push("--target", options.target);
    await runProcess(process.execPath, buildArguments, {
      ...process.env,
      VITE_TAMAGRID_SOAK: "1",
      VITE_TAMAGRID_SOAK_DURATION_MS: String(options.durationMs),
      VITE_TAMAGRID_SOAK_MAX_FRAME_GAP_MS: String(options.maxFrameGapMs),
    });

    if (process.platform === "win32" && !options.skipProcessTreeCrash) {
      const fixtureBuildArguments = [
        "build",
        "--manifest-path",
        join(root, "src-tauri", "Cargo.toml"),
        "--release",
        "--features",
        "packaged-soak-test",
        "--bin",
        "tamagrid-process-tree-fixture",
      ];
      if (options.target)
        fixtureBuildArguments.push("--target", options.target);
      await runProcess("cargo", fixtureBuildArguments, process.env);
    }
  }

  const binary = join(
    root,
    "src-tauri",
    "target",
    ...(options.target ? [options.target] : []),
    "release",
    process.platform === "win32" ? "tamagrid.exe" : "tamagrid",
  );
  await access(binary);
  const exitCode = await runProcess(
    binary,
    [],
    {
      ...process.env,
      TAMAGRID_SOAK_RESULT_PATH: resultPath,
    },
    options.durationMs + 90_000,
  );
  const report = JSON.parse(await readFile(resultPath, "utf8"));
  if (exitCode !== 0 || report?.passed !== true) {
    process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
    throw new Error(`Packaged WebView soak failed with exit code ${exitCode}`);
  }

  process.stdout.write("Packaged Tauri Channel/WebView soak passed.\n");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (process.platform === "win32" && !options.skipProcessTreeCrash) {
    const fixtureBinary = join(
      root,
      "src-tauri",
      "target",
      ...(options.target ? [options.target] : []),
      "release",
      "tamagrid-process-tree-fixture.exe",
    );
    await access(fixtureBinary);
    const crashReport = await runProcessTreeCrashProbe(
      binary,
      fixtureBinary,
      processTreeResultPath,
      resultPath,
    );
    process.stdout.write(
      "Packaged forced-crash process-tree recovery passed.\n",
    );
    process.stdout.write(`${JSON.stringify(crashReport, null, 2)}\n`);
  } else if (process.platform === "darwin") {
    process.stdout.write(
      "Packaged forced-crash process-tree recovery is not yet enabled on macOS.\n",
    );
  }
} finally {
  await removeExactTemporaryDirectory(resultDirectory);
}

function parseOptions(args) {
  let durationMs = 180_000;
  let maxFrameGapMs = 1_500;
  let target;
  let skipBuild = false;
  let skipProcessTreeCrash = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") {
      continue;
    } else if (argument === "--duration-ms") {
      durationMs = Number(args[++index]);
    } else if (argument === "--max-frame-gap-ms") {
      maxFrameGapMs = Number(args[++index]);
    } else if (argument === "--target") {
      target = args[++index];
    } else if (argument === "--skip-build") {
      skipBuild = true;
    } else if (argument === "--skip-process-tree-crash") {
      skipProcessTreeCrash = true;
    } else {
      throw new Error(`Unknown packaged soak option: ${argument}`);
    }
  }
  if (
    !Number.isSafeInteger(durationMs) ||
    durationMs < 1_000 ||
    durationMs > 600_000
  ) {
    throw new Error("--duration-ms must be an integer from 1000 to 600000");
  }
  if (
    !Number.isSafeInteger(maxFrameGapMs) ||
    maxFrameGapMs < 250 ||
    maxFrameGapMs > 10_000
  ) {
    throw new Error("--max-frame-gap-ms must be an integer from 250 to 10000");
  }
  if (target !== undefined && !/^[a-zA-Z0-9_-]+$/.test(target)) {
    throw new Error("--target contains unsupported characters");
  }
  return {
    durationMs,
    maxFrameGapMs,
    target,
    skipBuild,
    skipProcessTreeCrash,
  };
}

async function runProcessTreeCrashProbe(
  binary,
  fixtureBinary,
  reportPath,
  unusedSoakResultPath,
) {
  const child = spawn(binary, [], {
    cwd: root,
    env: {
      ...process.env,
      TAMAGRID_SOAK_RESULT_PATH: unusedSoakResultPath,
      TAMAGRID_SOAK_PROCESS_TREE_FIXTURE_PATH: fixtureBinary,
      TAMAGRID_SOAK_PROCESS_TREE_RESULT_PATH: reportPath,
    },
    shell: false,
    stdio: "inherit",
    windowsHide: false,
  });
  let fixtureReport;
  let fixturePidsValidated = false;
  let probeCompleted = false;
  const startedAt = Date.now();
  try {
    fixtureReport = await waitForProcessTreeReport(reportPath, child, 60_000);
    const { parentPid, descendantPid } = fixtureReport;
    validateFixturePids(parentPid, descendantPid, child.pid);
    fixturePidsValidated = true;
    if (!isProcessRunning(parentPid) || !isProcessRunning(descendantPid)) {
      throw new Error(
        "The process-tree fixture was not fully running before the crash",
      );
    }

    const exit = waitForChildExit(child, 10_000);
    if (!child.kill("SIGKILL")) {
      throw new Error("Could not force-terminate the packaged soak process");
    }
    await exit;
    await waitForProcessesToExit([parentPid, descendantPid], 5_000);
    probeCompleted = true;
    return {
      passed: true,
      appPid: child.pid,
      parentPid,
      descendantPid,
      recoveryMs: Date.now() - startedAt,
    };
  } finally {
    if (isProcessRunning(child.pid)) {
      child.kill("SIGKILL");
      await waitForChildExit(child, 5_000).catch(() => undefined);
    }
    if (fixtureReport && fixturePidsValidated && !probeCompleted) {
      for (const pid of [
        fixtureReport.parentPid,
        fixtureReport.descendantPid,
      ]) {
        if (Number.isSafeInteger(pid) && pid > 0 && isProcessRunning(pid)) {
          try {
            process.kill(pid, "SIGKILL");
          } catch (error) {
            if (error?.code !== "ESRCH") throw error;
          }
        }
      }
    }
  }
}

async function waitForProcessTreeReport(path, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `Packaged soak exited before the process-tree report (code ${child.exitCode}, signal ${child.signalCode})`,
      );
    }
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      lastError = error;
      await delay(50);
    }
  }
  throw new Error(
    `Process-tree fixture did not report within ${timeoutMs} ms: ${lastError}`,
  );
}

function validateFixturePids(parentPid, descendantPid, appPid) {
  for (const [name, value] of [
    ["parentPid", parentPid],
    ["descendantPid", descendantPid],
  ]) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`The process-tree report has an invalid ${name}`);
    }
  }
  if (
    parentPid === descendantPid ||
    parentPid === appPid ||
    descendantPid === appPid ||
    parentPid === process.pid ||
    descendantPid === process.pid
  ) {
    throw new Error("The process-tree report contains overlapping PIDs");
  }
}

function isProcessRunning(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    throw error;
  }
}

async function waitForProcessesToExit(pids, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const running = pids.filter(isProcessRunning);
    if (running.length === 0) return;
    await delay(25);
  }
  const running = pids.filter(isProcessRunning);
  throw new Error(
    `Forced crash left process-tree fixture PIDs running: ${running.join(", ")}`,
  );
}

function waitForChildExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => {
      rejectPromise(
        new Error(
          `Process did not exit within ${timeoutMs} ms after termination`,
        ),
      );
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timer);
      rejectPromise(error);
    });
    child.once("exit", () => {
      clearTimeout(timer);
      resolvePromise();
    });
  });
}

function delay(milliseconds) {
  return new Promise((resolvePromise) =>
    setTimeout(resolvePromise, milliseconds),
  );
}

function runProcess(command, args, environment, timeoutMs) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: root,
      env: environment,
      shell: false,
      stdio: "inherit",
      windowsHide: false,
    });
    let timedOut = false;
    const timer =
      timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            child.kill();
          }, timeoutMs);
    child.once("error", (error) => {
      if (timer) clearTimeout(timer);
      rejectPromise(error);
    });
    child.once("exit", (code, signal) => {
      if (timer) clearTimeout(timer);
      if (timedOut) {
        rejectPromise(
          new Error(
            `Process exceeded the ${timeoutMs} ms packaged soak timeout`,
          ),
        );
        return;
      }
      if (signal) {
        rejectPromise(new Error(`Process exited after signal ${signal}`));
        return;
      }
      const exitCode = code ?? 1;
      if (timeoutMs === undefined && exitCode !== 0) {
        rejectPromise(
          new Error(`${basename(command)} exited with code ${exitCode}`),
        );
        return;
      }
      resolvePromise(exitCode);
    });
  });
}

async function removeExactTemporaryDirectory(path) {
  const resolved = resolve(path);
  if (
    dirname(resolved) !== temporaryRoot ||
    !basename(resolved).startsWith("tamagrid-packaged-soak-")
  ) {
    throw new Error(
      `Refusing to remove unexpected temporary path: ${resolved}`,
    );
  }
  await rm(resolved, { recursive: true, force: true });
}
