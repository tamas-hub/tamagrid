# Releasing TamaGrid

TamaGridのGitHub Releaseは、未署名artifactを誤って正式版として公開しないため、tag push後もdraft prereleaseで停止します。

実施状況とrepository作成後に残る操作は [PUBLIC_RELEASE_CHECKLIST.md](../PUBLIC_RELEASE_CHECKLIST.md) で分離しています。

## Repository metadata

- Name: `tamagrid`
- Planned URL: `https://github.com/tamas-hub/tamagrid`
- Description: `Local-first multi-task desktop workspace for Codex App Server.`
- Status: Public Preview
- License: MIT
- Suggested topics: `codex`, `codex-app-server`, `tauri`, `rust`, `react`, `typescript`, `desktop-app`, `developer-tools`, `windows`, `macos`

`package.json` の `repository`、`homepage`、`bugs` は上記の公開予定URLへ揃えています。repository作成・push・Release公開はownerの明示的な実行判断後に行います。

## Naming record

公開名は `TamaGrid`（タマグリッド）へ統一します。

- Product / installer: `TamaGrid`
- Repository / package / Rust crate: `tamagrid`
- Tauri identifier: `io.github.tamas-hub.tamagrid`
- GitHub organization: `tamas-hub`

2026-08-13時点のGitHub上の予備確認では完全一致repositoryは確認されていませんが、これは商標・法人名・全package registryを含む法的clearanceを保証しません。最初の公開前にrepository ownerが最終確認します。

## Before tagging

1. `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` のversionを一致させる。
2. `CHANGELOG.md` とREADMEのProject statusを更新する。
3. 次を実行する。

```powershell
pnpm install --frozen-lockfile
pnpm audit --prod --audit-level high
pnpm check
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

4. [SECURITY_REVIEW.md](../SECURITY_REVIEW.md) のopen findingとresidual riskを確認する。
5. credential、private path、private log、signing keyがないことを確認する。
6. Windows / macOSの主要画面、native executable picker、danger confirmation、approval detail、Stop、history resumeを確認する。
7. [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) とlockfileのdependency inventoryがrelease内容と一致することを確認する。
8. `.github/workflows` のaction SHAがreview済みupstream commitを指すことを確認する。Dependabotが提案したSHA更新も内容を確認してからmergeする。

## Create the draft prerelease

```powershell
git tag v0.5.0
git push origin v0.5.0
```

tag pushで `.github/workflows/release.yml` がWindows NSIS / MSI、macOS app / dmg、tagと同名の `RELEASE_NOTES.md`、`THIRD_PARTY_NOTICES.md`、production JavaScript dependencyのCycloneDX SBOM、`SHA256SUMS.txt` をdraft prereleaseへ追加し、native artifact・release metadata・checksum manifestのGitHub Artifact Attestationを生成します。tag名に対応する `docs/release-notes/<tag>.md` がない場合、workflowは失敗します。tagの作成とpushはrepository ownerの明示的な公開判断後に行ってください。

## Manual release gate

GitHub上でdraftを開き、次を確認するまでPublishしません。

- CIと全platform buildが成功
- versionとartifact名が正しい
- `SHA256SUMS.txt` の全行が検証可能
- `RELEASE_NOTES.md`、`THIRD_PARTY_NOTICES.md`、`tamagrid-js.cdx.json` が存在し、checksum manifestに含まれる
- `gh attestation verify <artifact> --repo tamas-hub/tamagrid` が各配布artifactで成功
- checksum manifest自体のGitHub attestationが存在
- Windows artifactが署名済みであると誤表示されていない
- macOS artifactがnotarizedであると誤表示されていない
- final product名とrepository名の公開判断が完了
- README、CHANGELOG、known limitationsがrelease内容と一致
- credential、private path、個人情報を含むlogが添付されていない

## Unsigned release policy

- Release titleと本文でPublic Preview / unsignedを明示する。
- 利用者へSmartScreenやGatekeeperを無効化するよう案内しない。
- checksum不一致のartifactは実行しないよう案内する。
- certificate、private key、password、cloud signing credentialをrepositoryやartifactへ含めない。
- 将来署名を導入した場合も、署名検証とtimestamp確認をrelease gateへ残す。

Artifact AttestationはGitHub Actions上のbuild provenanceを示しますが、Windows AuthenticodeやApple Developer IDの代替ではありません。unsigned / ad-hoc signedの表示は、attestationを追加した後も維持します。

## Repository settings after creation

repository作成後、ownerがGitHub上で次を有効化・確認します。これらはlocal sourceから自動変更しません。

- Private vulnerability reporting
- Dependabot alerts and security updates
- default branch protection: required CI、review、force-push禁止
- Actionsのdefault `GITHUB_TOKEN` permissionをread-only
- tag / Releaseを作成できるroleの最小化
