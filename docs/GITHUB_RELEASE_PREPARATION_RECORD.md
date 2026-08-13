# GitHub release preparation record

Date: 2026-08-13
Planned repository: `https://github.com/tamas-hub/tamagrid`
Planned first release: `v0.5.0` Public Preview

This record distinguishes local preparation from actions that change GitHub or publish software.

## Authorization and scope

The owner first requested GitHub release preparation. That authorized local source changes, local Git initialization, builds, tests, dependency and secret checks, and creation of a local release candidate set.

In a subsequent instruction on 2026-08-13, the owner authorized continuing with the initial public repository creation and `main` push. This authorizes only:

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
- The project directory was not a Git repository.
- GitHub CLI was installed, but its saved authentication was invalid. No token value was displayed or copied.
- Existing Windows bundles were unsigned Public Preview candidates.

These observations are time-sensitive and must be checked again immediately before repository creation.

## Local actions completed

- Initialized a local Git repository on branch `main`.
- Added the local `origin` URL `https://github.com/tamas-hub/tamagrid.git`; no network push was attempted.
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

## Verification evidence

- Frontend: ESLint, 44 tests, TypeScript and production Vite build passed in both the working tree and clean copy.
- Rust: format check and Clippy with denied warnings passed; 7 tests passed in both the working tree and clean copy.
- Release native build passed.
- Production npm audit reported no known vulnerability at the configured high threshold.
- Six GitHub YAML files parsed successfully.
- CycloneDX 1.7 SBOM generation succeeded without `node_modules`, using only the frozen lockfile; it contains the four production JavaScript components.
- Latest Windows bundle scan with Microsoft Defender found no threats.
- Both Windows installers remain intentionally `NotSigned`.

Latest local release candidate directory (a sibling of the repository and not part of the public source candidate):

`../TamaGrid-v0.5.0-public-preview-r3`

| Artifact | SHA-256 |
| --- | --- |
| `TamaGrid_0.5.0_x64-setup.exe` | `49CF25C80F793547B9C7897881BB2568034D585722ED0F564CEEC0AF18328288` |
| `TamaGrid_0.5.0_x64_en-US.msi` | `D58A6DDBEBB911D74F37258BAB895250764759750B6DDE3A870B9E6A100A9521` |

The local set also contains `RELEASE_NOTES.md`, `THIRD_PARTY_NOTICES.md`, `tamagrid-js.cdx.json` and a checksum manifest covering every attached file except the manifest itself.

## Required publication sequence

1. Reauthenticate GitHub CLI or sign in through the browser with the account that is allowed to create repositories under `tamas-hub`.
2. Recheck that `tamas-hub/tamagrid` is still unused, then create an empty public repository without generated starter files.
3. Review the complete 128-file candidate, choose the intended Git author identity, create the initial commit and push only `main`.
4. Confirm CI succeeds on Windows and macOS. Resolve any first-run workflow or runner issue before tagging.
5. Enable Private Vulnerability Reporting, Dependabot alerts/security updates, CodeQL/default code scanning where available, read-only default workflow permissions and protected `main` rules.
6. Review repository description, topics, social preview, license detection and rendered README.
7. Perform the remaining installed Windows UI smoke tests and native macOS build/runtime checks in `PUBLIC_RELEASE_CHECKLIST.md`.
8. Only after explicit release authorization, push tag `v0.5.0`. The workflow must stop at a draft prerelease.
9. Download every draft asset, validate `SHA256SUMS.txt`, verify GitHub attestations, compare the release body with the checked-in notes, and confirm unsigned/notarization warnings.
10. Publish the draft only after a separate manual owner decision.

## Recovery and non-actions

No external state changed, so no remote rollback is required. The local repository has no commits and all candidate files remain reviewable as untracked files. The `origin` value is local Git configuration only. Existing earlier installer sets were preserved; `r3` was created as a new directory rather than overwriting them.

If preparation is cancelled, preserve the source tree and review local Git configuration and generated release directories individually. Do not use a broad clean/reset command because unrelated user files may exist nearby.
