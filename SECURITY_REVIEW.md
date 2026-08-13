# TamaGrid v0.5.0 セキュリティレビュー

実施日: 2026-08-13
対象: React 19 / TypeScript / Vite / Tauri 2 / Rust / Codex App Server stdio / GitHub Actions release

## 結論

初回レビューで検出したHigh 2件、Medium 4件、Low 2件はすべてsource上で修正または強く緩和しました。追加レビューでは、Codex executableの初回自動検出と更新後のidentity再確認、account responseの最小化、Rust側delta bufferのhard bound、event送信順序の競合、PR依存差分検査、RustSec監査を追加しました。Tauri Channel内部のqueue上限はアプリ側から直接設定できないため、event-flood stress testはresidual validationとして継続します。

主要変更は、raw RPC commandの廃止、method別Rust DTO、Codex executableのnative確認とSHA-256 pinning、危険turnのnative JIT confirmation、高権限値の非永続化、approval context表示と情報不足時のApprove無効化、account response最小化、bounded/coalesced event処理、Windows Job Object / Unix process group、active-turn interrupt、Actions SHA pin / least privilege / Dependency Review / RustSec / Artifact Attestationです。

- Critical: 0
- High open: 0（resolved: 2）
- Medium open: 0（resolved in source: 4）
- Low open: 0（resolved: 1、strongly mitigated with residual validation: 1）
- Informational / residual risk: 2

推奨判断: source公開は継続可能です。binary releaseはまだ作成せず、今回追加したhardened PR CI、3-platform bundle smoke、GitHub security settings、macOS runtime、process-tree / event-flood stress test、署名なしinstallerの最終手動gateを通してから判断します。「脆弱性がない」ことを保証する評価ではありません。

## Initial findings and remediation

### TG-SEC-001 — WebViewからraw App Server paramsを送れて、Rust側で危険policyを再検証しない

- Severity: **High**（WebView侵害が前提）
- Status: **Resolved in source** — generic `request_app_server` を削除し、method別typed command、`deny_unknown_fields` DTO、length / enum / absolute cwd validation、Rust側payload再構築へ変更。danger authorityはnative confirmationなしに送信不可。
- Rule ID: `TAURI-IPC-001`
- Location:
  - `src/codex/bridge.ts:51-53`
  - `src-tauri/src/codex/manager.rs:17-30`
  - `src-tauri/src/codex/manager.rs:154-170`
  - `src/codex/adapter.ts:181-197`
