# GitHub publication and release preparation record

Date: 2026-08-14
Repository: `https://github.com/tamas-hub/tamagrid`
First release: `v0.5.0` Public Preview, published 2026-08-14

This record distinguishes local preparation from actions that change GitHub or publish software.

## Authorization and scope

The owner first requested GitHub release preparation. That authorized local source changes, local Git initialization, builds, tests, dependency and secret checks, and creation of a local release candidate set.

In subsequent instructions on 2026-08-13, the owner authorized the initial public repository creation, `main` push and publication verification. This authorized only:

- creating the empty public repository `tamas-hub/tamagrid`
- creating the reviewed local initial commit and pushing only `main`
- read-only verification of the public repository and the resulting CI runs

The owner subsequently requested GitHub-publication hardening and then asked to eliminate weaknesses thoroughly. That authorized source hardening, a pull-request workflow, and reversible repository security/configuration changes required for a public project. It did not initially authorize a release/tag, installer upload, credential creation, or destructive rewrite/force-push of already published history.

On 2026-08-14, the owner separately instructed that no personal email address remain and requested thorough remediation. That authorized the one-time privacy history rewrite, exact force-with-lease update of `main`, closure of stale Dependabot pull requests, removal of old Actions runs/artifacts/caches, and GitHub email-privacy controls documented below. At that stage it still did not authorize a tag, GitHub Release, installer upload, credential creation, visibility change, or repository deletion.

The owner later confirmed the rebuilt Windows installer and explicitly instructed the release work to continue. That authorized pushing the exact reviewed `v0.5.0` tag, creating and validating draft release assets, and publishing the validated draft as a public prerelease. It did not authorize repository transfer/deletion, visibility changes, secrets, paid signing credentials, or organization-wide setting changes.

The owner then requested that the next public-project priorities be completed in a batch. Within the previously identified release backlog, this authorized uploading the reviewed custom social-preview image and publishing the runtime-hardening changes through the protected pull-request workflow. It did not authorize a new release/tag, a GitHub Support message, permission changes, secrets, or paid services.

Before that later release authorization, the following actions were outside scope:

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
- All nine then-reachable `main` commits carried one non-noreply address in author and/or committer metadata. Five pre-hardening commits were unsigned; later GitHub-signed squash commits also retained the address. The value was not copied into this record.

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
- Replaced the superseded `pnpm/action-setup` plus `actions/setup-node` pair with official successor `pnpm/setup` v2.0.2. Its reviewed tag and commit are both signed and valid; the workflow pins the exact commit, installs the exact pnpm version, installs Node 22, and verifies the pnpm package against the npm registry signature. pnpm v11 has no working native Intel macOS binary because of upstream `pnpm/pnpm#11423`, so only that bundle-smoke matrix entry retains pinned `actions/setup-node` and installs exact `pnpm@11.21.0` from npm with lifecycle scripts disabled.
- Set this repository's local Git author email to the authenticated account's GitHub noreply form without displaying or recording the address.
- Added a tracked pre-push validator for every outgoing commit and annotated tag, enabled it in the current clone, and expanded required CI to inspect all refs and tagger metadata without printing address values. A GitHub Free metadata ruleset proved non-enforcing in a dummy-address negative test and was replaced with an effective no-bypass verified-signature ruleset covering every upstream branch.

## Verification evidence

