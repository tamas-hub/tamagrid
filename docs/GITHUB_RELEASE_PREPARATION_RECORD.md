# GitHub publication and release preparation record

Date: 2026-08-13
Planned repository: `https://github.com/tamas-hub/tamagrid`
Planned first release: `v0.5.0` Public Preview

This record distinguishes local preparation from actions that change GitHub or publish software.

## Authorization and scope

The owner first requested GitHub release preparation. That authorized local source changes, local Git initialization, builds, tests, dependency and secret checks, and creation of a local release candidate set.

In subsequent instructions on 2026-08-13, the owner authorized the initial public repository creation, `main` push and publication verification. This authorized only:

- creating the empty public repository `tamas-hub/tamagrid`
- creating the reviewed local initial commit and pushing only `main`
- read-only verification of the public repository and the resulting CI runs

The owner subsequently requested GitHub-publication hardening and then asked to eliminate weaknesses thoroughly. That authorized source hardening, a pull-request workflow, and reversible repository security/configuration changes required for a public project. It does not authorize a release/tag, installer upload, credential creation, or destructive rewrite/force-push of already published history.

The following external actions remain outside the authorized scope and must not be performed without another explicit instruction:

- pushing tags, including `v0.5.0`
- creating, uploading to or publishing a GitHub Release
- changing organization-wide settings or repository visibility/ownership
- adding secrets, signing certificates or credentials
- uploading the locally built installer candidate set

## Pre-state

- The public organization `tamas-hub` was reachable.
- The planned public repository path returned not found and appeared unused at the time of the check.
- The project directory was initially not a Git repository.
- GitHub CLI was installed, but its saved authentication was initially invalid. It was later reauthenticated by the owner; no token value was displayed or copied.
- Existing Windows bundles were unsigned Public Preview candidates.
- Immediately before the hardening pass, Private Vulnerability Reporting, secret scanning, push protection, Dependabot security updates, CodeQL/default setup, main protection and required signed commits were disabled. Actions allowed every action, did not require SHA pinning, and gave the default workflow token write permission. Topics were empty.
- Five public commits were unsigned and carried a non-noreply author address in immutable commit metadata. The value was not copied into this record.

Immediately before repository creation, the organization and unused repository path were rechecked and GitHub CLI reported an authenticated `flames-hub` session with the required `repo` and `workflow` scopes.

## Local actions completed

- Initialized a local Git repository on branch `main`.
- Added the local `origin` URL `https://github.com/tamas-hub/tamagrid.git` and later pushed the authorized `main` branch.
- Confirmed the final public candidate contains 128 files after ignore rules.
- Confirmed `node_modules`, frontend output, Rust/Tauri build output, generated Tauri files, release artifacts, local environment files and signing material are ignored.
- Scanned the candidate for representative private-key, GitHub token, API-key, email and private local-path patterns; no matching file was found.
- Added `.gitattributes`, pull-request guidance, a private-security-report contact route, third-party dependency notices and Tauri bundle metadata.
- Added production JavaScript CycloneDX SBOM generation to the draft-release workflow.
- Added the third-party notice and SBOM to the release checksum and attestation flow.
- Replaced a nonexistent `pnpm/action-setup` commit with the signed v6.0.9 commit and refreshed checkout/setup-node to current signed releases.
- Confirmed all 22 action uses reference one of six existing 40-character upstream commits.
- Disabled checkout credential persistence in every CI and release job.
- Created a clean 128-file copy and restored 268 JavaScript packages with the frozen lockfile.
- Rebuilt the Windows NSIS and MSI candidates with the MIT license screen and `THIRD_PARTY_NOTICES.md` installed as an application resource.
- Replaced broken `pnpm@11.12.0` with non-deprecated `pnpm@11.21.0`, updated the documented minimum Node.js version to `22.13`, and pinned the same pnpm version in CI and draft-release jobs.
- Added first-use/path-change/content-change native confirmation for both auto-detected and manually selected Codex executables, persisted an exact SHA-256 fingerprint, and rechecked it after `--version` and immediately before `app-server` launch.
- Bounded the Codex `--version` process to eight seconds and 64 KiB per stdout/stderr stream.
- Removed the unused `initialize` payload (including Codex home metadata) from WebView IPC and reduced `account/read` to the minimum authentication type/plan fields.
- Added Rust-side bounded/coalesced delta delivery, terminal-event ordering, serialized sequence/delivery, expanded diagnostic redaction, and post-disconnect event suppression.
- Added pull-request Dependency Review at moderate severity, scheduled/push/PR RustSec auditing, and a manual three-platform unsigned bundle-smoke workflow with seven-day artifacts.
- Added release gates requiring the tag commit to belong to `main`, all three version sources to match the tag, release notes to exist, and JavaScript/Rust audits to pass before draft artifact creation.
- Set this repository's local Git author email to the authenticated account's GitHub noreply form without displaying or recording the address.

