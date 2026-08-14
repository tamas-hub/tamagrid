# Security policy

## Supported versions

TamaGrid `v0.5.0` is published as an immutable Public Preview prerelease. Security fixes are applied to `main`; support covers the latest published 0.5.x preview only. Windows artifacts are not Authenticode-signed, and macOS artifacts are not Developer ID signed or notarized. Verify the GitHub Release origin, `SHA256SUMS.txt`, and GitHub Artifact Attestation before installing.

## Reporting a vulnerability

Please use [GitHub Private Vulnerability Reporting](https://github.com/tamas-hub/tamagrid/security/advisories/new). Include the affected version, reproduction steps, impact, and any suggested mitigation.

Private Vulnerability Reporting is enabled. Do not post secrets, exploit code, personal data, command output, or sensitive paths in a public issue.

You should receive an acknowledgement within seven days. Please allow time for a fix before public disclosure.

## Scope

Security-sensitive areas include the Tauri IPC boundary, Codex executable selection, App Server JSONL transport, command and file-change approvals, sandbox and approval-policy handling, release artifacts, and dependency or workflow integrity.

General hardening details and the local threat model are documented in [docs/SECURITY.md](docs/SECURITY.md).