- Frontend: ESLint, 44 tests, TypeScript and production Vite build passed in both the working tree and clean copy.
- Rust: format check and Clippy with denied warnings passed; 7 tests passed in both the working tree and clean copy.
- Current hardening branch: frontend ESLint, 44 tests, TypeScript and production build passed; production pnpm audit at moderate threshold found no known vulnerability; Rust format/check and Clippy with denied warnings passed; 11 Rust tests passed.
- Current Windows hardening branch linked a production Tauri executable successfully with `pnpm tauri build --no-bundle`; no installer or release artifact was created by that check.
- A fresh source scan found zero representative secret-pattern files and zero credential-like filenames outside ignored build/dependency directories.
- Cargo Audit 0.22.2 loaded 1,216 RustSec advisories and reported no vulnerability for the lockfile. It reported maintenance warnings; target-aware `cargo tree` confirmed the one `glib` unsound warning is in Tauri's Linux-only GTK graph and absent from Windows/macOS release targets. CI carries a documented one-advisory ignore while denying future unsound/yanked warnings.
- All 29 workflow action references are full commit SHAs. All nine unique upstream action commits exist and report verified signatures.
- Release native build passed.
- Production npm audit reported no known vulnerability at the configured high threshold.
- Six GitHub YAML files parsed successfully.
- CycloneDX 1.7 SBOM generation succeeded without `node_modules`, using only the frozen lockfile; it contains the four production JavaScript components.
- Latest Windows bundle scan with Microsoft Defender found no threats.
- Both Windows installers remain intentionally `NotSigned`.
- A pre-rewrite GitHub Actions CI run passed on the reviewed application tree:
  - Ubuntu frontend job: frozen install, production dependency audit, ESLint, 44 tests, TypeScript and production Vite build.
  - Windows native job: Rust format, Clippy with denied warnings, 7 Rust tests and Tauri native build without bundling.
  - macOS native job: Rust format, Clippy with denied warnings, 7 Rust tests and Tauri native build without bundling.
- Hardened pull request #7 passed Dependency Review, RustSec, frontend, Windows/macOS native CI, CodeQL Actions, CodeQL JavaScript/TypeScript, CodeQL Rust, and the GitHub Advanced Security CodeQL summary before merge. Its pre-rewrite source and squash commits were GitHub-verified.
- A manual bundle-smoke run succeeded from that reviewed tree on Windows x64, macOS arm64 and macOS x64. It produced three nonempty seven-day artifacts containing NSIS, MSI, both DMGs and both `.app` bundles; all 22 downloaded files were nonzero. The macOS binaries identified as the expected Mach-O arm64/x86_64 architectures, both bundle identifiers and versions were `io.github.tamas-hub.tamagrid` / `0.5.0`, and the Windows artifacts remained intentionally `NotSigned`.
- Microsoft Defender scanned the complete downloaded workflow-artifact tree with remediation disabled and reported no threats. SHA-256 values were independently recorded for the four distributable containers below. This proves the inspected temporary artifacts, not a future release build.
- Supply-chain pull request #9 and Intel-macOS fallback pull request #10 each passed all nine protected checks from GitHub-signed source commits. Their reviewed trees exactly matched the squash-merged trees before the privacy rewrite.
- The final fallback bundle-smoke run succeeded on Windows x64, macOS arm64 and macOS x64 from the exact pull-request tree later merged to `main`. The downloaded result again contained three nonempty artifacts and 22 nonempty files. Mach-O architectures, bundle identifiers and version `0.5.0` matched; Windows remained intentionally `NotSigned`; Microsoft Defender reported no threats with remediation disabled.

| Bundle-smoke deliverable | SHA-256 |
| --- | --- |
| `TamaGrid_0.5.0_x64-setup.exe` | `3B7A78898F8AB9F6663F423BF7234D305B7DE061E0D69C1A75F49CF1133C39C1` |
| `TamaGrid_0.5.0_x64_en-US.msi` | `7D06872BC27C5AF58DF630B50C26BACF1BAF3D4C40E5A1FDB41F144BFAD75B18` |
| `TamaGrid_0.5.0_aarch64.dmg` | `AF990E34BD767751DF538FD29871128D9B85294279CA736BBD5BB8B8D8C7C520` |
| `TamaGrid_0.5.0_x64.dmg` | `2AEDC18907670B201B4D59E40E8DA7834CA2A9CE14BC6089762E8B699C153FA4` |

Final Intel-fallback bundle-smoke hashes:

| Deliverable | SHA-256 |
| --- | --- |
| `TamaGrid_0.5.0_x64-setup.exe` | `D98840A17AF4A7CA3B11F0C77EAD0E59CBA986A804869C455CED598B28C1F834` |
| `TamaGrid_0.5.0_x64_en-US.msi` | `57A40841CC7BCE6AE52D8EE9A8927C04C3288FBB3416BE32DDB899BCA10C94DE` |
| `TamaGrid_0.5.0_aarch64.dmg` | `BEC8B2DBC8798B114485AC9C7BC052BFCAD351209B12416E3A95234F5191D233` |
| `TamaGrid_0.5.0_x64.dmg` | `259859B3406D437200AC75D7792476C3054CE918E0742E755A2D1BDE4D36653C` |

