# TamaGrid architecture

## Trust boundary

TamaGridはUIとprotocol adapterを提供します。認証、model entitlement、usage limit、thread persistenceの正本はユーザー自身のCodex App Serverです。TamaGrid運営者のbackendはありません。

## Layers

```text
src/components + src/state
  UI-neutral Pane state and presentation
        ↓
src/codex/CodexAdapter
  typed TamaGrid operations
        ↓
Tauri Channel + invoke commands
  method-specific DTOs; no raw RPC command
        ↓
src-tauri/src/codex/AppServerManager
  lifecycle, executable trust, validation, policy gate
        ↓
StdioTransport
  JSONL framing, correlation, process I/O
        ↓
user's native Codex executable
```

ブラウザpreviewは `PreviewCodexBridge` を使い、実際のprocessやcredentialへ接続しません。

## Connection lifecycle

1. Codex executableをRustで自動検出する。手動変更はnative pickerとnative confirmationを通し、OS app configへ保存
2. shellを使わず、固定argv `app-server` でspawnし、Windows Job Object / Unix process groupへ割り当て
3. `initialize` requestを1回送信
4. `initialized` notificationを送信
5. `account/read` で認証状態を読み取り
6. `model/list` を `nextCursor` がなくなるまで取得
7. 対応版では `account/rateLimits/read` からlive usageを取得
8. 最大4つのPaneが同じtransport上で別threadをstart / resume
9. disconnect時はtracked active turnをbest-effort interruptし、pending requestとapprovalを無効化、stdinをclose、bounded wait後にprocess treeをkill

App Serverにshutdown RPCはないため、stdin closeが正常終了経路です。active turnは自動再送しません。crash後の再送はcommandやfile changeを重複させる危険があるため、ユーザー操作を必要とします。

## Message routing

wireはnewline-delimited JSONで、`jsonrpc` fieldを前提にしません。

- response: exact JSON ID（numberとstringを別namespace）でpending requestへcorrelate
- server request: IDとmethodを保持し、対応するPaneへapprovalを表示
- notification: `threadId` / `turnId` / `itemId` でrouting

全inbound eventにprocess `generation` と単調な `sequence` を付けます。再接続前のreaderや遅延eventはgeneration mismatchで無視されます。UIは高頻度deltaをitem単位でcoalesceしてanimation frame単位でbatchし、queueが1,024 eventへ達した時点で同期flushします。terminal / approval eventはdropしません。

`item/completed` をitemの最終状態、`turn/completed` をturnの最終状態として扱います。`error.willRetry=true` はwarningであり、turnをterminal errorにしません。

実行中の通常turnには `turn/steer` で追加入力できます。request IDの順序ではなく、App Serverが返した正確なthread IDとactive turn IDを使います。code review turnはsteer対象外です。

code reviewはstable `review/start` をinline deliveryで使用し、working tree、base branch、commit、custom instructionsをtargetとして渡します。`enteredReviewMode` / `exitedReviewMode` itemを通常timelineへ表示します。PR準備は通常turnへ安全条件を含む指示を送り、commit、push、remote branch作成、PR作成は行いません。

## Dynamic model discovery

model、reasoning effort、service tierは `model/list` responseから構築します。App Serverのdefaultを尊重し、IDが一致しない保存済みmodelを類似名へ置換しません。cacheはoffline表示の補助で、接続中のsource of truthではありません。

## IPC and authority policy

React側はUI-neutralなoperationを `CodexAdapter` へ渡します。Tauri bridgeはoperationを固定command名へmappingし、Rustはmethodごとの `deny_unknown_fields` DTOからApp Server payloadを再構築します。rendererがraw method、raw `sandboxPolicy`、raw executable pathを渡すcommandはありません。

thread start / resumeではsafe baselineを明示し、ユーザーのCodex configがより強い権限でも引き継ぎません。`never` / `danger-full-access` はturn overrideに限定し、Rust native dialogでpolicy、sandbox、cwdを毎回確認してから送信します。

## Stored history

`thread/list` をupdated timestamp順にpage取得し、`thread/read(includeTurns: true)` で選択した履歴だけを展開します。継続時は正確な `thread.id` を `thread/resume` へ渡し、選択Paneへroutingします。Pane titleは履歴のnameとstable `thread/name/updated` notificationを正とし、未命名時だけlocale別のfallbackを表示します。会話本文はlocalStorageへ保存しません。

## Usage display