## Verification evidence

- Frontend: ESLint, 44 tests, TypeScript and production Vite build passed in both the working tree and clean copy.
- Rust: format check and Clippy with denied warnings passed; 7 tests passed in both the working tree and clean copy.
- Current hardening branch: frontend ESLint, 44 tests, TypeScript and production build passed; production pnpm audit at moderate threshold found no known vulnerability; Rust format/check and Clippy with denied warnings passed; 11 Rust tests passed.
- Current Windows hardening branch linked a production Tauri executable successfully with `pnpm tauri build --no-bundle`; no installer or release artifact was created by that check.
- A fresh source scan found zero representative secret-pattern files and zero credential-like filenames outside ignored build/dependency directories.
- Cargo Audit 0.22.2 loaded 1,216 RustSec advisories and reported no vulnerability for the lockfile. It reported maintenance warnings; target-aware `cargo tree` confirmed the one `glib` unsound warning is in Tauri's Linux-only GTK graph and absent from Windows/macOS release targets. CI carries a documented one-advisory ignore while denying future unsound/yanked warnings.
- All 31 workflow action references are full commit SHAs. All eight unique upstream action commits exist and report verified signatures.
- Release native build passed.
- Production npm audit reported no known vulnerability at the configured high threshold.
- Six GitHub YAML files parsed successfully.
- CycloneDX 1.7 SBOM generation succeeded without `node_modules`, using only the frozen lockfile; it contains the four production JavaScript components.
- Latest Windows bundle scan with Microsoft Defender found no threats.
- Both Windows installers remain intentionally `NotSigned`.
- GitHub Actions run [31704762999](https://github.com/tamas-hub/tamagrid/actions/runs/31704762999) passed on the CI-verified application commit `61cc542da45466046889e515d3da74b1bdbf89d9`:
  - Ubuntu frontend job: frozen install, production dependency audit, ESLint, 44 tests, TypeScript and production Vite build.
  - Windows native job: Rust format, Clippy with denied warnings, 7 Rust tests and Tauri native build without bundling.
  - macOS native job: Rust format, Clippy with denied warnings, 7 Rust tests and Tauri native build without bundling.

## External actions performed

- Created the empty public repository [tamas-hub/tamagrid](https://github.com/tamas-hub/tamagrid) under the intended organization, without generated starter files.
- Set the repository description to: `Run and supervise up to four local Codex App Server threads in one desktop cockpit.`
- Pushed the initial 128-file commit `5185145a32fbd5fb5a0aded43de03f4fd54a7ff3` to `main` and set it as the tracked remote branch.
- The first CI run failed before project commands because `pnpm/action-setup` v6 attempted to self-update through broken `pnpm@11.12.0`. Explicitly setting that broken version did not resolve the upstream bootstrap failure.
- Confirmed through npm package metadata that `pnpm@11.12.0` was deprecated as broken, upgraded to `11.21.0`, repeated the local frozen-install/audit/check suite successfully, and pushed the corrective commit `61cc542da45466046889e515d3da74b1bdbf89d9`.
- Verified the public repository is `PUBLIC`, non-empty, uses `main` as the default branch, and exposes the expected README, MIT license and security policy.
- GitHub automatically evaluated the checked-in Dependabot configuration and opened six update pull requests (`#1` through `#6`). No dependency update was merged, edited or closed and no Dependabot-generated change was accepted.
- Enabled Private Vulnerability Reporting.
- Enabled secret scanning and push protection. GitHub accepted the request but kept validity checks and non-provider patterns disabled because those controls are not available for this repository.
- Enabled Dependabot vulnerability alerts and security updates.
- Changed the default workflow token from write to read and kept workflow pull-request approval disabled.
- Restricted Actions to nine explicit repository patterns, disabled broad GitHub-owned/verified-publisher wildcards, and required full commit SHA pinning. The allowlist covers only the actions referenced by the checked-in workflows and GitHub CodeQL default setup.
- Configured CodeQL default setup with the extended query suite, remote-and-local threat model, and GitHub's detected Actions/JavaScript/TypeScript/Rust languages. Setup run [31710120357](https://github.com/tamas-hub/tamagrid/actions/runs/31710120357) succeeded.
- Added twelve repository topics describing Codex App Server, Tauri/Rust/React/TypeScript, local-first desktop development, Windows and macOS.
- Post-change verification found zero open CodeQL, secret-scanning and Dependabot alerts. No alert was dismissed or hidden.
- The API first rejected an out-of-order selected-action update and two invalid CodeQL enum values; the requests were corrected without disabling already-applied controls. A transient empty-input error occurred during the topic update and the same intended payload succeeded on retry. Final state was read back after each correction.

Latest local release candidate directory (a sibling of the repository and not part of the public source candidate):

`../TamaGrid-v0.5.0-public-preview-r3`

| Artifact | SHA-256 |
| --- | --- |
| `TamaGrid_0.5.0_x64-setup.exe` | `49CF25C80F793547B9C7897881BB2568034D585722ED0F564CEEC0AF18328288` |
| `TamaGrid_0.5.0_x64_en-US.msi` | `D58A6DDBEBB911D74F37258BAB895250764759750B6DDE3A870B9E6A100A9521` |

The local set also contains `RELEASE_NOTES.md`, `THIRD_PARTY_NOTICES.md`, `tamagrid-js.cdx.json` and a checksum manifest covering every attached file except the manifest itself.

## Publication sequence and remaining work

1. [x] Reauthenticate GitHub CLI with the account allowed to create repositories under `tamas-hub`.
2. [x] Recheck that `tamas-hub/tamagrid` is unused and create an empty public repository without generated starter files.
3. [x] Review the 128-file candidate, create the initial commit and push only `main`.
4. [x] Resolve the first-run pnpm bootstrap issue and confirm CI succeeds on Ubuntu, Windows and macOS.
5. [x] Enable Private Vulnerability Reporting, secret scanning/push protection, Dependabot alerts/security updates, CodeQL/default scanning, read-only default workflow permissions, selected-action policy and SHA pinning.
6. [ ] Merge the hardened pull request only after Dependency Review, Security Audit, Windows/macOS native CI and CodeQL checks succeed; then protect `main` with those exact required checks, required pull requests, required signed commits, no force-push/delete and admin enforcement.
7. [ ] Review social preview and final rendered README. The description, topics and license detection are complete.
8. [ ] Perform the remaining installed Windows UI smoke tests and native macOS runtime checks in `PUBLIC_RELEASE_CHECKLIST.md`.
9. [ ] Only after explicit release authorization, push tag `v0.5.0`. The workflow must stop at a draft prerelease.
10. [ ] Download every draft asset, validate `SHA256SUMS.txt`, verify GitHub attestations, compare the release body with the checked-in notes, and confirm unsigned/notarization warnings.
11. [ ] Publish the draft only after a separate manual owner decision.

## Recovery and non-actions

The public `main` history should be corrected with normal follow-up or revert commits rather than force-pushed. Existing unsigned commits and their author metadata were not rewritten; doing so would invalidate public commit IDs and open Dependabot branches and requires a separate destructive-operation decision. If publication itself must be withdrawn, archiving, changing visibility or deleting the repository requires a separate owner decision; deletion is destructive and was not performed.

No tag, GitHub Release, installer upload, release attestation, secret, certificate or signing credential was created. The unsigned local `r3` installer set remains outside the repository and was not uploaded. Existing earlier installer sets were preserved.

Repository-setting recovery is reversible: Private Vulnerability Reporting and automated security fixes can be disabled; CodeQL default setup can return to `not-configured`; Actions can return to `allowed_actions=all`, no SHA requirement and a write-default token; secret scanning/push protection can be disabled; topics can be reset. Those weaker settings are not recommended and no rollback was performed. Source changes can be reverted through a normal pull request after merge.

Preserve the source tree and review local Git configuration and generated release directories individually if later cleanup is requested. Do not use a broad clean/reset command because unrelated user files may exist nearby.
