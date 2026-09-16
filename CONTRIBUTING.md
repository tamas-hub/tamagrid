# Contributing to TamaGrid

Contributions are welcome. Share the scope in an issue or a short proposal before starting a substantial change. English and Japanese reports are welcome.

Read the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately through the [Security policy](SECURITY.md), not in public issues. See [MAINTAINERS.md](MAINTAINERS.md) for responsibility and maintenance priorities.

## Principles

- Use the user's own Codex App Server; do not provide Codex or models.
- Discover model IDs, model names, and reasoning efforts instead of hard-coding them in production.
- Do not collect or store credentials, API keys, tokens, or ChatGPT passwords.
- Never silently approve commands or file changes.
- Do not expose raw App Server method/params or executable-path commands to the WebView.
- Select custom executables through the Rust native picker and confirmation, and launch without a shell.
- Do not persist `never` / `danger-full-access` or bypass native just-in-time confirmation.
- Prefer stable APIs; discuss experimental APIs as a separate proposal.

## Setup

Use Node.js 22.13+ (an even-numbered LTS release), the pinned pnpm 11.21.0, and stable Rust. Install the [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/): Microsoft C++ Build Tools and WebView2 on Windows, or Xcode Command Line Tools on macOS. Fork the repository, clone your fork, and create a branch for the change.

```powershell
pnpm install --frozen-lockfile
pnpm install:privacy-hook
pnpm dev
```

The browser preview uses simulated events without starting Codex or reading an account. Use `pnpm tauri dev` for the native application and `pnpm tauri build` for a production package on your OS.

The privacy-hook installer copies the tracked hook into this clone's Git metadata. It stops without overwriting an existing pre-push hook or custom hooks path. The hook checks author/committer and annotated-tagger metadata on all pushed refs, permits GitHub noreply identities, and fails without printing address values. Configure a GitHub noreply identity locally in your clone before committing. Repository rules require verified signatures on every branch; do not bypass those rules. See [Architecture](docs/ARCHITECTURE.md) before changing the protocol boundary.

## Checks

```powershell
pnpm check
pnpm audit --audit-level moderate
pnpm check:commit-emails
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

`pnpm check` runs ESLint, frontend tests, TypeScript checking, and the production frontend build. The dependency audit includes development tools as well as production packages.

For Codex compatibility changes, run `pnpm check:app-server-schema` against a trusted native Codex executable. It generates temporary schemas without reading account or conversation data; `TAMAGRID_CODEX_EXECUTABLE` can select the executable. For process lifecycle or streaming changes, use `pnpm test:packaged-soak -- --duration-ms 180000` and the platform checks in [Releasing](docs/RELEASING.md). RustSec auditing uses the command and documented target-specific exception in that guide; do not add broad ignores to pass a check.

Use only your own or a dedicated test Codex environment for live checks, and keep secrets out of logs. Clearly distinguish preview fixtures, schema checks, and actual authenticated runtime validation.

## Pull requests

- Keep the change focused and avoid unrelated formatting.
- Add wire-event, race, and error-handling tests for protocol changes.
- Check UI changes at desktop and 375px widths; preserve status cues that do not rely only on color.
- Build Windows-specific changes on Windows and macOS-specific changes on macOS; disclose unavailable checks.
- Keep README security, privacy, and compatibility claims aligned with the implementation.
- Update findings, residual risks, and evidence in `SECURITY_REVIEW.md` for security-sensitive changes.
- Use the PR template to explain the problem, changes, validation, and safety impact. All required checks must pass before a protected merge.
- Keep commit author/committer and annotated-tagger addresses in GitHub noreply form. The hook and required CI inspect refs/tags without exposing address values.

Do not include credentials, account email, private repository paths, or unredacted command output in commits, issues, or PRs. Release tags and publication follow the separate [manual release gate](docs/RELEASING.md#manual-release-gate); documentation changes alone do not need a release.
