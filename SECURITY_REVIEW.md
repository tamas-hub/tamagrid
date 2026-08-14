# TamaGrid v0.5.0 セキュリティレビュー

実施日: 2026-08-13
対象: React 19 / TypeScript / Vite / Tauri 2 / Rust / Codex App Server stdio / GitHub Actions release

## 公開後ステータス更新（2026-08-14）

このレビューはbinary release公開前に実施しました。その後、保護された`main`に含まれるcommit `c4b9425a0e92c4ed4a13e1b295b7df9401a2f414`から`v0.5.0`をbuildし、[immutable Public Preview prerelease](https://github.com/tamas-hub/tamagrid/releases/tag/v0.5.0)として公開しました。

- release workflow [31757215002](https://github.com/tamas-hub/tamagrid/actions/runs/31757215002)はquality、Windows x64、macOS arm64、macOS x64、checksums、provenance verificationの全jobが成功
- 公開assetは10件。`SHA256SUMS.txt`の9項目を独立再計算し、10 assetすべての`gh attestation verify`、6 packageのarchive integrity、Microsoft Defender scanを通過
- 公開後記録を反映した`main` commit `27e7476263b04569efbea8ee2db09bd5ec57419f`でCI、CodeQL、Security auditが成功し、open CodeQL / secret scanning / Dependabot alertは各0
- Windows Authenticode署名、macOS Developer ID署名 / notarization、macOS実機Pass報告の詳細証拠、macOS packaged appの強制crash試験はPublic Preview制限として継続。Windows packaged Tauri / WebViewの3分間負荷試験は2026-08-14、隔離強制crash試験は後続`main`で2026-08-15に完了
- 追加hardeningでは、Rustとrendererそれぞれで100,000 deltaのpayload保持とqueue上限を確認し、Windows Job Objectが実際のdescendant processを終了するruntime testを通過。Unix process-groupの同等testもnative macOS CIへ追加
- privacy rewrite後の現行`main`はnon-noreply metadata 0件。GitHub管理の全17 PR / 20 PR commitを再測定すると、merged PR #9、#10、#11経由でnon-noreply metadataを持つ旧commit 3件が引き続き到達可能。値と旧SHAは公開せず、provider側dereference / garbage collection依頼を継続

以下の公開前判断と検証値は監査時点の履歴として保持します。「binary release未作成」「tag付きattestation未実行」という記述より、この公開後ステータス更新を現在値として優先してください。

## Post-v0.6.0 main hardening update (2026-08-15)

Windowsのtest-only packaged appから、productionと同じ `StdioTransport` / kill-on-close Job Objectでfixture親processを起動し、割当完了後に孫processを生成しました。外側のrunnerがTauri appだけを強制終了する試験を4回行い、fixture親・孫はすべて695 ms以内で両方終了、TamaGridを含む残留processは0でした。実Codex、account、credential、thread、利用枠には接続していません。

fixture binary、IPC state、環境変数は `packaged-soak-test` featureだけに存在します。通常production buildをfeatureなし・`VITE_TAMAGRID_SOAK=0`で再生成し、test command、fixture名、環境変数prefix、start-gate methodのbinary markerが各0件であることを確認しました。

macOS sourceには、TamaGrid親processを`kqueue`の`EVFILT_PROC / NOTE_EXIT`で監視する独立guardを追加しました。guardは同一app binaryの固定internal modeで、shellや任意commandを受け付けません。guard ready後だけtransportを公開し、親の強制終了時はApp Server専用process groupを終了します。guard自身の予期しない終了や監視errorでもApp Server groupを終了し、pending response、approval、active turnをdisconnect処理で破棄します。同じpackaged crash runnerをmacOS Apple Silicon / Intelへ拡張しましたが、native workflow結果は未確定です。実Codex commandを使う長時間・多段descendant試験は未実施で、この変更はimmutable `v0.6.0` assetには含まれません。

## 結論

初回レビューで検出したHigh 2件、Medium 4件、Low 2件はすべてsource上で修正または強く緩和しました。追加レビューでは、Codex executableの初回自動検出と更新後のidentity再確認、account responseの最小化、Rust側delta bufferのhard bound、event送信順序の競合、PR依存差分検査、RustSec監査を追加しました。100,000 deltaの自動stress testはRust / rendererの両queueで通過しました。さらに、実際のWindows packaged Tauri / WebViewで3分間・9,000 delta・2,304,000 bytesをsequence gap 0、最大frame gap 50 ms、終了後の残留process 0で完走しました。

主要変更は、raw RPC commandの廃止、method別Rust DTO、Codex executableのnative確認とSHA-256 pinning、危険turnのnative JIT confirmation、高権限値の非永続化、approval context表示と情報不足時のApprove無効化、account response最小化、bounded/coalesced event処理、Windows Job Object / Unix process group、active-turn interrupt、Actions SHA pin / least privilege / Dependency Review / RustSec / Artifact Attestationです。

- Critical: 0
- High open: 0（resolved: 2）
- Medium open: 0（resolved in source: 4）
- Low open: 0（resolved: 1、strongly mitigated with residual validation: 1）
- Informational / residual risk: 2

初回推奨判断では、hardened PR CI、3-platform bundle smoke、GitHub security settings、署名なしinstallerの最終手動gateを通してからbinary releaseを判断するとしました。これらの公開gate完了後に`v0.5.0` Public Previewを公開済みです。Windows packaged appの長時間stream試験は追加完了し、repository ownerからmacOS実機Passの報告を受けました。macOSのpackage hash・機種・OS・項目別証拠と、強制crash・多段descendantを含むend-to-end終了試験は安定版判断前の継続課題です。「脆弱性がない」ことを保証する評価ではありません。

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
- Status: **Resolved in source; Windows packaged coverage complete, macOS packaged validation pending** — active turn notificationをtransportで追跡し、shutdown前にbest-effort interrupt。Windows kill-on-close Job ObjectとmacOS process groupを追加し、stdin close / 3秒wait後にprocess treeを終了。Windowsではunit testに加え、実際のpackaged Tauri appを強制終了してfixture親・孫が残留しないことを外側から確認。macOSは親TamaGridの異常終了を監視する独立guardと同じpackaged testをsourceへ追加。
- Rule ID: `TAURI-LIFECYCLE-001`
- Location:
  - `src-tauri/src/codex/transport.rs:73-90`
  - `src-tauri/src/codex/transport.rs:203-289`
  - `src-tauri/src/codex/transport.rs:724-770`
  - `src-tauri/src/codex/soak.rs`
  - `scripts/run-packaged-soak.mjs`
- Original evidence:正常終了はstdin closeと3秒wait、その後 `child.kill()` でした。Windows Job ObjectやmacOS process groupの設定はなく、終了時にactive turnを先にinterruptするmanager stateもありませんでした。
- Impact: App Serverが起動したcommand/tool processが子孫として残る実装の場合、TamaGrid終了後も処理が続く可能性があります。利用者が「アプリを閉じたので停止した」と誤認し、file/network operationが継続するおそれがあります。
- Recommended fix: active turnを追跡してclose前にbest-effort `turn/interrupt`、短いgrace、stdin close、wait、最後にprocess tree killの順にします。Windowsでは `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` のJob ObjectへApp Serverを割り当て、macOSでは専用process groupを管理します。[Microsoft Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects) / [Apple kqueue(2)](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/kevent.2.html) / [Apple kill(2)](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/kill.2.html)
- Remediation evidence: production transportはactive turn interrupt、stdin close、bounded waitの後にOS process treeを終了します。Windows runtime unit testは実descendantを使用し、追加のpackaged test 4回はTauri appを強制killした後に同じJob Object内のfixture親・孫をすべて695 ms以内で回収しました。macOS guardはfixed internal argv、親PID一致、対象group leader、ready pipeを検証し、異常時はfail closedします。test helperは通常production binaryに含まれません。
- Confidence: High on Windows、Medium on macOS（native workflow前）。Windowsは正常shutdown fallbackとpackaged app強制終了の両方を実processで確認。macOSはnative process-group termination unit testを通過し、packaged crash用sourceも追加しましたが、そのnative実行結果は未確認です。

### TG-SEC-006 — Release workflowがmutable action tagとworkflow-wide write tokenを使う

- Severity: **Medium**
- Status: **Resolved and CI/bundle verified** — actionを実在確認済みのfull SHAへpin、checkoutのcredential persistenceを無効化し、workflow defaultを`contents: read`へ縮小。write / OIDC / attestation権限を必要jobだけへ付与し、tag qualityへRust fmt / clippy / test、artifact + release metadata + checksum attestation、Dependabotを追加。protected PRと3-platform bundleで検証済み。`v0.5.0` releaseでは全assetのattestation生成・検証まで完了し、後続versionにも同じgateを要求する。
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
- Status: **Strongly mitigated / Windows packaged validation complete** — Rust側でdeltaを20 ms単位にcoalesceし、合計1 MiB / 256 event、coalesced event 128 KiBへhard-bound。terminal / approval / error前にarrival orderでflushし、sequence割当とChannel送信を同一lockで直列化。frontendも1,024 event / 1 MiB上限、隣接deltaだけのcoalescing、hard-limit synchronous flushを持つ。Rust / rendererそれぞれの100,000 delta stress testはpayloadを失わず上限内で通過。Windows packaged Tauri / WebViewは3分間・9,000 delta・2,304,000 bytesをsequence gap 0で完走。
- Rule ID: `TAURI-AVAIL-001`
- Location:
  - `src-tauri/src/codex/transport.rs:22-24`
  - `src-tauri/src/codex/transport.rs:301-306`
  - `src-tauri/src/codex/transport.rs:353-355`
  - `src/App.tsx:173-180`
  - `src/App.tsx:232-237`
- Remediation evidence: 対象deltaは `(method, generation, threadId, turnId, itemId)` 相当のrouting keyで隣接分だけ結合し、上限到達時は古いbatchを先にflushします。terminal eventはdropせず、delta batchを先に送ります。stdout reader、stderr reader、process monitor、periodic flushの並行送信はsequenceとdeliveryの逆転が起きないよう直列化しました。test-only featureと隔離app identifierで実際のTauri Channel / WebView / React stateを通し、最終authoritative item、turn完了、最新行追従、frame heartbeat、process回収まで検査しました。
- Impact: 大量command outputや高速deltaによりrenderer memory/CPUが増え、UI freezeまたはcrashが起こり得ます。
- Recommended fix: Rust側にbounded channelを置き、deltaを `(generation, threadId, turnId, itemId)` 単位でcoalesceします。terminal/approval/error eventはdropしないpriority queueとし、line limitも実測に基づいて引き下げを検討します。
- Mitigation already present: protocol / diagnostic frame length limit、Rust-side bounded delta batching、frontend frame batchingとhard limit、state event/detail truncation。
- Confidence: Medium-High on Windows。両queueの100,000 delta stress testと3分間のpackaged Channel / WebView試験は通過しました。repository ownerからmacOS実機Pass報告はありますが、package hash・機種・OS・項目別証拠と強制crash時の同等試験は未確認です。

## Informational / residual risks

### TG-SEC-009 — Tauri経由のunmaintained Unicode crate

- Severity: **Informational**
- Status: **Open upstream dependency risk** — TamaGridから直接利用していないためTauri更新で追跡。Dependabotを追加。
- Rule ID: `RUSTSEC-MAINT-001`
- Evidence: Windows x64、macOS x64、macOS arm64のtarget-aware dependency graphを照合すると、各targetで5件の `INFO Unmaintained` が検出されました。`unic-char-property`、`unic-char-range`、`unic-common`、`unic-ucd-ident`、`unic-ucd-version` で、dependency pathは `tauri-utils -> urlpattern -> unic-ucd-ident` です。既知のexploit advisoryではありません。[RUSTSEC-2025-0081](https://rustsec.org/advisories/RUSTSEC-2025-0081.html) / [RUSTSEC-2025-0100](https://rustsec.org/advisories/RUSTSEC-2025-0100.html)
- Recommendation: TamaGrid側で直接置換せず、Tauri/tauri-utilsの更新でupstream解消を追跡します。CIへRustSec/OSV監査を追加し、unmaintained warningとvulnerabilityを別扱いにしてください。
- Audit nuance: Cargo.lock全体のRustSec監査は、未対応Linux専用のGTK graphにある`glib` unsound warning `RUSTSEC-2024-0429` / `GHSA-wrw7-89jp-8q8g`も報告します。locked `cargo tree`でWindows x64 / macOS arm64 / macOS x64から`glib`が到達不能、Linuxだけ到達可能と再確認しました。CIではこの1件だけ理由付きignoreとし、実vulnerability、将来のunsound、yanked crateは失敗させます。GitHub Dependabot alertも同じtarget evidenceで`not_used`分類し、理由を保存。Linux対応前には再評価が必要です。

### TG-SEC-010 — Windows installerはAuthenticode未署名

- Severity: **Informational / distribution trust risk**
- Status: **Accepted for Public Preview / strongly mitigated** — unsigned表示、checksum、GitHub Artifact Attestation、repository-level immutable releasesを有効化。最終tag releaseで10 assetすべてのattestationを生成・検証済み。これらはAuthenticode署名の代替ではありません。
- Rule ID: `RELEASE-SIGN-001`
- Evidence: NSISとMSIの `Get-AuthenticodeSignature` はともに `NotSigned`。SHA-256は同梱 `SHA256SUMS.txt` と一致しました。release notesとREADMEにも未署名が明記されています。
- Impact: GitHub account/release自体が侵害された場合、同じ場所に置かれたinstallerとchecksumを同時に差し替えられるため、checksumだけではpublisher identityを証明できません。SmartScreen警告も残ります。
- Recommendation: 現状はPublic Preview/unsignedを明記したまま配布可能です。費用をかけずに補強するならGitHub artifact attestationでbuild provenanceを付け、検証手順をREADMEへ追加します。これはAuthenticodeの代替ではありません。Tauriも署名は実行必須ではないが、browser download時のSmartScreen信頼に影響すると説明しています。[Tauri Windows code signing](https://v2.tauri.app/distribute/sign/windows/) / [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)

### TG-SEC-011 — 既存public commitのprovenanceとauthor metadata

- Severity: **Informational / privacy and provenance**
- Status: **Remediated on active refs / provider purge pending** — ownerの明示許可に基づき、GitHub公式手順と`git-filter-repo` 2.47.0で公開`main`のauthor / committer metadataをGitHub noreplyへ置換しました。source treeと9 commitのtopologyは不変です。GitHub email privacyと個人emailを含むcommand-line push拒否を有効化し、tracked pre-push hookとrequired `frontend` CIへ全ref / annotated tagのnoreply検査を追加しました。
- Evidence: 書換え直後のpublic `main` 9 commit、local object database 9 commit、repository-local Git identityはいずれもnon-noreply field 0件。public profile emailは非表示、fork 0、当時のremote headは`main`だけでした。旧履歴を指したDependabot PR 5件とbranch、Actions run 58件、artifact 8件、cache 17件を削除しました。GitHub Freeで実効しないmetadata rulesetは負試験後に撤回し、no-bypass・全branchのverified-signature rulesetへ置換しました。個人address値は報告やCI logへ再掲していません。2026-08-14の再測定でも現行`main`のnon-noreply fieldは0件です。
- Residual risk: metadata変更により書換え対象commitのGitHub署名は無効化されました。`main`のrequired signed commitsと他の保護は復元済みで、今後のcommitへ適用されます。GitHub Freeではemail metadata rulesetを強制できず、tracked hookはcloneごとの有効化が必要です。現在もGitHub管理のmerged PR #9、#10、#11から旧commit 3件がAPI参照可能です。repository操作だけでは消せないため、provider側のdereference / garbage collection / privacy対応が必要です。第三者cloneは存在を確認できず、公開前後のcloneを技術的に回収することはできません。

## 確認できた良い点

- `dangerouslySetInnerHTML`、`innerHTML`、`eval`、`new Function`、`document.write`、`postMessage`、remote `fetch`、WebSocket、service worker、iframe、remote scriptは検出なし。
- Codex/モデル出力はReact text nodeとして描画され、HTMLとして解釈されません。
- Tauri CSPが有効で、scriptはselfへ限定され、`unsafe-eval` とscript用 `unsafe-inline` はありません。remote script/fontもありません。TauriはCSPをXSSの影響低減に使い、信頼するsourceへ絞るよう推奨しています。[Tauri CSP](https://v2.tauri.app/security/csp/)
- frameless Headerはmain windowだけを対象に、最小化、最大化切替、終了、drag開始の4 permissionだけを明示許可しています。shell、Opener、任意navigation権限は追加していません。
- OpenAI API key、session token、email、usage snapshot、message body、command outputをlocalStorageへ保存していません。
- secret-like filenameおよび代表的token/private-key patternのproject scanは0件。
- App Serverはshellを介さずfixed `app-server` argvで起動し、stdout/stderrを分離しています。
- WebViewからraw RPC method / executable pathを受けず、Rust側のmethod別DTOでresponse ID/result/error、approval method、input length、enum、absolute path、frame length、generation、timeout/EOFを検証しています。
- unknown server requestはauto-approveせず、`accept` / `decline` 以外を拒否します。
- dangerous authorityはnative dialogでturnごとに確認し、high-risk valueを永続化しません。
- App Server process treeはWindows Job Object / Unix process groupへcontainします。
- GitHub Actionsはfull SHA pin、least privilege、draft release、checksum、Artifact Attestationを組み合わせます。
- GitHub repositoryはPrivate Vulnerability Reporting、secret scanning / push protection、Dependabot security updates、read-only workflow token、10-pattern action allowlist、required SHA pinning、immutable releasesを有効化。`main`は9個のApp-bound check、PR、signed commit、admin enforcement、linear history、conversation resolutionで保護し、force push / deletionを禁止。CodeQL / secret / Dependabot open alertは0件。Dependabotにはsupported targetで未使用と実証した`glib` alertが1件だけ理由付きdismissed。Actions / JavaScript・TypeScript / Rustの明示的なCodeQL advanced workflowがPRをgateする。
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
- GitHub CodeQL initial setup: pre-rewrite setup run **success**、open CodeQL alert 0、open secret scanning alert 0、open Dependabot alert 0。
- GitHub hardened PR #7: CI / CodeQL / Security Audit **all success**。pre-rewrite squash commitはGitHub署名`verified=true / reason=valid`、review済みtreeと一致していました。
- GitHub bundle smoke: 同じreview済みtreeからWindows x64 NSIS/MSI、macOS arm64/x64 app/dmgをbuild **all success**。3 artifact / 22 files / zero-length 0、Mach-O architecture・bundle ID・version一致。download済みartifact全体のMicrosoft Defender scan（修復無効）は **no threats found**、Windows 2 artifactは想定どおり`NotSigned`。
- GitHub supply-chain PR #9 / Intel fallback PR #10: 各9 required checks **all success**。GitHub-signed source commitsからsquash mergeされ、review済みtreeと一致していました。
- Final bundle smoke: Intel fallbackを含むWindows x64 / macOS arm64 / macOS x64 **all success**。3 artifact / 22 files / zero-length 0、architecture・bundle metadata・version・hash確認、Defender **no threats found**、Windows `NotSigned`を再確認。privacy rewrite後、旧SHA参照を断つためpre-rewrite Actions run / artifact / cacheは削除済みです。
- Dependabot alert #1 (`GHSA-wrw7-89jp-8q8g`): locked target graphでWindows/macOS 3 targetから`glib 0.18.5`到達不能、unsupported Linuxのみ到達可能を確認し、理由付き`not_used`分類。open CodeQL / secret / Dependabot alertは各0。
- Final `v0.5.0` release: 10 asset / zero-length 0、SHA-256 manifest 9/9、Artifact Attestation 10/10、archive integrity 6/6、Microsoft Defender **no threats found**、anonymous release page / Windows installer access **HTTP 200 / 206**。公開後のreleaseは`draft=false`、`prerelease=true`、`immutable=true`。
- Local `v0.6.0` candidate packaged soak: Windowsで3分間・9,000 delta・2,304,000 bytes、sequence gap 0、最大frame gap 50 ms、最新行距離0 px、正常終了後のTamaGrid / direct WebView child残留0、test temporary directory残留0。Codex process・account・利用枠には接続していません。
- Post-`v0.6.0` Windows packaged crash probe: 30秒WebView soakは1,500 delta・384,000 bytes、sequence gap 0、最大frame gap 33 ms、最新行距離0 px。安全側cleanup修正後を含む5秒再試験3回も各250 delta・64,000 bytes、sequence gap 0で通過。各run後に隔離Tauri appを強制終了し、Job Object内のfixture親・孫をすべて695 ms以内で回収、残留0。通常production binaryのtest marker 5種は各0件。

## 限界

- sourceとlocal buildを対象としたstatic / dependency reviewです。第三者penetration testや形式検証ではありません。
- 実際の悪意あるWebView payload、Codex prompt injection、sandbox escapeは実行していません。
- descendant process終了はWindows Job Objectのruntime unit testとpackaged app強制crashの両方で再現し、macOSには正常終了test、独立crash guard、packaged crash runnerを追加しました。ただしnative workflow実行前であり、多段・長時間の実Codex commandを使う試験の代替でもありません。
- event floodはRust / renderer両queueで100,000 delta、Windows packaged Tauri / WebViewで3分間のstreamを再現しました。macOS実機はowner-reported Passですが、同等負荷の項目別証拠は未記録です。
- Windowsの隔離packaged強制crash試験は通過しましたが、fixtureによる決定的試験です。実Codexが実行中のcommandを持つ状態の強制終了は未実施で、macOS同等試験はnative workflowでの確定が必要です。
- OSV/RustSec照合は監査時点の公開databaseに依存し、未知脆弱性を否定するものではありません。
- OS WebView2、Codex CLI、OpenAI serviceそのものの脆弱性は対象外です。
