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

The following external actions remain outside the authorized scope and must not be performed without another explicit instruction:

- pushing tags, including `v0.5.0`
- creating, uploading to or publishing a GitHub Release
- changing organization or repository security/permission settings
- adding secrets, signing certificates or credentials
- uploading the locally built installer candidate set

## Pre-state

- The public organization `tamas-hub` was reachable.
- The planned public repository path returned not found and appeared unused at the time of the check.
- The project directory was initially not a Git repository.
- GitHub CLI was installed, but its saved authentication was initially invalid. It was later reauthenticated by the owner; no token value was displayed or copied.
- Existing Windows bundles were unsigned Public Preview candidates.

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

## Verification evidence

- Frontend: ESLint, 44 tests, TypeScript and production Vite build passed in both the working tree and clean copy.
- Rust: format check and Clippy with denied warnings passed; 7 tests passed in both the working tree and clean copy.
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
- GitHub automatically started Dependabot evaluations from the checked-in configuration. No dependency update was merged and no Dependabot-generated change was accepted.

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
5. [ ] With separate authorization, enable Private Vulnerability Reporting, Dependabot alerts/security updates, CodeQL/default code scanning where available, read-only default workflow permissions and protected `main` rules.
6. [ ] Review repository topics, social preview, license detection and rendered README. The repository description is already set.
7. [ ] Perform the remaining installed Windows UI smoke tests and native macOS runtime checks in `PUBLIC_RELEASE_CHECKLIST.md`.
8. [ ] Only after explicit release authorization, push tag `v0.5.0`. The workflow must stop at a draft prerelease.
9. [ ] Download every draft asset, validate `SHA256SUMS.txt`, verify GitHub attestations, compare the release body with the checked-in notes, and confirm unsigned/notarization warnings.
10. [ ] Publish the draft only after a separate manual owner decision.

## Recovery and non-actions

The public `main` history should be corrected with normal follow-up or revert commits rather than force-pushed. If publication itself must be withdrawn, archiving, changing visibility or deleting the repository requires a separate owner decision; deletion is destructive and was not performed.

No tag, GitHub Release, installer upload, attestation, repository security/permission change, secret, certificate or signing credential was created. The unsigned local `r3` installer set remains outside the repository and was not uploaded. Existing earlier installer sets were preserved.

Preserve the source tree and review local Git configuration and generated release directories individually if later cleanup is requested. Do not use a broad clean/reset command because unrelated user files may exist nearby.
