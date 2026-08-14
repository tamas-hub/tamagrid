# TamaGrid public release checklist

Updated: 2026-08-14

This checklist separates completed source/repository work, the published Public Preview, and the remaining platform validation. The public source repository and immutable `v0.5.0` prerelease are available on GitHub.

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
- [x] Window geometry and maximized/fullscreen state persist in Rust app config without a WebView capability
- [x] Opener plugin and unused capability removed
- [x] npm, Cargo, and GitHub Actions Dependabot configuration present
- [x] GitHub Actions use full commit SHAs and least-privilege job permissions
- [x] Pull-request Dependency Review, scheduled RustSec audit, and manual three-platform bundle-smoke workflows present
- [x] Draft-prerelease workflow includes checksums and GitHub Artifact Attestations
- [x] Frontend lint, 44 tests, TypeScript, and production build pass
- [x] Rust formatting, clippy with denied warnings, and 11 tests pass
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
- [ ] Review repository description, topics, social preview, license detection, and README rendering (description/topics/license completed; social preview and final rendered README remain)
- [x] Perform manual Windows installer and UI smoke tests on an installed build
- [ ] Perform native macOS launch, history-resume, picker, approval, and shutdown checks (both native architecture builds already pass)
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

## Accepted public-preview limitations

- Windows artifacts are not Authenticode-signed.
- macOS artifacts are not Developer ID signed or notarized.
- GitHub Artifact Attestation proves workflow provenance but does not replace platform code signing.
- Repository-level immutable releases prevent modification after publication, but do not establish publisher identity or replace platform code signing.
- High-frequency deltas are bounded/coalesced before the Tauri Channel and again in the renderer. The Channel's internal queue is not directly configurable, and event-flood stress testing remains open.
- Tauri currently brings five `unic-*` unmaintained advisories through `tauri-utils -> urlpattern`; no severity-bearing exploit advisory was identified in the Windows/macOS target-aware scan.
- Cargo.lock includes Tauri's Linux-only GTK `glib 0.18.5`; its unsoundness advisory is unreachable on all supported release targets and is classified `not_used`, but must be reassessed if Linux becomes supported.
- The owner-authorized privacy rewrite replaced personal author/committer metadata across all nine historical `main` commits with GitHub noreply metadata while preserving the source tree and commit topology. Rewritten historical signatures are no longer valid, but required signed commits is restored for future `main` changes. GitHub email privacy, exposed-email push blocking, and the required CI metadata check prevent recurrence. Provider-managed pull-request/cache dereferencing remains tracked in [the privacy rewrite record](docs/PRIVACY_HISTORY_REWRITE_RECORD.md).
