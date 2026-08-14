# TamaGrid macOS manual test

このchecklistは、GitHub Actionsのnative buildだけでは確認できないmacOS実機上の起動、WebView、Codex接続、履歴resume、approval、終了を確認するためのものです。結果へaccount email、token、private path、会話本文、commandに含まれるsecretを記録しないでください。

## Test record

- Date:
- Tester:
- TamaGrid commit:
- Package filename and SHA-256:
- Mac model / CPU architecture:
- macOS version:
- Codex CLI version:
- Result: Pass / Fail / Blocked

## Before launch

- [ ] Packageを公式PR workflow artifact、または記録したcommitからのlocal buildだけから取得した
- [ ] `shasum -a 256 <package>` を記録した
- [ ] `file <app executable>` で期待する `arm64` または `x86_64` を確認した
- [ ] `codesign -dv --verbose=4 <TamaGrid.app>` で署名状態を確認した
- [ ] Developer ID署名 / notarization済みであると誤認していない
- [ ] Gatekeeperをsystem-wideで無効化していない。必要な場合も、入手元とhash確認後のper-app操作だけを使う
- [ ] disposableなtest repository / working directoryを用意した

## UI and settings

- [ ] TamaGridがcrashせず起動し、初期表示または保存済みEN / JP設定が正しく反映される
- [ ] Aurora / Dark / Light / Greenの各themeで主要text、select、focus outlineを読める
- [ ] 85% / 100% / 150% / 200%でheader、usage、Pane、composer、Settingsに横方向の欠落がない
- [ ] 2列 / 2×2 / 横4列 / 縦4段を切り替え、Paneをdrag-and-dropとkeyboardの両方で並べ替えられる
- [ ] Settingsが十分な幅で開き、Enter送信 / Ctrl・Cmd+Enter送信を切り替えられる
- [ ] 入力欄が最大10行まで拡張し、送信後に初期高へ戻る

## Codex connection and task lifecycle

- [ ] Auto detectまたはnative pickerで実際のCodex executableを選択できる
- [ ] 初回またはpath / fingerprint変更時だけnative executable確認が表示される
- [ ] Test connectionでinitialize、account状態、model list、対応環境ではusageを取得できる
- [ ] UIや記録へaccount email / tokenが表示されない
- [ ] 新しいtest taskを開始し、model / reasoningの選択肢がCodexの返却内容と一致する
- [ ] streaming中にtimelineが最新行へ追従し、UI操作が固まらない
- [ ] 実行中taskをStopでき、Paneがterminal stateへ移る
- [ ] disposable directoryでcommand / file-change approvalの内容を確認し、ApproveとDenyが対象Paneだけへ適用される
- [ ] 保存済みtaskをHistoryから検索・展開・resumeできる
- [ ] test taskのtitleを編集し、再起動後もCodex側のchat名として表示される

## Window and shutdown

- [ ] window位置・サイズ・最大化状態を変えて終了し、次回起動時に復元される
- [ ] idle状態で終了後、TamaGridとそのCodex App Server childが残留しない
- [ ] active taskをStopしてから終了後、TamaGridとそのCodex App Server childが残留しない
- [ ] crash、beachball、unexpected permission dialog、個人情報を含むdiagnosticがない

## Result notes

失敗時は、再現手順、期待結果、実際の結果、architecture、macOS / Codex version、秘密情報を除いたscreenshotまたはlogを記録します。成功時も上記のbuild commitとpackage hashを残します。macOS実機確認が完了するまで、release checklistの該当項目を完了扱いにしません。
