# Security policy

## Supported versions

TamaGrid is currently a public preview. Security fixes are provided for the latest published version only.

## Reporting a vulnerability

Please use [GitHub Private Vulnerability Reporting](https://github.com/tamas-hub/tamagrid/security/advisories/new). Include the affected version, reproduction steps, impact, and any suggested mitigation.

If private reporting is not yet available, do not post secrets, exploit code, or sensitive paths in a public issue. Open a minimal issue asking the maintainers to enable a private contact channel.

You should receive an acknowledgement within seven days. Please allow time for a fix before public disclosure.

## Scope

Security-sensitive areas include the Tauri IPC boundary, Codex executable selection, App Server JSONL transport, command and file-change approvals, sandbox and approval-policy handling, release artifacts, and dependency or workflow integrity.

General hardening details and the local threat model are documented in [docs/SECURITY.md](docs/SECURITY.md).
