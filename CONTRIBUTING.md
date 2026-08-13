# Contributing to TamaGrid

TamaGridへのcontributionを歓迎します。変更前にIssueまたは短い提案でscopeを共有してください。

参加するときは [Code of Conduct](CODE_OF_CONDUCT.md) も確認してください。security vulnerabilityはpublic Issueへ書かず、[Security policy](SECURITY.md) を利用します。

## Principles

- TamaGridはユーザー自身のCodex App Serverを利用し、Codexやmodelを提供しません。
- model ID、model名、reasoning effortをproduction codeへ固定しません。
- credential、API key、token、ChatGPT passwordを取得・保存しません。
- command / file changeをsilent approvalしません。
- WebViewへraw App Server method / params、raw executable pathを受けるcommandを公開しません。
- custom executableはRust native pickerとnative confirmationを通し、shell commandとして実行しません。
- `never` / `danger-full-access` を永続化せず、native just-in-time confirmationを迂回させません。
- stable APIを優先し、experimental APIは別提案として扱います。

## Setup

Tauriの[platform prerequisites](https://v2.tauri.app/start/prerequisites/)を準備したうえで実行します。

```powershell
pnpm install --frozen-lockfile
pnpm install:privacy-hook
pnpm check
cargo test --manifest-path src-tauri/Cargo.toml
```

`install:privacy-hook` はtracked hookをこのcloneのGit metadata内へ安全にコピーして有効化します。既存のpre-push hookやcustom hooks pathは上書きせず停止します。hookはpush対象のcommit author / committerとannotated taggerをGitHub noreply形式に限定し、address値を出力せず送信前に失敗させます。GitHub Freeではcommit metadata rulesetが実効しないため、cloneごとにこの設定が必要です。

実際のApp Serverを使う確認では、テスト用または自分自身のCodex環境だけを使用し、ログへ秘密情報を残さないでください。

## Pull requests

- 1つの目的に絞り、無関係なformat変更を混ぜない
- protocol変更にはwire event / race / error handlingのtestを追加する
- UI変更はdesktopと375px幅を確認し、色だけに依存しないstatus表現を維持する
- Windows固有変更はWindows、macOS固有変更はmacOSでbuildする
- READMEのsecurity、privacy、compatibility説明と実装を一致させる
- security-sensitive変更は `SECURITY_REVIEW.md` のfinding / residual riskとtest evidenceを更新する
- commitのauthor / committerとannotated taggerにはGitHubのnoreply addressを使う。tracked pre-push hookと必須CIは全ref / tagを検査し、実addressをlogへ出さずに拒否する

commit、Issue、PRへcredential、account email、private repository path、実command outputを含めないでください。