- Evidence: frontendの `request(method, params)` が任意JSONを `request_app_server` へ渡します。Rust側はmethod名だけをallowlist検証し、`turn/start` の `approvalPolicy`、`sandboxPolicy`、`cwd`、inputをmethod別に再構築・検証していません。
- Impact: WebViewで任意JavaScriptが実行された場合、UIの警告や設定画面を通らず `thread/start` と `turn/start` を呼び、`approvalPolicy: "never"` と `sandboxPolicy: {"type":"dangerFullAccess"}` を指定できます。Codexを介したuser権限のcommand/file operationへ昇格し得ます。
- Recommended fix: generic `request_app_server(method, params)` を公開せず、`start_thread`、`start_turn`、`interrupt_turn`、`read_thread` などのtyped Tauri commandへ分割します。Rust側で各DTOをdeserializeし、未知fieldを拒否し、danger modeはRustが発行する短命なone-time consent tokenと組み合わせてください。
- Mitigation already present: local bundleのみ、厳しいCSP、remote pageなし、Reactの通常エスケープ、App Server method allowlist。
- Confidence: High。Tauri公式も、Rust/WebView間で受け渡すdataを強く定義しないと権限昇格につながると説明しています。[Tauri Security](https://v2.tauri.app/security/)

### TG-SEC-002 — WebView指定の任意 `.exe` をidentity確認より先に実行する

- Severity: **High**（WebView侵害またはstorage改ざんが前提）
- Status: **Resolved in source** — `connect_app_server` はpath argumentを受けず、自動検出・手動選択の両方で初回、path変更、SHA-256変更時にRust native confirmationを要求。canonical pathとfingerprintをRust側app configへ保存し、`--version` 検証後と `app-server` 起動直前にもfileの不変性を確認する。legacy preferenceは一度再承認が必要。
- Rule ID: `TAURI-IPC-002`
- Location:
  - `src/codex/bridge.ts:35-44`
  - `src-tauri/src/codex/manager.rs:40-55`
  - `src-tauri/src/codex/manager.rs:225-232`
  - `src-tauri/src/codex/manager.rs:285-336`
  - `src/state/workspace.ts:168-172`
  - `src/App.tsx:594-604`
- Evidence: `connect_app_server` はfrontendから絶対pathを受け、`validate_candidate` がそのfileを `--version` 付きで起動した後にstdoutへ `codex` が含まれるか確認します。pathはlocalStorageへ保存され、次回起動時に自動接続されます。
- Impact: identity判定の時点ですでに対象exeが実行済みです。WebView侵害が起きれば、任意exeを `--version` で起動でき、成功文字列の検証は実行防止になりません。storage改ざん後の次回起動でも同様です。
- Recommended fix: frontendからraw pathを受けない設計へ変更します。native file pickerまたはbackend検出結果に対してopaque IDを返し、canonical pathと必要ならpublisher/signature/hashをRust側で保存してください。新規path・hash変更時はnative側の明示確認を要求し、起動時auto-runはbackendで承認済みのrecordだけに限定します。
- Mitigation already present: absolute path、regular file、Windows `.exe`、canonicalization、shell不使用、fixed argv。
- Confidence: High。Tauriでは登録したcustom commandが既定で全window/webviewから利用可能なため、command実装側の検証が重要です。[Tauri Capabilities](https://v2.tauri.app/security/capabilities/)

### TG-SEC-003 — Approval画面がsecurity-relevant contextを十分に表示しない

- Severity: **Medium**
- Status: **Resolved in source** — reason、exact command、cwd、network target、command actions、file changes / diff、item IDを分離表示。command / network / parsed actionまたはfile change detailがないrequestはApproveをdisabledにし、Denyだけを許可。
- Rule ID: `CODEX-APPROVAL-001`
- Location:
  - `src/state/protocol.ts:118-144`
  - `src/components/index.tsx:565-589`
  - `src/state/protocol.ts:296-335`
- Evidence: command approvalは主に `reason` と `command`、file change approvalは `Item: <itemId>` のみです。`cwd`、parsed `commandActions`、network contextの全field、policy amendment、`grantRoot`、対象file/diffとの明示的な紐付けをapproval card内で確認できません。
- Impact: commandがnull/曖昧な場合やfile changeの場合、利用者が実行範囲を十分理解せずApproveする可能性があります。approvalはこのアプリの主要安全境界なので、opaque item IDだけで許可できる状態は避けるべきです。
- Recommended fix: itemIdでtimeline itemと厳密にcorrelateし、command、cwd、parsed actions、network host、target paths、diff summary、grant root、policy changesをapproval cardに表示します。必須情報が欠ける場合はApproveをdisableしてDeny/Cancelだけを許可します。
- Mitigation already present: command/file event自体はtimelineにも表示され、response ID/methodはRustで照合され、unknown requestは承認されません。
- Confidence: High。

### TG-SEC-004 — `danger-full-access` と `never` が永続化され、送信時の再確認がない

- Severity: **Medium**
- Status: **Resolved in source** — `never` / `danger-full-access` はworkspaceへ保存せず、thread start / resume時はsafe baselineへ戻す。各dangerous turnはpolicy、sandbox、cwdを示すRust native dialogで毎回確認。
- Rule ID: `CODEX-POLICY-001`
- Location:
  - `src/components/index.tsx:698-732`
  - `src/components/index.tsx:798-802`
  - `src/state/workspace.ts:205-229`
  - `src/state/workspace.ts:288-299`
  - `src/codex/adapter.ts:181-197`
- Evidence:危険なsandboxとapproval policyはpane設定としてlocalStorageへ保存され、後続turnへそのまま適用されます。設定popover内には警告がありますが、composer常設表示とsend時のjust-in-time confirmationはありません。
- Impact: 過去に選んだ危険設定を忘れたまま、別のtaskを承認なし・sandboxなしで実行するhuman-errorが起こり得ます。
- Recommended fix: `danger-full-access` と `never` の組合せは永続化しないか、毎session/毎threadで再承認させます。composerに常時表示する高コントラストbadgeと、最初のsend時にcwd・policyを含む確認を追加してください。
- Mitigation already present: optionは明示選択で、popover内にdanger warningがあります。
- Confidence: High。

### TG-SEC-005 — App Serverの直接childだけをkillし、process treeをcontainしていない

- Severity: **Medium**
- Status: **Resolved in source; runtime stress test pending** — active turn notificationをtransportで追跡し、shutdown前にbest-effort interrupt。Windows kill-on-close Job ObjectとUnix process groupを追加し、stdin close / 3秒wait後にprocess treeを終了。
- Rule ID: `TAURI-LIFECYCLE-001`
- Location:
  - `src-tauri/src/codex/transport.rs:73-90`
  - `src-tauri/src/codex/transport.rs:418-441`
  - `src-tauri/src/lib.rs:21-25`
- Evidence:正常終了はstdin closeと3秒wait、その後 `child.kill()` です。Windows Job ObjectやmacOS process groupの設定はありません。また終了時にactive turnを先にinterruptするmanager stateもありません。
- Impact: App Serverが起動したcommand/tool processが子孫として残る実装の場合、TamaGrid終了後も処理が続く可能性があります。利用者が「アプリを閉じたので停止した」と誤認し、file/network operationが継続するおそれがあります。
- Recommended fix: active turnを追跡してclose前にbest-effort `turn/interrupt`、短いgrace、stdin close、wait、最後にprocess tree killの順にします。Windowsでは `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` のJob ObjectへApp Serverを割り当て、macOSでは専用process groupを管理します。[Microsoft Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)
- Mitigation already present: `kill_on_drop(true)`、stdin close、bounded wait、direct child kill。
- Confidence: Medium。static code上の欠落は確認済みですが、実際に残るdescendant processのruntime再現は今回行っていません。

### TG-SEC-006 — Release workflowがmutable action tagとworkflow-wide write tokenを使う

- Severity: **Medium**
- Status: **Resolved in workflow source; first GitHub run pending** — actionを実在確認済みのfull SHAへpin、checkoutのcredential persistenceを無効化し、workflow defaultを`contents: read`へ縮小。write / OIDC / attestation権限を必要jobだけへ付与し、tag qualityへRust fmt / clippy / test、artifact + release metadata + checksum attestation、Dependabotを追加。
- Rule ID: `REACT-SUPPLY-001`
- Location:
  - `.github/workflows/ci.yml:19-21`
  - `.github/workflows/ci.yml:36-42`
  - `.github/workflows/release.yml:8-9`
  - `.github/workflows/release.yml:15-17`
  - `.github/workflows/release.yml:41-51`
  - `.github/workflows/release.yml:73-95`
- Original evidence: 修正前は `actions/checkout@v4`、`pnpm/action-setup@v4`、`dtolnay/rust-toolchain@stable`、`tauri-apps/tauri-action@v0` などmutable refを使用し、release全jobへ `contents: write` が付与され、Dependabot設定もありませんでした。
- Remediation evidence: 初回remediationで6種類・22箇所の `uses:` をfull SHAへ固定し、古い無効な `pnpm/action-setup` SHAも署名済みv6.0.9 commitへ置換しました。最終hardeningではsuperseded `pnpm/action-setup`を公式後継`pnpm/setup` v2.0.2へ移行。tag / commit署名を検証し、exact SHAへ固定しました。pnpm v11 native binaryの上流`darwin-x64`不具合`pnpm/pnpm#11423`を避けるIntel bundle jobだけ、署名検証済み`actions/setup-node`とlifecycle script無効のexact npm packageを使います。最終状態は9 upstream repository・29箇所で、すべてupstream存在・署名を再検証済みです。全checkoutは `persist-credentials: false` です。
- Impact: action tagまたはaction supply chainが侵害された場合、release binaryの改変、draft releaseの改変、repository contentへの書込につながり得ます。
- Recommended fix: すべてのactionをreview済みfull commit SHAへpinし、Dependabotの`github-actions`更新を有効化します。workflow既定は `contents: read`、`publish` と `checksums` jobだけ `contents: write` にします。tag buildでもnative test/clippyを必須にし、公開repoではGitHub artifact attestationも検討してください。GitHubはfull SHA pinとleast privilegeを推奨しています。[GitHub Actions hardening](https://docs.github.com/en/code-security/tutorials/secure-your-organization/protect-against-threats) / [GITHUB_TOKEN permissions](https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-what-your-workflow-does/controlling-permissions-for-github_token)
- Mitigation already present: frozen pnpm / Cargo lockfile、draft prerelease、手動公開、checksum、CycloneDX SBOM、third-party notice、Artifact Attestation、CIのread-only token。
- Confidence: High。

### TG-SEC-007 — 未使用のOpener plugin権限がWebViewへ露出している

- Severity: **Low**
- Status: **Resolved** — Opener plugin、JS / Rust dependency、`opener:default` capabilityを削除。native dialogはRust内部だけで使用し、WebView permissionは付与しない。
- Rule ID: `TAURI-CAP-001`
- Location:
  - `src-tauri/capabilities/default.json:6-9`
  - `src-tauri/src/lib.rs:8-10`
  - `package.json:39-42`
- Evidence: `opener:default` とplugin初期化・依存はありますが、frontendからOpener APIを使う実装は見つかりませんでした。security documentの「arbitrary navigationなし」という説明とも不一致です。
- Impact: WebView侵害時に不要なURL openとfile reveal機能が追加で利用可能になります。
- Recommended fix: 現在不要ならplugin、JS/Rust依存、`opener:default` を削除します。将来必要になった場合は、必要なcommandとURL/path scopeだけを個別許可します。default permissionはHTTP(S)、mailto、telのopenとfile revealを許可します。[Tauri Opener permissions](https://v2.tauri.app/plugin/opener/)
- Confidence: High。

### TG-SEC-008 — Protocol event queueにbounded backpressureがない

- Severity: **Low**（availability）
- Status: **Strongly mitigated / residual validation** — Rust側でdeltaを20 ms単位にcoalesceし、合計1 MiB / 256 event、coalesced event 128 KiBへhard-bound。terminal / approval / error前にarrival orderでflushし、sequence割当とChannel送信を同一lockで直列化。frontendも1,024 event上限、delta coalescing、hard-limit synchronous flushを持つ。Tauri Channel内部queueの直接設定とevent-flood runtime stress testは未完了。
- Rule ID: `TAURI-AVAIL-001`
- Location:
  - `src-tauri/src/codex/transport.rs:22-24`
  - `src-tauri/src/codex/transport.rs:301-306`
  - `src-tauri/src/codex/transport.rs:353-355`
  - `src/App.tsx:173-180`
  - `src/App.tsx:232-237`
- Remediation evidence: 対象deltaは `(method, generation, threadId, turnId, itemId)` 相当のrouting keyで隣接分だけ結合し、上限到達時は古いbatchを先にflushします。terminal eventはdropせず、delta batchを先に送ります。stdout reader、stderr reader、process monitor、periodic flushの並行送信はsequenceとdeliveryの逆転が起きないよう直列化しました。
- Impact: 大量command outputや高速deltaによりrenderer memory/CPUが増え、UI freezeまたはcrashが起こり得ます。
- Recommended fix: Rust側にbounded channelを置き、deltaを `(generation, threadId, turnId, itemId)` 単位でcoalesceします。terminal/approval/error eventはdropしないpriority queueとし、line limitも実測に基づいて引き下げを検討します。
- Mitigation already present: protocol / diagnostic frame length limit、Rust-side bounded delta batching、frontend frame batchingとhard limit、state event/detail truncation。
- Confidence: Medium。stress testは今回行っていません。

## Informational / residual risks

### TG-SEC-009 — Tauri経由のunmaintained Unicode crate

- Severity: **Informational**
- Status: **Open upstream dependency risk** — TamaGridから直接利用していないためTauri更新で追跡。Dependabotを追加。
- Rule ID: `RUSTSEC-MAINT-001`
- Evidence: Windows x64、macOS x64、macOS arm64のtarget-aware dependency graphを照合すると、各targetで5件の `INFO Unmaintained` が検出されました。`unic-char-property`、`unic-char-range`、`unic-common`、`unic-ucd-ident`、`unic-ucd-version` で、dependency pathは `tauri-utils -> urlpattern -> unic-ucd-ident` です。既知のexploit advisoryではありません。[RUSTSEC-2025-0081](https://rustsec.org/advisories/RUSTSEC-2025-0081.html) / [RUSTSEC-2025-0100](https://rustsec.org/advisories/RUSTSEC-2025-0100.html)
- Recommendation: TamaGrid側で直接置換せず、Tauri/tauri-utilsの更新でupstream解消を追跡します。CIへRustSec/OSV監査を追加し、unmaintained warningとvulnerabilityを別扱いにしてください。
- Audit nuance: Cargo.lock全体のRustSec監査は、未対応Linux専用のGTK graphにある`glib` unsound warning `RUSTSEC-2024-0429`も報告します。`cargo tree`でWindows/macOS 3 targetから`glib`が到達不能であることを確認したため、CIではこの1件だけ理由付きignoreとし、実vulnerability、将来のunsound、yanked crateは失敗させます。

### TG-SEC-010 — Windows installerはAuthenticode未署名

- Severity: **Informational / distribution trust risk**
- Status: **Accepted for Public Preview / strongly mitigated** — unsigned表示、checksum、GitHub Artifact Attestationをrelease workflowへ追加し、repository-level immutable releasesを有効化。これらはAuthenticode署名の代替ではなく、tagを伴う実際のattestation生成は未実行。
- Rule ID: `RELEASE-SIGN-001`
- Evidence: NSISとMSIの `Get-AuthenticodeSignature` はともに `NotSigned`。SHA-256は同梱 `SHA256SUMS.txt` と一致しました。release notesとREADMEにも未署名が明記されています。
- Impact: GitHub account/release自体が侵害された場合、同じ場所に置かれたinstallerとchecksumを同時に差し替えられるため、checksumだけではpublisher identityを証明できません。SmartScreen警告も残ります。
- Recommendation: 現状はPublic Preview/unsignedを明記したまま配布可能です。費用をかけずに補強するならGitHub artifact attestationでbuild provenanceを付け、検証手順をREADMEへ追加します。これはAuthenticodeの代替ではありません。Tauriも署名は実行必須ではないが、browser download時のSmartScreen信頼に影響すると説明しています。[Tauri Windows code signing](https://v2.tauri.app/distribute/sign/windows/) / [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)

### TG-SEC-011 — 既存public commitのprovenanceとauthor metadata

- Severity: **Informational / privacy and provenance**
- Status: **Mitigated for future commits; published history unchanged** — repository-local Git identityはGitHub noreply addressへ変更。hardening pull request #7はGitHub上でsquash mergeされ、main commitの署名はverified/valid。`main`はrequired signed commitsとstrict PR checksで保護済み。既存5 commitの書換えはpublic history、open Dependabot PR、cloneを無効化するため未実施。
- Evidence: 現在公開済み5 commitはすべてunsignedで、全件のauthor metadataにnoreplyではないaddressが残っています。値自体はこの報告やlogへ再掲しません。
- Recommendation: mainへrequired signed commitsを有効化し、以後はGitHub上のverified squash mergeまたは管理された署名keyを使います。既存metadataを完全に消す場合だけ、影響範囲を確認して別途明示許可の上でhistory rewrite / force-pushを行います。

## 確認できた良い点

- `dangerouslySetInnerHTML`、`innerHTML`、`eval`、`new Function`、`document.write`、`postMessage`、remote `fetch`、WebSocket、service worker、iframe、remote scriptは検出なし。
- Codex/モデル出力はReact text nodeとして描画され、HTMLとして解釈されません。
- Tauri CSPが有効で、scriptはselfへ限定され、`unsafe-eval` とscript用 `unsafe-inline` はありません。remote script/fontもありません。TauriはCSPをXSSの影響低減に使い、信頼するsourceへ絞るよう推奨しています。[Tauri CSP](https://v2.tauri.app/security/csp/)
- OpenAI API key、session token、email、usage snapshot、message body、command outputをlocalStorageへ保存していません。
- secret-like filenameおよび代表的token/private-key patternのproject scanは0件。
- App Serverはshellを介さずfixed `app-server` argvで起動し、stdout/stderrを分離しています。
- WebViewからraw RPC method / executable pathを受けず、Rust側のmethod別DTOでresponse ID/result/error、approval method、input length、enum、absolute path、frame length、generation、timeout/EOFを検証しています。
- unknown server requestはauto-approveせず、`accept` / `decline` 以外を拒否します。
- dangerous authorityはnative dialogでturnごとに確認し、high-risk valueを永続化しません。
- App Server process treeはWindows Job Object / Unix process groupへcontainします。
- GitHub Actionsはfull SHA pin、least privilege、draft release、checksum、Artifact Attestationを組み合わせます。
- GitHub repositoryはPrivate Vulnerability Reporting、secret scanning / push protection、Dependabot security updates、read-only workflow token、action allowlist、required SHA pinning、immutable releasesを有効化。`main`は9個のApp-bound check、PR、signed commit、admin enforcement、linear history、conversation resolutionで保護し、force push / deletionを禁止。CodeQL / secret / Dependabot open alertは0件。Actions / JavaScript・TypeScript / Rustの明示的なCodeQL advanced workflowがPRをgateする。
- installerのSHA-256は同梱manifestと一致しました。

## 実行した検証

- `pnpm audit --prod --audit-level moderate`: **No known vulnerabilities found**
- `pnpm check`: ESLint、44 tests、TypeScript、Vite production build **pass**
- `cargo fmt --check`: **pass**
- `cargo clippy --all-targets -- -D warnings`: **pass**
- `cargo test`: Rust 11 tests **pass**（executable fingerprint、bounded version output、account minimization、delta coalescing、diagnostic redactionを含む）
- `pnpm tauri build --no-bundle`: 現行hardening sourceのWindows production executable link **pass**
- OSV query: lock済みcrateをtarget別に照合
  - Windows x64: 266 crates、5 unmaintained warning、severity-bearing / exploit vulnerability 0
  - macOS x64: 259 crates、5 unmaintained warning、severity-bearing / exploit vulnerability 0
  - macOS arm64: 259 crates、5 unmaintained warning、severity-bearing / exploit vulnerability 0
- `pnpm tauri build --bundles 'nsis,msi'`: Windows x64 NSIS / MSI **pass**
- Microsoft Defender custom scan (`-DisableRemediation`): NSIS / MSIとも **no threats found**
- release executable smoke test: hidden launchでwindow生成、close後の直下child process **0**
- native window-state test: `137,119 / 1024x700` の位置・サイズが再起動後に完全一致し、最大化状態も復元、通常終了 **30〜68 ms**
- Authenticode: NSIS / MSIとも `NotSigned`
- SHA-256: NSIS `49CF25C80F793547B9C7897881BB2568034D585722ED0F564CEEC0AF18328288`、MSI `D58A6DDBEBB911D74F37258BAB895250764759750B6DDE3A870B9E6A100A9521`。release setの `SHA256SUMS.txt` と一致
- clean candidate check: ignore適用後128ファイルだけを新規directoryへ複製し、`pnpm install --frozen-lockfile`、frontend 44 tests / production build、Rust 7 testsを生成物ゼロから再実行して **pass**
- GitHub Actions static check: 5 workflowを含むGitHub YAML 9件がparse **pass**、29のaction useがfull SHA。9 upstream repositoryすべてのcommitが存在し、署名検証`verified=true`。`pnpm/setup` v2.0.2はannotated tagとcommitの両方が`verified=true / reason=valid`。
- GitHub CodeQL initial setup: run `31710120357` **success**、open CodeQL alert 0、open secret scanning alert 0、open Dependabot alert 0
- GitHub hardened PR #7: CI run `31712898233`、CodeQL run `31712898252`、Security Audit run `31712898256` **all success**。squash merge commit `0354da25e465937f5fd51315a178b967913b8b6d` はGitHub署名 `verified=true / reason=valid`。
- GitHub bundle smoke run `31714221594`: 同じmerge commitからWindows x64 NSIS/MSI、macOS arm64/x64 app/dmgをbuild **all success**。3 artifact / 22 files / zero-length 0、Mach-O architecture・bundle ID・version一致。download済みartifact全体のMicrosoft Defender scan（修復無効）は **no threats found**、Windows 2 artifactは想定どおり`NotSigned`。

## 限界

- sourceとlocal buildを対象としたstatic / dependency reviewです。第三者penetration testや形式検証ではありません。
- 実際の悪意あるWebView payload、Codex prompt injection、sandbox escapeは実行していません。
- descendant process残留とevent floodはruntime stress reproductionをしていません。queue上限のunit testは実施済みでも、Tauri/WebViewを含む長時間負荷試験の代替ではありません。
- release executableの基本起動・終了smoke testは通過しましたが、長時間turnや多段descendant、強制crashを含むstress testの代替ではありません。
- OSV/RustSec照合は監査時点の公開databaseに依存し、未知脆弱性を否定するものではありません。
- OS WebView2、Codex CLI、OpenAI serviceそのものの脆弱性は対象外です。
