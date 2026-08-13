# Changelog

TamaGridの利用者に影響する変更をこのファイルへ記録します。

## [Unreleased]

未公開の変更はありません。

## [0.5.0] - 2026-08-13

### Added

- 最大4つのCodex taskを2列、2×2、横4列、縦4段で表示
- Paneのdrag-and-drop並べ替えとkeyboard代替操作
- 保存済みthreadの検索、展開、resume、実chat名の編集
- 日本語 / EnglishとAurora / Dark / Light / Green theme
- 85%〜200%の文字サイズ
- EnterまたはCtrl/Cmd+Enterから選べる送信キー
- Codex rate-limit、reset時刻、model、reasoning optionの動的表示
- streaming timeline、最新行auto-scroll、Stop、Steer、approval
- model・reasoning・Codex設定・code workflowをまとめたcompact composer
- 1行から最大10行まで自動拡張し、送信後に初期高へ戻る入力欄
- code reviewと安全なPull Request準備

### Changed

- 公開前のproduct名、package、Tauri identifier、artifact、文書をAgentDeckからTamaGridへ統一
- 旧AgentDeck previewの保存設定・thread参照をTamaGridへ自動移行
- 新規起動時の表示言語をEnglishへ変更し、言語設定をコンパクトなEN / JP切替へ更新
- 170%〜200%でheaderを2段のadaptive command railへ切り替え、利用量表示と操作群のはみ出しを解消
- glass surface、Pane header、timeline、composer、設定、履歴のcontrast・focus・spacingを再調整
- high zoomおよび狭幅Paneではcomposer toolをicon表示へ切り替え、全操作を保持したままcompact化
- streaming中のeventや文字倍率変更でtimelineの高さが変わっても、最新行への追従を維持
- 終了時のウィンドウ位置・サイズ・最大化・全画面状態を保存し、次回起動時に復元
- 起動直後のCodex接続中に閉じても終了がロック待ちし続けないよう、切断待ちを5秒で上限化

### Security and distribution

- native Codex executableだけをshellなしで起動
- App Server method allowlist、request-ID correlation、frame上限、diagnostic redaction
- Windows unsigned NSIS / MSIとmacOS ad-hoc signed artifactのdraft prerelease workflow
- Release artifact用 `SHA256SUMS.txt` の自動生成
- WebViewからraw App Server method / executable pathを渡すIPCを廃止し、method別Rust DTOとnative executable pickerへ移行
- `never` / `danger-full-access` を非永続化し、各turnでpolicy・sandbox・cwdを示すnative confirmationを追加
- approval cardへcommand、cwd、network、parsed actions、file changesを表示し、判断材料がない要求のApproveを無効化
- active-turn interrupt、Windows Job Object、Unix process group、bounded/coalesced renderer event queueを追加
- GitHub Actionsをfull SHA pin / least privilegeへ変更し、DependabotとArtifact Attestationを追加
- third-party dependency notice、bundle license metadata、production JavaScript CycloneDX SBOMをreleaseへ追加

### Known limitations

- Windows Authenticode署名なし
- macOS Developer ID署名 / notarizationなし
- stdio transportのみ
- commit、push、Pull Request作成は自動実行しない
