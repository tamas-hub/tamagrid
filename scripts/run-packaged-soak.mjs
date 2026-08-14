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
} finally {
  await removeExactTemporaryDirectory(resultDirectory);
}

function parseOptions(args) {
  let durationMs = 180_000;
  let maxFrameGapMs = 1_500;
  let target;
  let skipBuild = false;
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
  return { durationMs, maxFrameGapMs, target, skipBuild };
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
