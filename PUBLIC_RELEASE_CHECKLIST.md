# TamaGrid public release checklist

Updated: 2026-08-13

This checklist separates work verified locally from actions that can only be completed after the public GitHub repository exists. No repository, tag, release, or external account setting was created during the local preparation.

## Ready locally

- [x] Product and repository name standardized as `TamaGrid` / `tamagrid`
- [x] MIT license and public repository metadata present
- [x] Third-party dependency notice, bundle license metadata, and release SBOM generation present
- [x] README, contribution guide, code of conduct, security policy, architecture, release guide, and changelog present
- [x] Generic WebView RPC and executable-path IPC removed
- [x] Dangerous Codex authority is native-confirmed per turn and not persisted
- [x] Command/file approvals fail closed when reviewable details are missing
- [x] Windows Job Object and Unix process-group containment implemented
- [x] Window geometry and maximized/fullscreen state persist in Rust app config without a WebView capability
- [x] Opener plugin and unused capability removed
- [x] npm, Cargo, and GitHub Actions Dependabot configuration present
- [x] GitHub Actions use full commit SHAs and least-privilege job permissions
- [x] Draft-prerelease workflow includes checksums and GitHub Artifact Attestations
- [x] Frontend lint, 44 tests, TypeScript, and production build pass
- [x] Rust formatting, clippy with denied warnings, and 7 tests pass
- [x] Production npm audit reports no known vulnerabilities
- [x] Target-aware Rust advisory scan reviewed; five inherited maintenance notices documented
- [x] Windows x64 NSIS and MSI installers built successfully
- [x] Installer SHA-256 values independently rechecked
- [x] Windows Defender reports no threats in either installer
- [x] Unsigned status and SmartScreen warning documented without advising users to disable protection
- [x] Project scan found no representative token/private-key patterns or private local paths
- [x] Local `main` repository and planned `origin` configured without creating or changing GitHub state
- [x] Clean 128-file candidate restores from the frozen lockfile and passes frontend/Rust tests
- [x] Signed upstream commits verified for every pinned GitHub Action; checkout credentials are not persisted

## Required after repository creation

- [ ] Create `https://github.com/tamas-hub/tamagrid` as a public repository
- [ ] Review the complete initial commit and push only the intended source tree
- [ ] Enable Private Vulnerability Reporting
- [ ] Enable Dependabot alerts and security updates
- [ ] Enable CodeQL/default code scanning for the supported JavaScript/TypeScript and Rust source
- [ ] Set default Actions `GITHUB_TOKEN` permissions to read-only
- [ ] Protect the default branch with required CI, review, and force-push restrictions
- [ ] Run CI once on a pull request and confirm Windows/macOS jobs succeed
- [ ] Confirm GitHub recognizes the pinned Actions and attestation permissions
- [ ] Review repository description, topics, social preview, license detection, and README rendering
- [ ] Perform manual Windows UI smoke tests on an installed build
- [ ] Perform native macOS build, launch, history-resume, picker, approval, and shutdown checks
- [ ] Push `v0.5.0` only after the above checks are complete
- [ ] Verify every draft-release hash and `gh attestation verify` result
- [ ] Confirm `RELEASE_NOTES.md`, `THIRD_PARTY_NOTICES.md`, and `tamagrid-js.cdx.json` are attached and covered by `SHA256SUMS.txt`
- [ ] Publish the draft prerelease only after the owner completes the manual release gate

## Accepted public-preview limitations

- Windows artifacts are not Authenticode-signed.
- macOS artifacts are not Developer ID signed or notarized.
- GitHub Artifact Attestation proves workflow provenance but does not replace platform code signing.
- The Rust-to-Tauri event path is not fully hard-bounded; the renderer queue is bounded/coalesced and event-flood stress testing remains open.
- Tauri currently brings five `unic-*` unmaintained advisories through `tauri-utils -> urlpattern`; no severity-bearing exploit advisory was identified in the target-aware scan.
