# TamaGrid public release checklist

Updated: 2026-08-14

This checklist separates verified source/repository work from the remaining release gate. The public source repository exists; no tag or GitHub Release has been created.

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
- [ ] Confirm draft-release Artifact Attestation permissions and verify every attestation after an explicitly authorized tag run
- [ ] Review repository description, topics, social preview, license detection, and README rendering (description/topics/license completed; social preview and final rendered README remain)
- [ ] Perform manual Windows UI smoke tests on an installed build
- [ ] Perform native macOS launch, history-resume, picker, approval, and shutdown checks (both native architecture builds already pass)
- [ ] Push `v0.5.0` only after the above checks are complete
- [ ] Verify every draft-release hash and `gh attestation verify` result
- [ ] Confirm `RELEASE_NOTES.md`, `THIRD_PARTY_NOTICES.md`, and `tamagrid-js.cdx.json` are attached and covered by `SHA256SUMS.txt`
- [ ] Publish the draft prerelease only after the owner completes the manual release gate

## Accepted public-preview limitations

- Windows artifacts are not Authenticode-signed.
- macOS artifacts are not Developer ID signed or notarized.
- GitHub Artifact Attestation proves workflow provenance but does not replace platform code signing.
- Repository-level immutable releases prevent modification after publication, but do not establish publisher identity or replace platform code signing.
- High-frequency deltas are bounded/coalesced before the Tauri Channel and again in the renderer. The Channel's internal queue is not directly configurable, and event-flood stress testing remains open.
- Tauri currently brings five `unic-*` unmaintained advisories through `tauri-utils -> urlpattern`; no severity-bearing exploit advisory was identified in the Windows/macOS target-aware scan.
- The public repository's five pre-hardening commits are unsigned and contain a non-noreply author address in immutable commit metadata. Future local commits use the repository-specific GitHub noreply address; rewriting published history requires a separate destructive-operation decision.
