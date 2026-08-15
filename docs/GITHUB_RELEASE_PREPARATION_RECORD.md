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

On 2026-08-14, the owner reported that the native macOS check showed no problem and then explicitly instructed the `v0.6.0` release to proceed. This authorized updating the public validation record without inventing missing device metadata, tagging the exact reviewed protected `main`, creating and independently validating the draft prerelease, and publishing it only after the documented artifact gate succeeds. It does not authorize repository transfer/deletion, visibility or protection changes, secrets, paid signing credentials, or organization-wide settings.

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
9. [x] Complete the installed Windows installer/UI smoke test and record the owner's native macOS Pass report. Missing macOS package/device/OS and per-check evidence remains disclosed in the release notes.
10. [x] After explicit release authorization, push tag `v0.5.0` and require the workflow to stop at a draft prerelease.
11. [x] Download every draft asset, validate `SHA256SUMS.txt`, verify all GitHub attestations, compare the release body with the checked-in notes, and confirm unsigned/notarization warnings.
12. [x] Publish the draft only after the separate owner decision and final manual gate.

## Recovery and non-actions

The owner later made the separate destructive-operation decision described above. The one-time privacy rewrite preserved the complete `main` tree and nine-commit topology while replacing the exact personal address with GitHub noreply metadata. It invalidated prior commit IDs and signatures; five stale Dependabot pull requests were closed and their branches deleted. Old Actions runs, artifacts and caches were removed, then all nine App-bound checks, pull requests, admin enforcement, signed commits, linear history and conversation resolution were restored with force pushes and deletion disabled. All upstream branches now also require verified signatures; email-format enforcement remains the responsibility of the account push block, repository-local identity, tracked pre-push hook, and required CI because that metadata ruleset feature is unavailable on GitHub Free. Future source corrections return to normal pull requests rather than history rewrites.

The final `v0.5.0` tag, ten release assets, checksum manifest, SBOM, third-party notice, release notes, and GitHub Artifact Attestations were created and published under the later explicit release authorization. No secret, certificate, signing credential, repository visibility change, transfer, or deletion was performed. The separate unsigned local `r3` candidate and existing earlier installer sets remain outside the repository and were not uploaded. The pre-rewrite temporary workflow artifacts were re-inspected for email leakage and then removed with their old Actions runs; they were CI evidence, not the published GitHub Release.

Repository-setting recovery is reversible: Private Vulnerability Reporting and automated security fixes can be disabled; CodeQL default setup can return to `not-configured`; Actions can return to `allowed_actions=all`, no SHA requirement and a write-default token; secret scanning/push protection can be disabled; topics can be reset; the social-preview image can be replaced or removed from General settings. Those weaker security settings are not recommended and no rollback was performed. Source changes can be reverted through a normal pull request after merge. The published `v0.5.0` release is immutable; any artifact or release-note correction must use a reviewed new version such as `v0.5.1` rather than altering the existing release.

Preserve the source tree and review local Git configuration and generated release directories individually if later cleanup is requested. Do not use a broad clean/reset command because unrelated user files may exist nearby.

## v0.6.0 local candidate hardening (2026-08-14)

The next local candidate adds a feature-gated, isolated packaged Tauri / WebView soak harness. It uses a different app identifier, does not launch Codex, and does not read an account, conversation, credential, or usage limit. A three-minute Windows run delivered 9,000 delta events / 2,304,000 bytes with zero sequence gaps, maximum animation-frame gap 50 ms, latest-row distance 0 px, and no TamaGrid, direct WebView child, or test temporary directory left after normal exit.

The production candidate was then rebuilt with the frontend soak flag explicitly disabled and without the non-default Rust test feature. The production `dist` and executable contain none of the test command or completion markers. Frontend lint / 46 tests / typecheck / production build, App Server schema compatibility against Codex CLI 0.147.0, production npm audit, Git metadata email check, normal Rust fmt / clippy / 14 tests, feature-enabled clippy / 15 tests, and RustSec's unsound / yanked gate all passed.

The separate local set is `../TamaGrid-v0.6.0-public-preview-candidate`. It contains two unsigned Windows packages, release notes, third-party notices, the production JavaScript CycloneDX SBOM, and a six-file checksum manifest. The manifest was independently read back and matched every covered file. The MSI opened read-only as `TamaGrid` version `0.6.0`, and Microsoft Defender custom scanning with remediation disabled reported no threats.