残り使用量は `account/rateLimits/read` の `usedPercent` から算出し、複数bucket、window duration、reset時刻を動的に表示します。`account/rateLimits/updated` とturn完了後は再取得し、利用量response自体は永続化しません。API非対応の旧版では接続を失敗させず、UIを未取得状態にします。

## Compatibility policy

Codex App Serverはversionごとにschemaが更新される可能性があります。

- stable methodだけをPhase 1で使用
- unknown optional field / notificationはlenientに扱う
- malformed response、未知のrequest ID、unsupported server requestは診断可能なerrorへ変換
- docs例より、実行対象Codexのgenerated JSON schemaとruntime responseを優先
- UI componentへwire enumやJSON-RPC methodを直接漏らさない

実装時の検証snapshotはCodex CLI 0.147.0の `codex app-server generate-json-schema` で作成しましたが、runtimeを0.147.0へ固定していません。

Codex更新後は `pnpm check:app-server-schema` を実行すると、shellを介さずCodex executableから一時schemaを生成し、TamaGridが使用するstable method、approval request、notification、wire enumとの互換性を確認できます。一時schemaは検査後に削除され、credentialやaccount dataは読みません。自動検出できない環境では `TAMAGRID_CODEX_EXECUTABLE` または `--codex <path>` でexecutableを明示します。Windowsではnative `.exe` だけを候補にします。

## Packaged WebView soak validation

`packaged-soak-test` Rust featureと `VITE_TAMAGRID_SOAK=1` を同時に指定した場合だけ、通常版と異なるproduct identifierの隔離appがtest用Channel commandを公開します。test bridgeはCodex process、account、credential、thread history、利用枠へ接続せず、決定的なASCII deltaをRustから実際のTauri Channel、WebView、React state、timelineへ流します。

runnerはevent件数、UTF-8 byte数、sequence gap、animation-frame heartbeat、authoritative item / turn完了、最新行追従、終了codeを検査します。Windowsでは3分間・9,000 delta・2,304,000 bytesを欠落0、最大frame gap 50 msで完走し、別のOS process観測で終了後のapp / direct WebView child残留0も確認しました。manual Bundle smokeはWindows x64 / macOS arm64 / macOS x64それぞれで30秒の同試験をbundle前に実行します。実機向けframe-gap上限は既定1.5秒のまま、共有Windows runnerでは一時的なVM schedulingをapp hangと誤判定しないよう2.5秒を明示し、適用した上限もreportへ記録します。通常のCIとrelease buildは `VITE_TAMAGRID_SOAK=0` を明示し、non-default Rust featureを有効にしないため、配布binaryにはtest commandを含めません。

Windowsでは同じrunnerがtest-only App Server fixtureをproductionと同じ `StdioTransport` から起動します。fixtureはJob Object割当後の固定JSONL gateを受け取ってから孫processを生成し、外側のrunnerがpackaged Tauri appだけを強制終了します。親・孫PIDの両方が5秒以内に消えることを検査し、2026-08-15のlocal run 3回ではすべて627 ms以内、残留0でした。fixture binary、環境変数、IPC stateは `packaged-soak-test` featureに限定し、通常production binaryのmarker scanでも混入0を確認しています。macOSは正常終了時のprocess-group testをnative CIで実行しますが、packaged app強制crashの同等試験は継続課題です。

## Persistence

localStorageに保存するもの:

- layout IDとdrag-and-drop後のPane順
- Pane ID / App Server由来title / working directory
- thread ID
- selected model ID / reasoning effort / service tier
- safe approval policy / safe sandbox / personality / reasoning summary
- font size scale
- message send shortcut (`enter` / `modifier-enter`)
- background theme (`aurora` / `dark` / `light` / `green`)
- display language (`ja` / `en`)
- timestamp付きmodel metadata cache

Rust app configに保存するもの:

- native pickerで承認したCodex executable path
- ウィンドウの位置、サイズ、最大化、全画面、復元時の表示状態

保存しないもの:

- ChatGPT password、API key、token
- account email
- usage limit snapshot
- conversation本文、command output、diff
- pending approval
- approval-free `never` / system-wide `danger-full-access`
- Codex executable pathとwindow stateはWebView storageへは保存しない（Rust側app configへ分離保存）

## Phase boundaries

現在は最大4Pane、stdio、stable thread history、turn steering、code review、command / file approvalに限定します。Codexが生成したsandbox内commandは扱いますが、sandbox外の直接shell command、remoteへのpush / PR作成、OS notification、remote transport、experimental API、信頼済みsigning / notarizationは後続phaseです。
