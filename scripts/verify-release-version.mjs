import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const tag = process.argv[2];
if (!/^v\d+\.\d+\.\d+$/.test(tag ?? "")) {
  throw new Error(`Expected a stable vX.Y.Z tag, received: ${tag ?? "<missing>"}`);
}

const expected = tag.slice(1);
const root = resolve(import.meta.dirname, "..");
const packageVersion = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
).version;
const tauriVersion = JSON.parse(
  readFileSync(resolve(root, "src-tauri", "tauri.conf.json"), "utf8"),
).version;
const cargoToml = readFileSync(
  resolve(root, "src-tauri", "Cargo.toml"),
  "utf8",
);
const cargoVersion = cargoToml.match(
  /^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m,
)?.[1];
const releaseNotes = resolve(root, "docs", "release-notes", `${tag}.md`);

const versions = {
  "package.json": packageVersion,
  "src-tauri/tauri.conf.json": tauriVersion,
  "src-tauri/Cargo.toml": cargoVersion,
};
const mismatches = Object.entries(versions).filter(
  ([, version]) => version !== expected,
);
if (mismatches.length > 0) {
  throw new Error(
    `Release version mismatch for ${tag}: ${mismatches
      .map(([file, version]) => `${file}=${version ?? "<missing>"}`)
      .join(", ")}`,
  );
}
if (!existsSync(releaseNotes)) {
  throw new Error(`Missing release notes: docs/release-notes/${tag}.md`);
}

console.log(`Release metadata is consistent for ${tag}.`);
