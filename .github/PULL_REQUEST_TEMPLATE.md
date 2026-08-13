## Summary

Describe the user-visible change and why it is needed.

## Validation

- [ ] `pnpm check`
- [ ] `pnpm audit --prod --audit-level moderate`
- [ ] `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`
- [ ] `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] Relevant Windows and/or macOS behavior was checked, or the untested platform is stated below

## Safety and compatibility

- [ ] No credential, private path, private log, signing material or generated build output is included
- [ ] New App Server methods and fields fail closed where approval or authority is involved
- [ ] Model, reasoning and protocol values are discovered dynamically rather than assumed from a fixed list
- [ ] Documentation, tests and release notes were updated where needed

## Screenshots or notes

Add screenshots for UI changes and list any unverified behavior or follow-up work.