| Artifact | SHA-256 |
| --- | --- |
| `TamaGrid_0.6.0_x64-setup.exe` | `AA007757C5F892CF308192B24BED173346DFD732F47FDF5D029D530B25EC0B44` |
| `TamaGrid_0.6.0_x64_en-US.msi` | `0ABE0E6472504DDBDAB83E9398C19CD78434DE93E3ED27FF8FA9AF9B147B9184` |

The v0.6.0 hardening work was integrated through protected pull request [#20](https://github.com/tamas-hub/tamagrid/pull/20) as GitHub-verified squash commit `2b13ad453ed2d8f1e1b3ec15e8acb7f258302ddb`. The compact UI and release-documentation work was subsequently integrated through protected pull request [#21](https://github.com/tamas-hub/tamagrid/pull/21) as GitHub-verified squash commit `4d2706b4a0a9d261f9b459805c08c2875d1650c3`. All nine required checks passed before each merge. The updated three-platform Bundle smoke passed on Windows x64, macOS arm64, and macOS x64 in [run 31777776881](https://github.com/tamas-hub/tamagrid/actions/runs/31777776881); the retained workflow artifacts were inspected as nonempty unsigned candidate bundles. Native macOS UI / runtime checks and forced-crash packaged process-tree recovery remain open.

## v0.6.0 exact merged-main Windows validation (2026-08-14)

The owner authorized completion of the identified local Windows release gate and pull-request integration. Exact public `main` commit `4d2706b4a0a9d261f9b459805c08c2875d1650c3` was rebuilt locally with `pnpm tauri build`. The resulting NSIS and MSI packages were copied to an ignored local candidate directory with release notes, third-party notices, and an independently verified checksum manifest. No user setting, account data, conversation content, executable path, or local backup was added to Git.

| Exact merged-main artifact | SHA-256 |
| --- | --- |
| `TamaGrid_0.6.0_x64-setup.exe` | `526BFFCE29B601D24C01813B9E579C45CEF649DA5DC967684FFC775900AAE7CB` |
| `TamaGrid_0.6.0_x64_en-US.msi` | `A4B5AFC054EDE81BC7200501759995F41C1D9323B47B2FBC0C0B1A6D46863826` |

Both packages remain intentionally `NotSigned`. Read-only MSI inspection returned product `TamaGrid`, version `0.6.0`, and manufacturer `TamaGrid contributors`. Microsoft Defender engine `1.1.26070.7` with definitions `1.457.159.0` found no threat in the merged-main Windows candidates with remediation disabled. Privacy scans found no personal email, private user path, credential, secret, or token marker in the release set.

Before changing the installed application, the three live TamaGrid settings directories were copied to a timestamped local temporary backup outside Git. The published `v0.5.0` NSIS installer was downloaded from the immutable GitHub prerelease; its checksum matched `1f001b3f96bb05f5e123335b2392d2c519540d340d0cc5b699d065a2c257d08f`, `gh attestation verify` succeeded, and Microsoft Defender found no threat with remediation disabled.

The Windows smoke sequence then succeeded end to end: uninstall the existing per-user installation; silently install verified `v0.5.0`; launch it and confirm the in-app `0.5.0` version; upgrade in place with the exact merged-main `v0.6.0` NSIS package; launch and confirm the in-app `0.6.0` version; verify Japanese, Dark theme, 190% text size, four-pane layout, existing titles/history, Codex connection, and idle status were preserved; uninstall `v0.6.0`; verify its registry entry, install directory, and application process were gone; reinstall the same merged-main `v0.6.0`; relaunch, repeat the version/state checks, and close normally. The machine was left with TamaGrid `0.6.0` installed and no TamaGrid process running. Every observed `codex app-server` process after shutdown had a live non-TamaGrid parent and was left untouched.

No `v0.6.0` tag, draft release, release asset, repository setting, visibility, permission, secret, signing credential, or platform-security bypass was created or changed during the Windows gate. The local settings backup and ignored installer candidates remain available for recovery. The repository owner subsequently reported a native macOS Pass and explicitly authorized the `v0.6.0` release to proceed. Exact macOS package hash, device/OS metadata, and per-check evidence were not supplied; those limits and forced-crash recovery remain disclosed rather than inferred.

## Published v0.6.0 verification (2026-08-14)

After the owner explicitly instructed the `v0.6.0` publication to proceed, the public record update was integrated through protected pull request [#24](https://github.com/tamas-hub/tamagrid/pull/24). All nine required checks passed before GitHub-verified squash merge `7d021df3efca9c56b8440e1b2183c8eadd5a3b8c`. The main-branch CI, CodeQL, and Security audit runs all succeeded from that exact commit. Lightweight tag `v0.6.0` was then created at the same commit without bypassing branch protection.

Release workflow [31806120272](https://github.com/tamas-hub/tamagrid/actions/runs/31806120272) succeeded for the quality gate, Windows x64, macOS arm64, macOS x64, checksums, and provenance verification. Draft release `370611832` was not published until all ten nonempty assets had been downloaded to a local verification directory outside Git and independently checked. `SHA256SUMS.txt` covered the other nine files and all nine values were reproduced; GitHub API digests matched all ten downloaded files; `gh attestation verify` succeeded for every file. Release notes and third-party notices were byte-equivalent to the tagged source after line-ending normalization, and the CycloneDX 1.7 SBOM identified `tamagrid` version `0.6.0` with four production components.

| Published release file | SHA-256 |
| --- | --- |
| `RELEASE_NOTES.md` | `EC9052F2408CC70A6529CBD6B450B5A33BA87B378C04A241A9EFD5C100C4B20D` |
| `SHA256SUMS.txt` | `2F50CA5A1C2DDA1E1F80198F65AB549F9202CF4D3D6191E2D2E87F2B6ED4941C` |
| `TamaGrid_0.6.0_aarch64.app.tar.gz` | `513CE20D3E64FDBEA3CF1D878E25F5191B97109BA749853D818C1D2383E7680C` |
| `TamaGrid_0.6.0_aarch64.dmg` | `7D0681AFE59F1A7DA264D6A9592D33B184AB23C60F9C37350140B2C17B08F292` |
| `TamaGrid_0.6.0_x64_en-US.msi` | `203544E98AB2912A24950286CE22B78762E6BE3A2F268654BD5E15EB242C9A68` |
| `TamaGrid_0.6.0_x64-setup.exe` | `6950FE6172328FAD8BEC3FE3252B29000B3390FFF4A41AD55783DD42C76B4CFA` |
| `TamaGrid_0.6.0_x64.app.tar.gz` | `C2DB654CFD34490AE324E0E776DD077A7F0DEB0C95DEFA55EB1629FEC6CBEE17` |
| `TamaGrid_0.6.0_x64.dmg` | `41A479A669E357F10E7E2BA2021656522202ACD3CE4C89D985E95D392004CE83` |
| `tamagrid-js.cdx.json` | `0191F7B0C82C9F1DBFE9635D18C03CB245E951DE3B3CEE9F70D81D4C177B1C54` |
| `THIRD_PARTY_NOTICES.md` | `9CFF93C6FB31E7E6EF8ED5D51EF7AB0D4B040FB37BC3ECF05156DBD151CA991C` |

Read-only package checks found `TamaGrid` version `0.6.0` in the MSI, safe archive paths and the expected arm64/x86_64 Mach-O executables in both app archives, and a valid UDIF `koly` trailer in both DMGs. Both Windows packages remained intentionally `NotSigned`. Microsoft Defender engine `1.1.26070.7` with definitions `1.457.159.0` scanned the exact downloaded tree with remediation disabled and reported no threats. Text-asset scans found no email-formatted string, private user path, or credential-shaped value.

The draft body was replaced with the tagged release notes before publication and read back as an exact normalized match. It was then published as the immutable prerelease [TamaGrid v0.6.0 Public Preview](https://github.com/tamas-hub/tamagrid/releases/tag/v0.6.0) at `2026-08-14T14:15:06Z`. Anonymous HTTP requests returned 200 for the release page, NSIS, MSI, Apple Silicon DMG, and Intel DMG. GitHub reports `draft=false`, `prerelease=true`, `immutable=true`, the exact tag target, and ten unchanged assets.

Post-publication readback found the repository still public with default branch `main`, zero open pull requests, zero open CodeQL, secret-scanning, and Dependabot alerts, and the same strict nine-check branch protection with admin enforcement, required signed commits, linear history, conversation resolution, and force-push/deletion disabled. No repository visibility, protection, secret, certificate, paid signing credential, organization-wide setting, or security bypass was changed. The published release cannot be modified or deleted; any correction must be reviewed and released as a new version such as `v0.6.1`. The independently downloaded verification set remains outside Git for recovery and reinspection.

Accepted limitations remain explicit: Windows Authenticode signing and macOS Developer ID signing/notarization are not configured; Artifact Attestation proves workflow provenance but does not replace those platform identities. The owner's native macOS Pass lacks exact package hash, device/OS metadata, and per-check evidence. Forced-crash packaged process-tree recovery was also unverified for the immutable `v0.6.0` assets; a later source candidate and native workflow result are recorded below without changing those assets. Rust dependency maintenance warnings remain documented and monitored; the release gates found no denied vulnerability, but this is not a guarantee that no unknown vulnerability exists.

## Post-v0.6.0 macOS abrupt-exit containment candidate (2026-08-15)

Local source now adds a macOS-only independent process-group guard. TamaGrid starts the same canonical app executable in a fixed internal mode, verifies a readiness pipe, and exposes the App Server transport only after the guard is watching both the TamaGrid owner PID and App Server group leader with `kqueue` `EVFILT_PROC / NOTE_EXIT`. If either exits, or monitoring setup fails, the guard terminates only the dedicated App Server process group. The guard accepts no shell or arbitrary command, refuses its own process group, validates the target group leader, and makes an unexpected guard failure a fail-closed transport disconnect.

The existing test-only packaged crash runner now builds and uses its deterministic App Server fixture on Windows and macOS. The fixture still creates its descendant only after the production transport containment gate; macOS additionally reports the guard PID so the outer runner proves that the guard itself does not remain. Frontend lint / 46 tests / production build, Rust formatting, all-feature Clippy, 15 Rust tests, and the updated five-second Windows packaged run pass. That run delivered 250 delta / 64,000 bytes with no gap, observed a 17 ms maximum frame gap, and recovered the fixture parent and descendant in 695 ms with no residue. The normal production binary and `dist` contain zero matches for all five test-only markers. Native compilation and Apple Silicon / Intel packaged forced-crash recovery were then verified by the exact GitHub workflow evidence below. No tag, release, release asset, repository setting, credential, signing material, or external publication was changed by the preceding local work.

The owner then explicitly replied `OK` after the exact external scope was presented: create `hardening/macos-process-guard` from public `main`, publish the reviewed changes as a GitHub-verified commit, open a Draft pull request, wait for every required check, and run the native Bundle smoke on both macOS Apple Silicon and Intel. This authorization does not include a tag, GitHub Release, merge, repository or organization setting change, secret, certificate, signing credential, visibility change, or security bypass. Immediately before publication, local and remote `main` both resolved to `316f58523aafe321bc85929ca12d33cdbf2c4edb`; the target remote branch and same-head pull request did not exist. Local Git signing was unavailable, so the authorized publication path is GitHub's signed commit API rather than an unsigned local commit.

The branch was created from that exact base and the reviewed 18-file tree was published as GitHub-verified commit [`12e1b19802826c14c20b83392d601c65fb4719bb`](https://github.com/tamas-hub/tamagrid/commit/12e1b19802826c14c20b83392d601c65fb4719bb) (`verified=true`, `reason=valid`). A file-by-file temporary-index comparison found zero differences between the remote tree and reviewed worktree. Draft pull request [#27](https://github.com/tamas-hub/tamagrid/pull/27) was opened against `main`; it remains open, Draft, and unmerged. All nine displayed required checks passed: Dependency Review, frontend, RustSec, Windows native, macOS native, three CodeQL analyzers, and the CodeQL aggregate.

Manual [Bundle smoke run 31847223651](https://github.com/tamas-hub/tamagrid/actions/runs/31847223651) executed the exact source commit on Windows x64, macOS Apple Silicon, and macOS Intel; all three jobs passed. Both macOS jobs delivered 1,500 delta / 384,000 bytes over 30 seconds with sequence gap 0 and latest-row distance 0 px; maximum frame gaps were 49 ms on Apple Silicon and 264 ms on Intel. After the packaged TamaGrid process was force-killed, the deterministic fixture parent, descendant, and independent guard all exited in 2,794 ms on Apple Silicon and 996 ms on Intel, below the five-second bound with zero residue. Windows also passed at 1,174 ms. Each job uploaded its unsigned short-lived manual-inspection bundle, but those artifacts were not downloaded or independently inspected in this step.

No tag, GitHub Release, release asset, merge, repository or organization setting, visibility, secret, certificate, signing credential, security bypass, or account permission was created or changed. Recovery remains a normal reviewed revert/close path: the Draft PR can be closed without changing `main`, and any later merged source correction must use a new pull request. The existing immutable `v0.6.0` release remains unchanged and does not contain this candidate.

## v0.7.0 release-closure candidate (2026-08-15)

The owner requested that the remaining work proceed and that the GitHub-related work be closed. For the existing public `tamas-hub/tamagrid` repository, this authorizes adding the reviewed local feature changes to Draft PR #27, running the protected checks, merging only after they pass, creating `v0.7.0` from the exact protected-main merge, validating the generated draft prerelease, and publishing it only if the documented artifact gate succeeds. It does not authorize repository transfer/deletion, visibility or protection changes, secrets, certificates, paid signing credentials, security bypasses, or organization-wide settings.

The local candidate adds an explicit visible-Pane destination for History resume, serialization and a bounded 90-second timeout for thread restore, a 3-column layout, per-Pane session clear with an empty-Pane start control, and a one-row compact composer footer with a dedicated send icon. Clearing a Pane removes only TamaGrid's assignment and best-effort unsubscribes it; it does not delete or archive the Codex history. Version metadata, README, changelog, security support line, releasing guide, checklist, and dedicated release notes are aligned at `0.7.0`.

Before any GitHub write, frontend lint, TypeScript production build, 51 frontend tests, 15 normal Rust tests, 16 all-feature Rust tests, denied-warning Clippy, JavaScript and Rust dependency gates, App Server schema compatibility, and the full three-minute packaged Tauri/WebView run passed locally. The packaged run delivered 9,000 delta / 2,304,000 bytes with sequence gap 0, maximum frame gap 33 ms, and latest-row distance 0 px. Its forced-crash probe recovered the production-Job-contained fixture parent and descendant in 642 ms with zero residue. No new dependency, credential, private path, conversation content, account data, signing material, or personal email address was added. Remote merge, tag, Release, and asset publication results are recorded only after they occur.

The local Windows bundle gate generated two ignored candidates without installing them. Read-only MSI inspection reported product `TamaGrid`, version `0.7.0`, and manufacturer `TamaGrid contributors`; both files remained intentionally `NotSigned`. Microsoft Defender engine `1.1.26070.7` with definition `1.457.159.0` scanned only these two files with remediation disabled and reported no threats.

| Local candidate | SHA-256 |
| --- | --- |
| `TamaGrid_0.7.0_x64-setup.exe` | `331449AB6FDD7D7DC149B76BFD94A420324DEB7920E546C2C3C96E604FE58330` |
| `TamaGrid_0.7.0_x64_en-US.msi` | `42D378CCDB1CB871C0BF5AC89A3C08393CACB481859EE08427AEE7CD2ED41EDD` |

## Published v0.7.0 verification (2026-08-15)

The reviewed release-closure tree was published through GitHub's signed commit API as commit `0dc75095745c9b8b6b3f5806a64a7cb169c967d3` on the existing pull-request branch. GitHub reported `verified=true` and `reason=valid`, and a temporary-index comparison found no difference between that remote tree and the reviewed local tree. Draft pull request [#27](https://github.com/tamas-hub/tamagrid/pull/27) was made ready and merged only after all nine required checks passed. The resulting protected-main squash commit is [`d1682c9ca0c7f7fb38defaab270f53424b8a81ec`](https://github.com/tamas-hub/tamagrid/commit/d1682c9ca0c7f7fb38defaab270f53424b8a81ec), which GitHub also reports as verified with reason `valid`. [CI 31852986256](https://github.com/tamas-hub/tamagrid/actions/runs/31852986256), [CodeQL 31852986348](https://github.com/tamas-hub/tamagrid/actions/runs/31852986348), and [Security audit 31852986230](https://github.com/tamas-hub/tamagrid/actions/runs/31852986230) all succeeded from that exact main commit.

Manual [Bundle smoke 31853599012](https://github.com/tamas-hub/tamagrid/actions/runs/31853599012) then rebuilt and ran the exact merge on Windows x64, macOS Apple Silicon, and macOS Intel. All three jobs delivered 1,500 delta / 384,000 bytes with sequence gap 0 and latest-row distance 0 px. Maximum frame gaps were 63 ms, 46 ms, and 485 ms respectively. After forced termination, each packaged app recovered the fixture parent and descendant, plus the macOS guard where applicable, with zero residue in 776 ms on Windows, 3,642 ms on Apple Silicon, and 1,054 ms on Intel. The three retained workflow bundles were independently downloaded: both macOS apps reported identifier `io.github.tamas-hub.tamagrid`, version/build `0.7.0`, and the expected arm64/x86_64 Mach-O CPU types; both DMGs had a valid `koly` trailer; the Windows MSI reported `TamaGrid` version `0.7.0`; both Windows files were `NotSigned`; and Microsoft Defender found no threat with remediation disabled.

Lightweight tag `v0.7.0` was created only after those gates and points exactly to the verified main merge. [Release workflow 31854285261](https://github.com/tamas-hub/tamagrid/actions/runs/31854285261) re-ran the release quality gate, built Windows x64 and both macOS architectures from the tag, ad-hoc signed the macOS apps with identity `-`, intentionally skipped notarization because no Apple signing credentials were configured, attached build and downloadable-package provenance, generated the JavaScript CycloneDX SBOM and checksum manifest, verified all six package attestations, and created a draft prerelease. Every workflow job succeeded.

| Published release file | SHA-256 |
| --- | --- |
| `RELEASE_NOTES.md` | `DCC387614AE9C32599C1C9B1EFE946B74CA86B688890F6911D6A03FFB6C83B91` |
| `SHA256SUMS.txt` | `D09A6DA7D0195853A48692153B3E097158BB3A0F9BFF37997CA501BFDC38F8AC` |
| `TamaGrid_0.7.0_aarch64.app.tar.gz` | `FBFF4C6F1FFF1188F191526606633850AE607EA9786A358F1A079013A64D0CBE` |
| `TamaGrid_0.7.0_aarch64.dmg` | `FD48DE8CBDDBE6383236571B22162D62750A215B1C8E888F88AC88915B39754A` |
| `TamaGrid_0.7.0_x64_en-US.msi` | `B6181EEB2129C9A12908868498F6E09EEA3A698AA30E85A50BD20D74DA4BC573` |
| `TamaGrid_0.7.0_x64-setup.exe` | `28394E47C7DAA83FD0D5F3B758278521B5705968FA0EBB90D00D23E84F8F4BA6` |
| `TamaGrid_0.7.0_x64.app.tar.gz` | `377E2F95666E020B69808E1FD537BD336FC4514FAAF191A7B34412695EE1772B` |
| `TamaGrid_0.7.0_x64.dmg` | `189BF8D97C463AAA36B2FE87FD77D1EC0E53754BBD0E8CFDF3437B7D418543E8` |
| `tamagrid-js.cdx.json` | `A3716D70EC6D87DEE19F122C4CB9CBF3B678B21BB20B2BC335CD3DDA02737680` |
| `THIRD_PARTY_NOTICES.md` | `9CFF93C6FB31E7E6EF8ED5D51EF7AB0D4B040FB37BC3ECF05156DBD151CA991C` |

An independent download matched all ten GitHub-reported SHA-256 digests and every one of the nine entries in `SHA256SUMS.txt`. `gh attestation verify` succeeded for all ten assets, including release notes, notices, SBOM, and the checksum manifest. Both app archives had safe single-root paths and no symlinks; their plists and Mach-O headers matched version `0.7.0` and the advertised CPU. Both DMGs had valid UDIF trailers. Read-only MSI inspection matched product `TamaGrid`, version `0.7.0`, and manufacturer `TamaGrid contributors`; the MSI and NSIS installer remained intentionally `NotSigned`. The SBOM parsed as CycloneDX 1.7 for `tamagrid` version `0.7.0`, and the downloaded notes/notices were byte-identical to the tagged source. Text-asset scans found zero email-formatted strings, private user paths, or recognized credential-shaped values. Microsoft Defender engine `1.1.26070.7` with definitions `1.457.169.0` scanned the entire downloaded verification tree with remediation disabled and found no threat.

The draft body was replaced with the tagged release notes and read back as an exact normalized match before publication. [TamaGrid v0.7.0 Public Preview](https://github.com/tamas-hub/tamagrid/releases/tag/v0.7.0) was published at `2026-08-15T01:08:42Z`. GitHub reports `draft=false`, `prerelease=true`, `immutable=true`, exact target `d1682c9ca0c7f7fb38defaab270f53424b8a81ec`, and ten assets. Anonymous, unauthenticated HTTP requests returned 200 for the release page and every asset.

Post-publication readback found the repository public with default branch `main`, zero open pull requests, zero open issues, and zero open CodeQL, secret-scanning, or Dependabot alerts. Main protection still requires the same nine checks, signed commits, admin enforcement, linear history, and conversation resolution, with force-push and deletion disabled. No visibility, protection, repository/organization permission, secret, certificate, paid signing credential, or security bypass was changed. The immutable release cannot be edited or deleted; any correction must use a reviewed new version. Accepted platform limitations remain Windows Authenticode signing and macOS Developer ID signing/notarization. Artifact Attestation proves workflow provenance but does not replace those platform identities, and successful gates cannot guarantee that no unknown vulnerability exists.
