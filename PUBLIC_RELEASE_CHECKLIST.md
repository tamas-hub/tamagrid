# TamaGrid public release checklist

Updated: 2026-08-15

This checklist separates completed source/repository work, published Public Preview releases, and remaining validation evidence. The public source repository and immutable releases are available on GitHub.

## Ready locally

- [x] Product and repository name standardized as `TamaGrid` / `tamagrid`
- [x] MIT license and public repository metadata present
- [x] Third-party dependency notice, bundle license metadata, and release SBOM generation present
- [x] README, contribution guide, code of conduct, security policy, architecture, release guide, and changelog present
- [x] Generic WebView RPC and executable-path IPC removed
- [x] Auto-detected and manually selected Codex executables require first-use/change confirmation and an exact SHA-256 match before launch
- [x] Dangerous Codex authority is native-confirmed per turn and not persisted
- [x] Command/file approvals fail closed when reviewable details are missing
- [x] Windows Job Object and Unix process-group containment implemented
- [x] Add a macOS-only independent `kqueue` guard so an abruptly terminated TamaGrid process cannot orphan its App Server process group
- [x] Window geometry and maximized/fullscreen state persist in Rust app config without a WebView capability
- [x] Opener plugin and unused capability removed
- [x] npm, Cargo, and GitHub Actions Dependabot configuration present
- [x] GitHub Actions use full commit SHAs and least-privilege job permissions
- [x] Pull-request Dependency Review, scheduled RustSec audit, and manual three-platform bundle-smoke workflows present
- [x] Draft-prerelease workflow includes checksums and GitHub Artifact Attestations
- [x] Frontend lint, 51 tests, TypeScript, and production build pass
- [x] Rust formatting, clippy with denied warnings, and 15 tests pass
- [x] History resume has an explicit visible-Pane target and thread lifecycle operations are serialized
- [x] 3-column layout, per-Pane session clear, and empty-Pane start controls are present and covered by component/state tests
- [x] Validate 100,000-delta floods in both Rust and renderer queues without payload loss or exceeding the configured bounds
- [x] Verify Windows Job Object descendant termination at runtime and gate the equivalent Unix process-group test in native macOS CI
- [x] Validate TamaGrid's stable App Server method, event, approval, and wire-value assumptions against the installed Codex version's generated JSON Schema
- [x] Run the isolated Windows packaged Tauri / WebView Channel test for 3 minutes: 9,000 delta / 2,304,000 bytes, sequence gaps 0, maximum frame gap 50 ms, and no app / WebView process left after exit
- [x] Keep the packaged-soak commands behind a non-default Rust feature and explicitly disable the frontend test bridge in production CI and release builds
- [x] Production npm audit reports no known vulnerabilities
- [x] Target-aware Rust advisory scan reviewed; five inherited maintenance notices documented
- [x] Windows x64 NSIS and MSI installers built successfully
- [x] Installer SHA-256 values independently rechecked
- [x] Windows Defender reports no threats in either installer
- [x] Unsigned status and SmartScreen warning documented without advising users to disable protection
- [x] Project scan found no representative token/private-key patterns or private local paths
- [x] Public repository created and the reviewed source tree pushed to `main`
- [x] Clean 128-file candidate restores from the frozen lockfile and passes frontend/Rust tests
- [x] Signed upstream commits verified for every pinned GitHub Action; checkout credentials are not persisted
- [x] Intel macOS bundle bootstrap uses exact pnpm 11.21.0 through pinned Node setup because the pnpm v11 native `darwin-x64` binary is affected by upstream `pnpm/pnpm#11423`; other jobs use the signed `pnpm/setup` successor

## Required after repository creation

