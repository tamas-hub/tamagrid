import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

const NOREPLY_PATTERNS = [
  /^noreply@github\.com$/i,
  /^[^@]+@users\.noreply\.github\.com$/i,
];

function isNoreplyAddress(address) {
  return NOREPLY_PATTERNS.some((pattern) => pattern.test(address));
}

const repository = realpathSync(process.cwd());
const output = execFileSync(
  "git",
  [
    "-c",
    `safe.directory=${repository}`,
    "log",
    "-z",
    "--format=%H%x00%ae%x00%ce",
    "HEAD",
  ],
  { cwd: repository, encoding: "utf8" },
);
const fields = output.split("\0").filter(Boolean);

if (fields.length % 3 !== 0) {
  console.error("Unable to parse Git commit metadata safely.");
  process.exit(1);
}

const violations = [];
for (let index = 0; index < fields.length; index += 3) {
  const [commit, authorEmail, committerEmail] = fields.slice(index, index + 3);
  if (!isNoreplyAddress(authorEmail)) {
    violations.push(`${commit}: author address is not a GitHub noreply address`);
  }
  if (!isNoreplyAddress(committerEmail)) {
    violations.push(`${commit}: committer address is not a GitHub noreply address`);
  }
}

if (violations.length > 0) {
  console.error("Commit email privacy check failed. Address values are intentionally hidden.");
  for (const violation of violations) console.error(`- ${violation}`);
  console.error("Configure your GitHub noreply address and rewrite the affected commits.");
  process.exit(1);
}

console.log(`Commit email privacy check passed for ${fields.length / 3} commits.`);
