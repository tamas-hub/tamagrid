import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

const repository = realpathSync(process.cwd());

function git(args) {
  return execFileSync("git", ["-c", `safe.directory=${repository}`, ...args], {
    cwd: repository,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function gitOptional(args) {
  try {
    return git(args);
  } catch (error) {
    if (error?.status === 1) return "";
    throw error;
  }
}

function main() {
  const configuredHooksPath = gitOptional([
    "config",
    "--local",
    "--get",
    "core.hooksPath",
  ]);
  if (configuredHooksPath) {
    throw new Error("A custom hooks path is already configured.");
  }

  const commonDirectory = realpathSync(
    resolve(repository, git(["rev-parse", "--git-common-dir"])),
  );
  const hooksDirectory = resolve(
    repository,
    git(["rev-parse", "--git-path", "hooks"]),
  );
  const relativeHooksDirectory = relative(commonDirectory, hooksDirectory);
  if (
    relativeHooksDirectory.startsWith("..") ||
    isAbsolute(relativeHooksDirectory)
  ) {
    throw new Error("Git hooks directory is outside the repository metadata.");
  }

  const source = resolve(repository, ".githooks", "pre-push");
  const destination = resolve(hooksDirectory, "pre-push");
  const expected = readFileSync(source);

  mkdirSync(hooksDirectory, { recursive: true });
  try {
    const existing = lstatSync(destination);
    if (!existing.isFile() || existing.isSymbolicLink()) {
      throw new Error("Existing pre-push hook is not a regular file.");
    }
    const current = readFileSync(destination);
    if (!current.equals(expected)) {
      throw new Error("Existing pre-push hook must be preserved.");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    copyFileSync(source, destination);
  }

  chmodSync(destination, 0o755);
  console.log("TamaGrid Git metadata privacy hook is active for this clone.");
}

try {
  main();
} catch {
  console.error(
    "Privacy hook installation stopped safely. An existing hook or custom hooks path was not overwritten.",
  );
  process.exit(1);
}
