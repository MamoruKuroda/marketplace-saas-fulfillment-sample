# ローカルで開発する

実装をビルド・設定・変更するための文書です。ブラウザー体験一式の準備は
**[デモを用意する](run-demo.ja.md)**、その意味は[実装ガイド](walkthrough.ja.md)を参照してください。

> English: **[develop.md](develop.md)**

## 前提条件

- .NET 10 SDK。[global.json](../global.json)を参照。
- [appsettings.json](../src/SaaSAgentSample.Web/appsettings.json)の既定DBはSQLite。
  arm64を含め、DBサーバーの準備は不要です。
- エミュレーター開発にはNode/npm、コンテナー経路にはDockerが必要です。
  [デモ準備](run-demo.ja.md#local-node)を参照。
- SQL Serverのテストは任意です。ComposeのSQL Server 2022イメージはx86-64向けで、
  デモを試すだけの前提条件にはしません。

## ビルドとテスト

リポジトリのルートから実行します。

```powershell
dotnet build SaaSAgentSample.slnx
dotnet test SaaSAgentSample.slnx
```

`SQL_SERVER_CONNECTION` が未設定の場合、SQL Server統合テストはスキップされます。
[連携の検証](l2-demo.ja.md#automated-checks)では、InMemory、実HTTP、フォームPOST、
エミュレーターを使う確認を区別しています。同じ範囲の実証ではありません。

エミュレーターを変更する場合は[run-demo](run-demo.ja.md#local-node)のインストール・ビルド後、
`emulator` で `npm test -- --runInBand` を実行します。CIはNode 18での起動も確認します。

<a id="アプリの起動"></a>
## ローカル設定

起動コマンド、ターミナルの分け方、ポートは[run-demo](run-demo.ja.md)を正本とします。
`appsettings*.json` と環境変数（ネストキーは `__`）から設定します。
ソースにはプレースホルダを使い、実ID・資格情報を入れないでください。

| 設定 | 役割・既定値 |
| --- | --- |
| `Database:Provider` | 既定は `Sqlite`。`SqlServer`、`InMemory` も選択可能 |
| `Database:ConnectionString` | 既定はSQLiteファイル。隔離した実行では別の保存先を明示 |
| `Landing:RequireAuthentication` | Developmentは `false`、基本設定は `true` |
| `AzureAd:*` | 任意の購入者・運用担当者サインイン。外向きAPIのトークンproviderではない |
| `Fulfillment:BaseUrl` | Developmentは `http://localhost:3978/api`。基本設定は実API URLだが、**実API連携の完成実装ではない** |
| `Fulfillment:PublisherId` | トークン不要エミュレーター用。エミュレーターの `PUBLISHER_ID` と一致させる |
| `Fulfillment:ApiVersion` | `2018-08-31` |
| `Fulfillment:Webhook:RequireSignedToken` | Developmentと標準Azureデモは `false`、基本設定は `true` |
| `Fulfillment:Webhook:Audience`、`ExpectedAppId`、`MetadataAddress` | Webhook検証用。APIアクセストークン取得の設定ではない |

既定の[DevNull provider](../src/SaaSAgentSample.Fulfillment/DevNullMarketplaceTokenProvider.cs)はAPIトークンを返しません。
設定変更を実Marketplace連携の完成と扱う前に、[実装範囲](walkthrough.ja.md#implementation-boundary)を確認してください。

| パス | 役割 |
| --- | --- |
| トークンなしの `/` | デモ開始画面 |
| `/?token=<purchase-token>` | 購入者ランディング。フォームPOSTで明示的に有効化 |
| `/admin`、`/admin/{guid}` | パートナー側の保存記録。管理画面は実装例 |
| `POST /api/webhook` | 通知受信口 |

アプリはEN / 日本語に対応します。言語切替はブラウザーの既定を上書きし購入の文脈を保持しますが、
画面のラベルは権限規則ではありません。

## DBプロバイダとマイグレーション

| プロバイダ | 保存の動作 |
| --- | --- |
| `Sqlite`（既定） | `EnsureCreated()`。独立したSQLiteマイグレーション履歴は持たない |
| `SqlServer` | `src/SaaSAgentSample.Data/Persistence/Migrations` のEF Coreマイグレーションを実行 |
| `InMemory` | テスト専用。永続的な契約ストアではない |

スキーマ変更後も `EnsureCreated()` は既存SQLiteファイルをアップグレードしません。
ローカル実験には新しい使い捨てファイルを選び、他の人のデータを削除しないでください。
SQL Serverはマイグレーションを検証するプロバイダであり、Microsoftの商用課金の正本という意味ではありません。

### 任意のSQL Serverテスト

自分のローカルSQL環境を使います。同梱コンテナーでは、強固なローカル専用の
`MSSQL_SA_PASSWORD` をターミナルか、[.env.example](../.env.example)を元にしたgitignore対象の
`.env` に設定してから、そのサービスだけを起動します。

```powershell
docker compose up -d sqlserver
$env:SQL_SERVER_CONNECTION = "Server=localhost,1433;Database=SaasAgentSample;User Id=sa;Password=<local-password>;TrustServerCertificate=True;"
dotnet test SaaSAgentSample.slnx
```

POSIXでは `export SQL_SERVER_CONNECTION='...'` を使います。本番の資格情報を渡さないでください。
終了時は自分が起動したSQLコンテナーだけを停止します（この構成なら `docker compose stop sqlserver`）。
名前付きデータボリュームは残ります。合成ライフサイクルテスト自体は、
SQL ServerがあるCIジョブでも明示的にInMemoryを使います。

<a id="エンドツーエンドで実証するl2"></a>
## 連携を検証する

自動テストの指定、期待する保存結果、手動通知テストは[連携の検証](l2-demo.ja.md)を正本とします。
既存の `L2` パスとテストクラスは互換性のため維持しますが、デモ参加者の予備知識にはしません。

## UIと文書を一緒に保守する

日英の範囲・操作・画像・リンク・旧アンカーを同時に更新します。
UIのラベルは実際に使われるRazor／HTMLとリソース、動作はコードとテスト、
Marketplace要件は公式一次資料を基準にします。

`scripts/check-i18n.ps1` はアプリのリソースキーを検査し、文書の翻訳までは検査しません。
`scripts/check-shared-ui.ps1` は特定のCSS値を比較し、画像や文書リンクは確認しません。
現行CIは.NET・エミュレーター・Bicepのビルド等を実行しますが、文書の鮮度を保証しません。
更新時は相対ファイルリンク、見出しアンカー、画像、対応言語を確認してください。
デモの固定ガイドURLで `docs/walkthrough*.md` に到達でき、クエリ情報を送らない構成を維持します。

<a id="screenshots-and-evidence"></a>
### 画像と証跡

現在のREADME・実装ガイドは `docs/images/screenshots` の `experience-*` と `boundary-*` を参照します。
ファイル名を安定させてください。旧 `en-1-*` / `ja-1-*` 等の画像や未使用の図は履歴素材として残し、
現在のUI仕様として扱いません。再撮影時は基準commit、言語、ホスト、保存先・フィクスチャの条件、
実際に描画された画面かモックかを記録します。実トークンや顧客データを含めないでください。

<details>
<summary>既存画像の出自 — #101 / b5e5963時点</summary>

参照画像は実際のサンプルUIと合成データを使い、エミュレーターAPIは隔離したHTTPフィクスチャで撮影しました。
完全なNodeエミュレーターとの統合検証や実購入の証拠ではありません。
当時の対象限定チェックはjourney 37件、experience 14件、checkout 18件、購読選択10件で、
Jest全体の実行ではありません。当時の作業環境にはnpmフィードの404とDocker利用不可の記録があります。
これらは撮影時点の条件であり、リポジトリの利用要件や恒久的な制約ではありません。

</details>

インライン図は参照文書内のMermaidがソースです。参照中のPNG図は対応する `.mmd` と一致させます。
`images` を `assets` に改名するためだけの一括移動はしません。
リポジトリ内で未参照でも、外部から使われていないとは限りません。

<a id="verification-record"></a>
### 今回の更新の検証記録

2026-09-12に、変更していない `b5e5963` のアプリ・エミュレーターコードを確認しました。

| 証跡 | 範囲 |
| --- | --- |
| ローカルブラウザー | Windows ARM64、.NET SDK 10.0.112、Node 24.13.0、headless Chromium。完全なNodeエミュレーターと、分離したSQLite・エミュレーター保存先・専用ポート |
| 購入と保存結果 | 日英それぞれ `web-card`、`web-azure`、`azure-portal`。購入→パートナーへの引き渡し→明示有効化→保存済み契約 |
| 任意の通知 | 両言語の `web-card` で、同じ契約のSuspend、パートナー側の状態と履歴 |
| 自動テスト | .NETのライフサイクル・ページの対象テスト36件。エミュレーターのJest全129件（15スイート） |

固定ガイドURL、言語、クエリ情報を送らないことも確認しました。外部ガイドを開いてトークンを送信していません。
上記の完全エミュレーターでの確認によって、以前の画像のHTTPフィクスチャ撮影条件が変わるわけではありません。

ローカルのnpmフィードが当初tarball取得に404を返しました。設定済みフィードの正しいパスから
lockされたパッケージをキャッシュし、整合性検査付きのオフライン復元で解消しました。
依存バージョンとlockfileは変更していません。他の利用者に同じレジストリ設定を要求するものではなく、
この検証環境の記録です。

Docker、POSIXでの実行、Node 18での実行、SQL Server、Azureデプロイは**今回実行していません**。
これらの手順は設定との照合であり、E2E検証済みとは扱いません。
共有デモ、実購入、本番適合性評価は対象にしていません。

<a id="関連ドキュメント"></a>
## 関連文書

- [README](../README.ja.md) — 価値、画面プレビュー、文書の案内。
- [デモの準備](run-demo.ja.md) — 環境の用意と停止。
- [実装ガイド](walkthrough.ja.md) — 体験の説明と追加実装。
- [連携の検証](l2-demo.ja.md) — テスト範囲と保存結果の証拠。
- [実Marketplace接続の参考](deploy.ja.md) — 未完成部分のある接続例。デモの起動手順ではない。