### Published `v0.5.0` verification

- Protected `main` CI succeeded at `c4b9425a0e92c4ed4a13e1b295b7df9401a2f414` before the tag was created.
- Release workflow [31757215002](https://github.com/tamas-hub/tamagrid/actions/runs/31757215002) succeeded for the quality gate, Windows x64, macOS arm64, macOS x64, checksums, and provenance verification.
- The final checksums job re-attested all six exact downloadable packages, including both generated `.app.tar.gz` files, and then verified every package attestation inside the workflow.
- The draft contained ten exact nonempty assets. Independent download reproduced all nine hashes in `SHA256SUMS.txt`; the release notes and third-party notice were byte-identical to the tagged source; the CycloneDX 1.7 SBOM parsed with four production components.
- Independent archive checks passed for NSIS, MSI, two DMGs, and two `.app.tar.gz` archives. Both Windows installers remained intentionally `NotSigned`.
- `gh attestation verify` succeeded independently for all ten release assets. Microsoft Defender definition `1.457.150.0` scanned the downloaded release tree with remediation disabled and reported no threats.
- The clone's configured author email was absent from all ten assets, no email-formatted strings appeared in the four text assets, and the Git metadata privacy check passed without printing address values.
- The release body was replaced with the checked-in `docs/release-notes/v0.5.0.md` before publication. Anonymous access then returned HTTP 200 for the release page and HTTP 206 for a Windows installer range request.

| Published release file | SHA-256 |
| --- | --- |
| `RELEASE_NOTES.md` | `9E2F3AACCC5445B5AF789E27D4C9CC482EF675FA32C32E361E55E2D91545C4E9` |
| `THIRD_PARTY_NOTICES.md` | `9CFF93C6FB31E7E6EF8ED5D51EF7AB0D4B040FB37BC3ECF05156DBD151CA991C` |
| `TamaGrid_0.5.0_aarch64.app.tar.gz` | `29AE5BD24BD81374BFD87C740919A283B835B424D159D444DB4E4DB42AE8E4A2` |
| `TamaGrid_0.5.0_aarch64.dmg` | `341054838FEBD844518BD80A03FDDD393992C0D0D48E2083BDEAAC4FF498C208` |
| `TamaGrid_0.5.0_x64_en-US.msi` | `1F16D82165B23B1A499C871EAF7F1E6B44F1ECDB04E235B1D861ACB7F4ECCC8A` |
| `TamaGrid_0.5.0_x64-setup.exe` | `1F001B3F96BB05F5E123335B2392D2C519540D340D0CC5B699D065A2C257D08F` |
| `TamaGrid_0.5.0_x64.app.tar.gz` | `222986CCAFE1617B86CD4D5AF5A2807925D3CD0BA75B3C2C36EFF57F05AA298E` |
| `TamaGrid_0.5.0_x64.dmg` | `BF671D1A0E4001932342B8623CB350F495DD238DFC305284296E617111D0CD64` |
| `tamagrid-js.cdx.json` | `F3673F80E803B22396767E4CF020FABF4A7F8404B79552A3FE9900A91701E90B` |
| `SHA256SUMS.txt` | `6A8555C4FEA1238FEBFD9797D5EAC611D8E8F93B9FB595E82439026E00078BFA` |

## External actions performed

- Created the empty public repository [tamas-hub/tamagrid](https://github.com/tamas-hub/tamagrid) under the intended organization, without generated starter files.
- Set the repository description to: `Run and supervise up to four local Codex App Server threads in one desktop cockpit.`
- Pushed the initial reviewed 128-file commit to `main` and set it as the tracked remote branch.
- The first CI run failed before project commands because `pnpm/action-setup` v6 attempted to self-update through broken `pnpm@11.12.0`. Explicitly setting that broken version did not resolve the upstream bootstrap failure.
- Confirmed through npm package metadata that `pnpm@11.12.0` was deprecated as broken, upgraded to `11.21.0`, repeated the local frozen-install/audit/check suite successfully, and pushed the corrective change.
- Verified the public repository is `PUBLIC`, non-empty, uses `main` as the default branch, and exposes the expected README, MIT license and security policy.
- GitHub automatically evaluated the checked-in Dependabot configuration and opened six update pull requests (`#1` through `#6`). The obsolete `pnpm/action-setup` update `#1` was closed after migration to its official successor. Privacy cleanup later closed unmerged `#2` through `#6` and deleted their old-history branches; no Dependabot-generated dependency change was accepted automatically, and Dependabot may recreate clean branches from the rewritten `main`.
- Enabled Private Vulnerability Reporting.
- Enabled secret scanning and push protection. GitHub accepted the request but kept validity checks and non-provider patterns disabled because those controls are not available for this repository.
- Enabled Dependabot vulnerability alerts and security updates.
- Changed the default workflow token from write to read and kept workflow pull-request approval disabled.
- Restricted Actions to ten explicit action/sub-action patterns, disabled broad GitHub-owned/verified-publisher wildcards, and required full commit SHA pinning. The allowlist covers only the actions referenced by the checked-in workflows; CodeQL permits `init` and `analyze` separately rather than a broader repository wildcard.
- Configured CodeQL default setup with the extended query suite, remote-and-local threat model, and GitHub's detected Actions/JavaScript/TypeScript/Rust languages. Its setup run succeeded before advanced CodeQL replaced it.
- The first hardened PR had no CodeQL check from default setup, so default setup was disabled and replaced with a checked-in advanced workflow. It analyzes Actions, JavaScript/TypeScript, and Rust on pull requests, `main`, and a weekly schedule with the security-extended query suite; the CodeQL Action is pinned to the verified v4.37.7 commit.
- Added twelve repository topics describing Codex App Server, Tauri/Rust/React/TypeScript, local-first desktop development, Windows and macOS.
- Uploaded the reviewed 1280×640 TamaGrid social-preview image. The repository settings now expose `Remove image`, and the public repository metadata serves a custom `og:image`; repository visibility and permissions were not changed.
- Final verification found zero open CodeQL, secret-scanning and Dependabot alerts. Dependabot surfaced `GHSA-wrw7-89jp-8q8g` for `glib 0.18.5` in the cross-platform lockfile. Locked target graphs prove it unreachable on all three supported Windows/macOS targets and reachable only through Tauri GTK on unsupported Linux, so alert `#1` was classified `not_used` with that exact rationale. The first overlong dismissal comment was rejected without changing state; the accepted 267-character comment, reason and dismissed state were read back. RustSec CI continues monitoring the advisory and the classification must be revisited before adding Linux support.
- The API first rejected an out-of-order selected-action update and two invalid CodeQL enum values; the requests were corrected without disabling already-applied controls. A transient empty-input error occurred during the topic update and the same intended payload succeeded on retry. Final state was read back after each correction.
- The first advanced CodeQL run stopped at workflow startup because `github/codeql-action@*` did not match the nested `init` and `analyze` actions. No code executed. The broad ineffective pattern was replaced with the two exact sub-action patterns; startup-failure runs cannot be retried, so a normal follow-up commit retriggered the PR workflows.
- Squash-merged hardened pull request #7 only after all nine final-head required checks succeeded. Direct merge commits and rebase merges were disabled; squash merge is the only enabled merge mode and merged branches are deleted automatically.
- Protected `main` with strict status checks bound to their GitHub App IDs: CodeQL Actions, JavaScript/TypeScript and Rust analysis, the GitHub Advanced Security CodeQL summary, Dependency Review, frontend, Windows/macOS native CI, and RustSec. Pull requests, stale-review dismissal, admin enforcement, linear history, conversation resolution and signed commits are required; force pushes and deletion are disabled. A first API payload combining legacy contexts with App-bound checks was rejected with `422`; the corrected checks-only payload succeeded and the complete protection object was read back.
- Enabled immutable releases before the first publication. At that time this did not create a tag or release; it allowed the draft to be assembled and inspected while ensuring the later published release could not be mutated.
- The first post-migration bundle-smoke run exposed an Intel-macOS-only `pnpm/setup` failure before project code ran. The check annotation identified upstream `pnpm/pnpm#11423`: pnpm v11's Node SEA binary is not usable on `darwin-x64`. The fallback keeps version 11.21.0, does not adopt the pnpm 12 release candidate, and does not weaken action SHA pinning.
- Pull request #10 and a follow-up bundle-smoke run verified the targeted fallback. `pnpm/setup` remains active on Windows and Apple Silicon; only Intel macOS uses pinned `actions/setup-node` plus exact `pnpm@11.21.0` from npm with lifecycle scripts disabled.
- The first authorized `v0.5.0` tag run failed before project code on Intel macOS because the release workflow had not yet received the validated fallback. The run was cancelled; it created no draft or assets; the exact tag was removed before correction.
- Pull request #15 applied the same exact pnpm fallback to the release workflow. All nine protected checks passed before squash merge.
- A second authorized tag run built all three platforms and produced a draft, but independent verification found no attestation subject for either downloadable `.app.tar.gz`. The draft was not published; it and the exact tag were removed before correction.
- Pull request #16 re-attested the six exact downloadable package files and added in-workflow verification for all six. All nine protected checks passed before squash merge.
- The final `v0.5.0` tag was created at `c4b9425a0e92c4ed4a13e1b295b7df9401a2f414`. After every final release check passed, draft `370284688` was published as the immutable prerelease [TamaGrid v0.5.0 Public Preview](https://github.com/tamas-hub/tamagrid/releases/tag/v0.5.0) with ten assets.

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
6. [x] Merge the hardened pull request only after Dependency Review, Security Audit, Windows/macOS native CI and CodeQL checks succeed; then protect `main` with those exact required checks, required pull requests, required signed commits, no force-push/delete and admin enforcement.
7. [x] Build and inspect temporary unsigned Windows x64, macOS arm64 and macOS x64 workflow artifacts from the hardened main commit.
8. [x] Review the custom 1280×640 social preview and final rendered README. The description, topics and license detection are complete.
9. [x] Complete the installed Windows installer/UI smoke test confirmed by the owner. Native macOS runtime checks remain open and are disclosed in the release notes.
10. [x] After explicit release authorization, push tag `v0.5.0` and require the workflow to stop at a draft prerelease.
11. [x] Download every draft asset, validate `SHA256SUMS.txt`, verify all GitHub attestations, compare the release body with the checked-in notes, and confirm unsigned/notarization warnings.
12. [x] Publish the draft only after the separate owner decision and final manual gate.

## Recovery and non-actions

The owner later made the separate destructive-operation decision described above. The one-time privacy rewrite preserved the complete `main` tree and nine-commit topology while replacing the exact personal address with GitHub noreply metadata. It invalidated prior commit IDs and signatures; five stale Dependabot pull requests were closed and their branches deleted. Old Actions runs, artifacts and caches were removed, then all nine App-bound checks, pull requests, admin enforcement, signed commits, linear history and conversation resolution were restored with force pushes and deletion disabled. All upstream branches now also require verified signatures; email-format enforcement remains the responsibility of the account push block, repository-local identity, tracked pre-push hook, and required CI because that metadata ruleset feature is unavailable on GitHub Free. Future source corrections return to normal pull requests rather than history rewrites.

The final `v0.5.0` tag, ten release assets, checksum manifest, SBOM, third-party notice, release notes, and GitHub Artifact Attestations were created and published under the later explicit release authorization. No secret, certificate, signing credential, repository visibility change, transfer, or deletion was performed. The separate unsigned local `r3` candidate and existing earlier installer sets remain outside the repository and were not uploaded. The pre-rewrite temporary workflow artifacts were re-inspected for email leakage and then removed with their old Actions runs; they were CI evidence, not the published GitHub Release.

Repository-setting recovery is reversible: Private Vulnerability Reporting and automated security fixes can be disabled; CodeQL default setup can return to `not-configured`; Actions can return to `allowed_actions=all`, no SHA requirement and a write-default token; secret scanning/push protection can be disabled; topics can be reset; the social-preview image can be replaced or removed from General settings. Those weaker security settings are not recommended and no rollback was performed. Source changes can be reverted through a normal pull request after merge. The published `v0.5.0` release is immutable; any artifact or release-note correction must use a reviewed new version such as `v0.5.1` rather than altering the existing release.

Preserve the source tree and review local Git configuration and generated release directories individually if later cleanup is requested. Do not use a broad clean/reset command because unrelated user files may exist nearby.
