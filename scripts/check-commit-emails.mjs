import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";

const NOREPLY_PATTERNS = [
  /^noreply@github\.com$/i,
  /^[^@]+@users\.noreply\.github\.com$/i,
];
const OBJECT_ID_PATTERN = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i;
const ZERO_OBJECT_ID_PATTERN = /^0{40}(?:0{24})?$/;
const MAX_GIT_OUTPUT_BYTES = 64 * 1024 * 1024;

function isNoreplyAddress(address) {
  return NOREPLY_PATTERNS.some((pattern) => pattern.test(address));
}

const repository = realpathSync(process.cwd());

function git(args) {
  return execFileSync("git", ["-c", `safe.directory=${repository}`, ...args], {
    cwd: repository,
    encoding: "utf8",
    maxBuffer: MAX_GIT_OUTPUT_BYTES,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function addCommitViolations(revisions, violations) {
  if (revisions.length === 0) return 0;

  const output = git(["log", "-z", "--format=%H%x00%ae%x00%ce", ...revisions]);
  const fields = output.split("\0").filter(Boolean);

  if (fields.length % 3 !== 0) {
    throw new Error("Unable to parse Git commit metadata safely.");
  }

  for (let index = 0; index < fields.length; index += 3) {
    const [commit, authorEmail, committerEmail] = fields.slice(
      index,
      index + 3,
    );
    if (!isNoreplyAddress(authorEmail)) {
      violations.push(
        `${commit}: author address is not a GitHub noreply address`,
      );
    }
    if (!isNoreplyAddress(committerEmail)) {
      violations.push(
        `${commit}: committer address is not a GitHub noreply address`,
      );
    }
  }

  return fields.length / 3;
}

function inspectAnnotatedTag(
  initialObjectId,
  label,
  commitRevisions,
  violations,
  inspectedTagObjects,
) {
  let objectId = initialObjectId;

  while (true) {
    const objectType = git(["cat-file", "-t", objectId]).trim();
    if (objectType === "commit") {
      commitRevisions.add(objectId);
      return;
    }
    if (objectType !== "tag") return;
    if (inspectedTagObjects.has(objectId)) return;

    inspectedTagObjects.add(objectId);
    const tag = git(["cat-file", "-p", objectId]);
    const headerLines = tag.split(/\r?\n/);
    const objectLine = headerLines.find((line) => line.startsWith("object "));
    const taggerLine = headerLines.find((line) => line.startsWith("tagger "));

    if (taggerLine) {
      const match = taggerLine.match(
        /^tagger .* <([^<>\r\n]+)> [0-9]+ [+-][0-9]{4}$/,
      );
      if (!match) {
        violations.push(`${label}: annotated tagger metadata is malformed`);
      } else if (!isNoreplyAddress(match[1])) {
        violations.push(
          `${label}: tagger address is not a GitHub noreply address`,
        );
      }
    }

    const target = objectLine?.slice("object ".length).trim();
    if (!target || !OBJECT_ID_PATTERN.test(target)) {
      violations.push(`${label}: annotated tag target is malformed`);
      return;
    }
    objectId = target;
  }
}

function addRepositoryTagChecks(
  commitRevisions,
  violations,
  inspectedTagObjects,
) {
  const output = git([
    "for-each-ref",
    "--format=%(objectname)%00%(objecttype)%00%(refname)%00",
    "refs/tags",
  ]);
  const fields = output
    .split("\0")
    .map((field) => field.trim())
    .filter(Boolean);

  if (fields.length % 3 !== 0) {
    throw new Error("Unable to parse Git tag metadata safely.");
  }

  for (let index = 0; index < fields.length; index += 3) {
    const [objectId, objectType, refName] = fields.slice(index, index + 3);
    if (objectType === "tag") {
      inspectAnnotatedTag(
        objectId,
        refName,
        commitRevisions,
        violations,
        inspectedTagObjects,
      );
    }
  }
}

function readPrePushObjects() {
  const input = readFileSync(0, "utf8");
  const objects = [];

  for (const line of input.split(/\r?\n/).filter(Boolean)) {
    const fields = line.trim().split(/\s+/);
    if (fields.length !== 4) {
      throw new Error("Unable to parse pre-push input safely.");
    }

    const [, localObjectId, remoteRef] = fields;
    if (ZERO_OBJECT_ID_PATTERN.test(localObjectId)) continue;
    if (!OBJECT_ID_PATTERN.test(localObjectId)) {
      throw new Error("Pre-push input contains an invalid object ID.");
    }
    objects.push({ objectId: localObjectId, label: remoteRef });
  }

  return objects;
}

function main() {
  const args = process.argv.slice(2);
  const prePushMode = args.length === 1 && args[0] === "--stdin-pre-push";
  if (args.length > 0 && !prePushMode) {
    throw new Error("Unsupported arguments.");
  }

  const violations = [];
  const commitRevisions = new Set();
  const inspectedTagObjects = new Set();

  if (prePushMode) {
    for (const { objectId, label } of readPrePushObjects()) {
      const objectType = git(["cat-file", "-t", objectId]).trim();
      if (objectType === "commit") {
        commitRevisions.add(objectId);
      } else if (objectType === "tag") {
        inspectAnnotatedTag(
          objectId,
          label,
          commitRevisions,
          violations,
          inspectedTagObjects,
        );
      }
    }
  } else {
    commitRevisions.add("--all");
    commitRevisions.add("HEAD");
    addRepositoryTagChecks(commitRevisions, violations, inspectedTagObjects);
  }

  const commitCount = addCommitViolations([...commitRevisions], violations);

  if (violations.length > 0) {
    console.error(
      "Git metadata privacy check failed. Address values are intentionally hidden.",
    );
    for (const violation of violations) console.error(`- ${violation}`);
    console.error(
      "Configure a GitHub noreply identity and rewrite the affected object before pushing.",
    );
    process.exit(1);
  }

  console.log(
    `Git metadata privacy check passed for ${commitCount} commits and ${inspectedTagObjects.size} annotated tags.`,
  );
}

try {
  main();
} catch {
  console.error(
    "Git metadata privacy check could not complete safely. No address value was printed.",
  );
  process.exit(1);
}
