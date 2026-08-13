# Code signing

TamaGridは署名可能です。ただし、Windows SmartScreenやmacOS Gatekeeperで配布元を信頼済みとして扱わせるには、platformが信頼する証明書と本人確認が必要です。source codeだけでその信頼を代替することはできません。

## Windows Authenticode

現在の通常buildは未署名です。実行自体に署名は必須ではありませんが、browserから取得した未署名installerはSmartScreen警告の対象になり得ます。

1. 信頼できる認証局またはAzure Artifact Signingからcode-signing用証明書を取得します。SSL証明書は利用できません。
2. `.pfx` とprivate keyをWindows certificate storeへ安全にimportするか、cloud signing serviceを構成します。
3. `src-tauri/tauri.windows.signing.example.json` を `src-tauri/tauri.windows.signing.local.json` へcopyし、thumbprintと証明書発行元のtimestamp URLを設定します。`*.local` はGit対象外です。
4. 次のようにbase configへ署名設定をmergeしてbuildします。

```powershell
pnpm exec tauri build --config src-tauri/tauri.windows.signing.local.json
```

署名結果は次で確認できます。

```powershell
Get-AuthenticodeSignature -LiteralPath .\src-tauri\target\release\tamagrid.exe
```

OV証明書はSmartScreen reputationが蓄積するまで警告が残る場合があります。EV証明書やMicrosoftのcloud signingは配布方針・費用・本人確認要件を確認して選択してください。`.pfx`、private key、password、cloud credentialはrepositoryへ保存しません。

## macOS

App Store外配布には通常、Apple Developer Programの `Developer ID Application` 証明書とnotarizationが必要です。署名buildはmacOS上で行い、CIでは証明書とnotarization credentialをsecretとして渡します。

現在のrelease workflowは `APPLE_SIGNING_IDENTITY=-` のad-hoc署名です。これはAppleによる本人確認やnotarizationではなく、利用者側のGatekeeper許可が必要になる場合があります。

## CI policy

- 証明書がない状態で「署名済み」と表示しません。
- release jobへcertificate secretを追加する操作は、repository ownerの明示的な許可後に行います。
- Windows Authenticode / macOS Developer IDと、Tauri updater artifactの署名鍵は別用途として管理します。

参考: [Tauri Windows Code Signing](https://v2.tauri.app/distribute/sign/windows/)、[Tauri macOS Code Signing](https://v2.tauri.app/distribute/sign/macos/)
