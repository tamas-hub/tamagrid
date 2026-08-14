# Changelog

TamaGridの利用者に影響する変更をこのファイルへ記録します。

## [Unreleased]

## [0.6.0] - 2026-08-14

### Added

- 実行対象Codex CLIからstable App Server JSON Schemaを一時生成し、TamaGridが使用するmethod、event、approval、wire値を照合する互換性検査
- Codex process・account・利用枠へ接続せず、実際のpackaged Tauri window、WebView、Rust Channelを通す隔離型soak test
- Windows x64、macOS Apple Silicon、macOS Intelのmanual Bundle smokeへ30秒のpackaged WebView gateを追加
- GitHub repository用の独自social-preview画像

### Changed

- TamaGrid、接続状態、残り使用量、History、各操作、window controlsを1行のcommand railへ統合
- 接続状態4項目とEN / JP切替を、横1行のcompact status railへ統合
- 文字サイズ範囲を90%〜200%へ揃え、増減とsliderを10%刻みに変更
- composer入力欄を初期3行・最大10行へ変更し、modelとreasoning controlsを入力欄の下へ移動
- native title barをTamaGrid Headerへ統合し、drag・最小化・最大化・終了操作を追加
- Rustとrendererのdelta queueをbounded / coalesced化し、各層100,000 deltaのpayload保持・上限試験を追加
- event sequence割当とChannel送信を直列化し、terminal / approval / errorより前にpending deltaを順序どおりflush
- Windows Job Objectの実descendant終了testと、native macOS上で実行するUnix process-group終了testを追加
- production CI / releaseではsoak test用featureとfrontend bridgeを明示的に無効化

### Validation

- Windows packaged Tauri / WebViewで3分間、9,000 delta、2,304,000 bytesを欠落0・sequence gap 0で完走
- 同試験で最大animation-frame gap 50 ms、最新行追従0 px、正常終了後のapp / WebView残留process 0を確認

### Known limitations

- Windows Authenticode署名なし
- macOS Developer ID署名 / notarizationなし
- macOS native UI / runtimeと強制crash時のpackaged process-tree回収は未確認

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