- [x] Create `https://github.com/tamas-hub/tamagrid` as a public repository
- [x] Review the complete initial commit and push only the intended source tree
- [x] Enable Private Vulnerability Reporting
- [x] Enable secret scanning and push protection (validity checks and non-provider patterns are unavailable for this repository and remain disabled)
- [x] Enable Dependabot alerts and security updates
- [x] Initial CodeQL default scan succeeded with zero open alerts; checked-in advanced CodeQL now makes Actions, JavaScript/TypeScript, and Rust explicit PR checks
- [x] Set default Actions `GITHUB_TOKEN` permissions to read-only, disable workflow PR approval, restrict actions to an explicit allowlist, and require full SHA pinning
- [x] Protect `main` with strict App-bound required checks, pull requests, signed commits, admin enforcement, linear history, resolved conversations, and force-push/delete restrictions
- [x] Run the hardened CI on pull request #7 and confirm Dependency Review, RustSec, CodeQL for three languages, Windows, and macOS jobs succeed
- [x] Confirm GitHub recognizes every pinned Action used by CI and bundle smoke
- [x] Run unsigned bundle smoke from the hardened main commit on Windows x64, macOS arm64 and macOS x64; inspect all three nonempty workflow artifacts and verify expected package/architecture metadata
- [x] Re-run all three bundles after the Intel-macOS pnpm fallback; inspect 3 artifacts / 22 nonempty files, verify architecture/metadata/hashes, and scan the downloaded tree with Microsoft Defender
- [x] Classify `glib` advisory `GHSA-wrw7-89jp-8q8g` as not used only after locked target graphs prove it unreachable on supported Windows/macOS targets; keep RustSec monitoring and reassess before Linux support
- [x] Confirm draft-release Artifact Attestation permissions and verify every attestation after an explicitly authorized tag run
- [x] Review repository description, topics, MIT license detection, and final public README rendering
- [x] Add and review a custom 1280×640 repository social-preview image
- [x] Perform manual Windows installer and UI smoke tests on an installed build
- [x] Record the repository owner's native macOS result as Pass in [`docs/MACOS_MANUAL_TEST.md`](docs/MACOS_MANUAL_TEST.md). Exact package hash, device/OS metadata, and per-check evidence were not supplied and remain disclosed
- [x] Run and inspect the updated three-platform Bundle smoke from the `v0.6.0` candidate; Windows x64, macOS arm64, and macOS x64 all passed the 30-second packaged Tauri / WebView Channel gate in [run 31777776881](https://github.com/tamas-hub/tamagrid/actions/runs/31777776881)
- [x] Rebuild exact merged `main` commit `4d2706b4a0a9d261f9b459805c08c2875d1650c3` and complete Windows clean-install, published `v0.5.0` upgrade, launch, settings/history preservation, uninstall, reinstall, and final shutdown checks before tagging `v0.6.0`
- [x] Push `v0.5.0` from protected `main` only after explicit owner authorization
- [x] Verify every draft-release hash and `gh attestation verify` result
- [x] Confirm `RELEASE_NOTES.md`, `THIRD_PARTY_NOTICES.md`, and `tamagrid-js.cdx.json` are attached and covered by `SHA256SUMS.txt`
- [x] Publish the draft prerelease only after the owner completes the manual release gate

## Published `v0.5.0` evidence

- Release: <https://github.com/tamas-hub/tamagrid/releases/tag/v0.5.0>
- Tag commit: `c4b9425a0e92c4ed4a13e1b295b7df9401a2f414`, contained in protected `main`
- Release workflow: <https://github.com/tamas-hub/tamagrid/actions/runs/31757215002>; quality, Windows x64, macOS arm64, macOS x64, checksums, and provenance verification succeeded
- Assets: ten exact nonempty files; `SHA256SUMS.txt` covers the other nine files and all nine values were independently reproduced
- Provenance: `gh attestation verify` succeeded for all ten files, including both downloadable `.app.tar.gz` archives
- Package integrity: NSIS, MSI, two DMGs, and two `.app.tar.gz` archives passed independent structure/integrity checks
- Malware scan: Microsoft Defender definition `1.457.150.0` reported no threats in the downloaded release tree with remediation disabled
- Privacy: the release assets do not contain the clone's configured author email; text assets contain no email-formatted strings; the Git metadata privacy check passed
- Publication: anonymous release-page access returned HTTP 200 and anonymous Windows installer retrieval returned HTTP 206; GitHub reports `draft=false`, `prerelease=true`, `immutable=true`, and ten assets
- Repository presentation: GitHub serves the reviewed custom social-preview image through the public repository `og:image`

## Published `v0.6.0` evidence

- Release: <https://github.com/tamas-hub/tamagrid/releases/tag/v0.6.0> (`TamaGrid v0.6.0 Public Preview`)
- Tag commit: `7d021df3efca9c56b8440e1b2183c8eadd5a3b8c`, contained in protected `main`
- Final release-record pull request: [#24](https://github.com/tamas-hub/tamagrid/pull/24); all nine required checks passed before its GitHub-verified squash merge
- Release workflow: <https://github.com/tamas-hub/tamagrid/actions/runs/31806120272>; quality, Windows x64, macOS arm64, macOS x64, checksums, and provenance verification succeeded
- Assets: ten exact nonempty files; `SHA256SUMS.txt` covers the other nine files and all nine values were independently reproduced. GitHub API digests independently matched all ten files
- Provenance: `gh attestation verify` succeeded independently for all ten files, including both downloadable `.app.tar.gz` archives
- Package integrity: MSI metadata reported `TamaGrid` version `0.6.0`; both app archives had safe paths and the expected Mach-O architecture; both DMGs had valid UDIF trailers; Windows packages remained intentionally `NotSigned`
- Malware scan: Microsoft Defender engine `1.1.26070.7` with definition `1.457.159.0` reported no threats in the downloaded release tree with remediation disabled
- Privacy: the four text assets contained no email-formatted string, private user path, or credential-shaped value; the tagged Git metadata privacy check passed
- Publication: anonymous HTTP requests returned 200 for the release page, NSIS, MSI, Apple Silicon DMG, and Intel DMG. GitHub reports release ID `370611832`, `draft=false`, `prerelease=true`, `immutable=true`, and ten unchanged assets
- Repository state after publication: public, default branch `main`, zero open pull requests, zero open CodeQL/secret-scanning/Dependabot alerts, and the same strict nine-check protection with signed commits, admin enforcement, no force pushes, and no branch deletion
- Manual limitation at `v0.6.0` publication: the repository owner reported native macOS Pass, but exact package hash, device/OS metadata, and per-check evidence were not supplied. The immutable release assets also predate the later forced-crash guard and its native workflow evidence

## Accepted public-preview limitations

- Windows artifacts are not Authenticode-signed.
- macOS artifacts are not Developer ID signed or notarized.
- GitHub Artifact Attestation proves workflow provenance but does not replace platform code signing.
- Repository-level immutable releases prevent modification after publication, but do not establish publisher identity or replace platform code signing.
- High-frequency deltas are bounded/coalesced before the Tauri Channel and again in the renderer. Both queue layers preserve the full payload under a 100,000-delta automated stress test. A three-minute Windows packaged Tauri / WebView test also completed without loss or residual processes. The updated 30-second three-platform workflow passed on Windows x64, macOS arm64, and macOS x64. The repository owner-reported `v0.6.0` app Pass still lacks exact package/device/OS evidence; the later deterministic forced-crash fixture is separately verified on both macOS architectures in run 31847223651 and is not part of the immutable `v0.6.0` assets.
- Tauri currently brings five `unic-*` unmaintained advisories through `tauri-utils -> urlpattern`; no severity-bearing exploit advisory was identified in the Windows/macOS target-aware scan.
- Cargo.lock includes Tauri's Linux-only GTK `glib 0.18.5`; its unsoundness advisory is unreachable on all supported release targets and is classified `not_used`, but must be reassessed if Linux becomes supported.
- The owner-authorized privacy rewrite replaced personal author/committer metadata across all nine historical `main` commits with GitHub noreply metadata while preserving the source tree and commit topology. Rewritten historical signatures are no longer valid, but required signed commits is restored for future `main` changes. GitHub email privacy, exposed-email push blocking, and the required CI metadata check prevent recurrence. Provider-managed pull-request/cache dereferencing remains tracked in [the privacy rewrite record](docs/PRIVACY_HISTORY_REWRITE_RECORD.md).

## `v0.7.0` release closure

- [x] Include the post-`v0.6.0` Windows/macOS abrupt-exit containment work
- [x] Include explicit History targets, serialized thread restore, 3-column layout, Pane clear/start, and compact composer controls
- [x] Align package, Cargo, Tauri, README, changelog, security policy, and release-note version metadata at `0.7.0`
- [x] Run the 3-minute Windows packaged Tauri/WebView gate: 9,000 delta / 2,304,000 bytes, sequence gaps 0, maximum frame gap 33 ms, latest-row distance 0 px; forced-crash fixture recovery 642 ms with zero residue
- [x] Build local `v0.7.0` NSIS/MSI candidates, read MSI product/version metadata, record SHA-256, confirm both are intentionally unsigned, and pass a remediation-disabled Microsoft Defender scan
- [ ] Update Draft PR #27 with the exact reviewed candidate and pass every required check
- [ ] Merge PR #27 through protected `main` without bypassing signed-commit or CI requirements
- [ ] Create `v0.7.0` only from the exact protected-main merge and let the release workflow build a draft prerelease
- [ ] Independently verify all release assets, checksums, attestations, versions, package structure, privacy, and malware scan
- [ ] Publish the verified prerelease and confirm anonymous access, zero open PRs/issues, and repository security state

## Post-`v0.6.0` hardening included in the candidate

- [x] Add a test-only fixture that starts through the production `StdioTransport` and creates a real descendant only after Windows Job Object assignment
- [x] Force-terminate the isolated packaged Tauri app and verify the fixture parent and descendant both exit within five seconds; all four 2026-08-15 Windows runs recovered both within 695 ms with zero residual fixture or TamaGrid processes
- [x] Rebuild the normal production binary without the test feature and confirm that the test command, environment-variable prefix, fixture name, and start-gate method have zero binary marker matches
- [x] Extend the same packaged forced-crash runner to macOS Apple Silicon and Intel without adding the fixture or test IPC to production builds
- [x] Run the equivalent packaged forced-crash recovery test on native macOS Apple Silicon and Intel. [Bundle smoke 31847223651](https://github.com/tamas-hub/tamagrid/actions/runs/31847223651) used exact source commit `12e1b19802826c14c20b83392d601c65fb4719bb`; both jobs delivered 1,500 delta / 384,000 bytes with sequence gap 0 and latest-row distance 0 px, then removed the fixture parent, descendant, and guard in 2,794 ms (Apple Silicon) / 996 ms (Intel) with zero residue
- This hardening is after the immutable `v0.6.0` tag and is not present in its published assets. It is included in the reviewed `v0.7.0` candidate and becomes release evidence only after the tag/build gate succeeds
