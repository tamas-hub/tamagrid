# Security policy

## Supported versions

TamaGrid `v0.7.0` is published as an immutable Public Preview prerelease. Security fixes are applied to `main`; support covers the latest published 0.7.x preview only. Windows artifacts are not Authenticode-signed, and macOS artifacts are not Developer ID signed or notarized. Verify the GitHub Release origin, `SHA256SUMS.txt`, and GitHub Artifact Attestation before installing.

## Reporting a vulnerability

Please use [GitHub Private Vulnerability Reporting](https://github.com/tamas-hub/tamagrid/security/advisories/new). Include the affected version, reproduction steps, impact, and any suggested mitigation.

Private Vulnerability Reporting is enabled. Do not post secrets, exploit code, personal data, command output, or sensitive paths in a public issue.

You should receive an acknowledgement within seven days. Please allow time for a fix before public disclosure.

## Scope

Security-sensitive areas include the Tauri IPC boundary, Codex executable selection, App Server JSONL transport, command and file-change approvals, sandbox and approval-policy handling, release artifacts, and dependency or workflow integrity.

General hardening details and the local threat model are documented in [docs/SECURITY.md](docs/SECURITY.md).

## Security model at a glance

The WebView is treated as an untrusted input boundary. Rust validates each typed operation before it reaches the user's local Codex App Server.

| Boundary | Control and evidence |
| --- | --- |
| Executable launch | Canonical native path, native first-use/change confirmation, SHA-256 pinning and pre-launch recheck; fixed arguments without a shell. See [manager.rs](src-tauri/src/codex/manager.rs). |
| IPC and authority | Method-specific DTOs reject unknown fields and validate lengths, identifiers, paths and enums. Elevated modes require per-turn native confirmation. See [manager.rs](src-tauri/src/codex/manager.rs). |
| Approvals | Command/file context is shown before Approve/Deny; unsupported requests fail closed and stale approvals are rejected. See [protocol handling](src/state/protocol.ts) and [transport](src-tauri/src/codex/transport.rs). |
| Local data | No TamaGrid credential store, relay, or custom telemetry. Conversation bodies, command output, diffs, pending approvals, and elevated policy values are not persisted. See [workspace persistence](src/state/workspace.ts). Codex's own network and storage behavior remains separate. |
| Process lifecycle | Windows Job Objects and macOS process groups plus an independent crash guard; bounded shutdown and isolated packaged regression fixtures. See [transport](src-tauri/src/codex/transport.rs) and [process guard](src-tauri/src/process_guard.rs). |
| Dependencies and releases | Frontend/development dependency audit, RustSec, CodeQL, protected PR checks, checksums, JavaScript SBOM, and attestations. See [release policy](docs/RELEASING.md). |

Read the [dated security review](SECURITY_REVIEW.md) for findings, remediation, residual risks, and validation limits. This is maintainer review and automated validation, not a third-party penetration test or a guarantee that vulnerabilities are absent. Preview binaries remain unsigned/not notarized as described above.
