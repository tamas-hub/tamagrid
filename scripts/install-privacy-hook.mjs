import { execFileSync } from "node:child_process";
import {
  closeSync,
  constants,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  writeFileSync,
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
  let destinationDescriptor;
  try {
    destinationDescriptor = openSync(
      destination,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o755,
    );
    writeFileSync(destinationDescriptor, expected);
  } finally {
    if (destinationDescriptor !== undefined) {
      closeSync(destinationDescriptor);
    }
  }
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
