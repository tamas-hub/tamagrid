# Security policy and design

## Supported scope

0.5.xはPublic Previewです。現在の公開releaseは`v0.5.0`で、security fixはmain branchへ適用し、最新の公開0.5.xだけを対象にします。脆弱性の非公開報告手順はrepository rootの [SECURITY.md](../SECURITY.md) を参照してください。

## Trust boundary

TamaGridのWebViewは信頼済みUIではありますが、security boundaryとしてはuntrusted inputとして扱います。React側の表示や警告だけに依存せず、process起動、App Server method、parameter、危険な権限はRust側で再検証します。

## Security controls

### Process execution

- 自動検出・手動選択のどちらも、初回・path変更・SHA-256変更時はRust側native confirmationを必須化
- WebView、Tauri command argument、localStorageから実行pathを受け付けない
- 承認したcanonical pathとSHA-256 fingerprintはWebView storageではなくOSのTamaGrid app configへ保存
- `--version` 検証後と `app-server` 起動直前にfingerprintを再計算し、途中でfileが変わった場合は実行しない
- `--version` のstdout / stderrは各64 KiB、実行時間は8秒へ制限し、超過時はchildを終了
- Windows custom pathはnative `.exe` の絶対pathに限定
- shell、`cmd /c`、PowerShell wrapperを使わず、argvはTamaGridが固定する `app-server` だけ
- stdin / stdout / stderrを分離し、stdoutだけをprotocolとしてparse
- Windowsはkill-on-close Job Object、Unixは専用process groupへcontain
- 終了時はactive turnをbest-effort interruptし、stdin close、3秒以内のwait、process-tree killをfallbackにする

native pickerで選択したfile自体の安全性はTamaGridだけでは証明できません。公式または信頼できる配布元のCodex executableだけを選択してください。

### Typed IPC and protocol

- WebViewからraw JSON-RPC methodを渡すgeneric commandは公開しない
- `account/read`、model、thread、review、turnごとに別のtyped Tauri commandを使う
- Rust DTOはunknown fieldを拒否し、enum、absolute cwd、identifier、search、message lengthをmethod別に検証
- thread start / resumeは既存Codex設定に関係なく `on-request` + `workspace-write` のsafe baselineへ戻す（明示的な `untrusted` / `read-only` は保持）
- JSON IDの型を維持したexact correlationと、responseのresult / error排他を検証
- protocol lineは16 MiB、diagnostic lineは64 KiBへ制限
- timeout、EOF、crash時にpending response、approval、active-turn trackingを破棄
- reconnect generationでstale reader / eventを隔離
- unknown server requestを自動承認しない
- high-frequency deltaはRust側で20ms単位にcoalesceし、合計1 MiB / 256 event、1 event 128 KiBへhard-boundする。terminal / approval前に必ずflushし、全eventのsequence割当と送信を直列化する
- WebView側も1,024 event上限とdelta coalescingを持ち、terminal / approval eventはdropしない

### Approval and elevated authority

command executionとfile changeは対象Paneへ表示し、ユーザーがApprove / Denyを選びます。approval cardは利用可能な範囲で次を分離表示します。

- reason
- exact command
- working directory
- network target
- parsed command actions
- requested file changes / diff
- App Server item ID

server requestの元IDをそのまま1回だけresponseへ使い、turn終了やdisconnect後のlate approvalには応答しません。

`approvalPolicy: never` または `danger-full-access` を使うturnは、WebView内の選択だけでは開始できません。Rustがpolicy、sandbox、cwdを表示するnative confirmationを毎回開き、拒否時はturnを送信しません。これらの高権限値はworkspaceへ永続化せず、再起動・thread resume時はsafe baselineへ戻します。

TamaGridはCodexがturn内で生成するcommand execution itemを表示・承認できますが、sandbox外で任意commandを直接実行するUIは提供しません。Pull Request準備はlocal branch・差分・testの確認とtitle / body案までに制限し、commit、push、remote branch作成、`gh pr create` は明示的な別操作なしに行いません。

### Data and credentials

TamaGridはOpenAI credentialを要求・保存しません。`initialize` responseは互換性確認にだけ使ってWebViewへ転送せず、`account/read` responseはRust側でtype / plan / authentication requirementだけへ縮小し、Codex home、email、token、未知fieldをWebViewへ渡しません。rate-limit metadataはCodexから読み取りますが、利用量snapshotをpersistenceへ保存しません。独自telemetryはなく、App Server stderrにcredential、email、user directory markerがある行はredactします。

WebView storageへ会話本文、command output、diff、pending approval、credential、custom executable path、高権限policyは保存しません。

### WebView

Tauri windowはlocal bundleだけを読み込み、Content Security Policyでdefault sourceをselfへ限定します。remote page、remote transport、arbitrary navigation、Opener plugin権限はありません。native dialog pluginはRust内部だけで利用し、WebView capabilityへは公開しません。

ウィンドウ状態の保存は公式Window State pluginをRust側だけで使用します。WebViewへplugin permissionを付与せず、保存対象はサイズ、位置、最大化、全画面、復元時の表示状態に限定します。

### Release supply chain

- GitHub Actionsはthird-party actionをreview済みfull commit SHAへpin
- workflow default tokenは `contents: read`、release upload jobだけ必要なwrite権限を付与
- tag releaseでもfrontend check、Rust fmt、clippy、testをgateにする
- Windows / macOS artifactとchecksum manifestへGitHub Artifact Attestationを生成
- Dependabotでnpm、Cargo、GitHub Actionsを週次確認
- pull requestでmoderate以上の新規dependency riskをDependency Reviewにより拒否し、Cargo.lockをRustSecでpush / PR / 週次監査
- Actions、JavaScript / TypeScript、RustをCodeQL security-extended queryでpush / PR / 週次解析
- manual Bundle smokeでWindows x64、macOS Apple Silicon / Intelの実bundleを生成し、短期artifactとして人が確認可能
- releaseはdraft prereleaseで停止し、checksum、attestation、unsigned表記を人が確認してから公開

## Residual risks

- ユーザーがnative pickerで明示的に選んだCodex executable自体の信頼性
- CodexおよびOpenAI service側のsecurity / privacy
- ユーザーが内容を確認してapprovalしたcommandやfile change
- Authenticode未署名 / Developer ID未notarized preview binaryに対するOS警告
- Tauri transitive dependencyに残るunmaintained Unicode crate群（既知vulnerabilityは別途継続監視）
- Tauri Channel自体の内部実装はTamaGridからhard-boundできない。送信前delta bufferとWebView受信queueはbounded/coalesced化し、両層で100,000 deltaのpayload保持・上限試験を通過したが、packaged Tauri/WebViewを含む長時間soak testは継続課題

SmartScreenやGatekeeperを無効化せず、release origin、SHA-256、GitHub attestationを確認してください。Artifact AttestationはOS code signingの代替ではありません。
