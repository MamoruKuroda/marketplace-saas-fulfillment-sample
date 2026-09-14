# デモを用意する

環境を準備したら、**この文書を離れてアプリを開きます**。
購入の意味は[実装ガイド](walkthrough.ja.md)、準備手順の正本はこのページです。

> English: **[run-demo.md](run-demo.md)**
>
> 架空データだけを使用してください。実購入・実決済はありませんが、Azureホスティング費用は発生し得ます。
> 自分の環境を使い、共有デモのリセットや他の人のDBの流用はしないでください。

## 環境を選ぶ

| 用意されているもの | 次の操作 |
| --- | --- |
| 管理者提供の動作中のアプリURL | `/` を開いて **購入体験を始める →**。ローカル準備は不要 |
| ローカルの.NET／Node環境 | [ローカルNode手順](#local-node) |
| .NETとDocker。ローカルNodeは使わない | [ローカルDocker手順](#local-docker) |
| 利用承認のあるAzure環境 | [Azureデモ](#azure-demo) |

**実行場所と連携相手は別の選択です。** 以下の標準構成はローカルでもAzureでも同梱エミュレーターを使います。
Azureへの配置だけで実Marketplaceオファーと接続するわけではありません。
[実Marketplace接続の参考](deploy.ja.md)には追加実装が必要で、ホスト名やサインイン設定の変更だけでは不足します。

<a id="local-node"></a>
## ローカルNode手順

前提：Git、.NET 10 SDK、Node/npm、JavaScriptが有効なブラウザー。
エミュレーターのDockerイメージとCIはNode 18を使います。これは互換性の基準であり、
新しい本番環境のランタイムとして推奨する意味ではありません。SQLite用のDBサーバーは不要です。
以下はこのリポジトリの新しい作業コピーを前提にします。

### 1. ビルドする

リポジトリのルートから実行します。

```powershell
dotnet build SaaSAgentSample.slnx
Set-Location emulator
npm ci
node .\node_modules\typescript\bin\tsc
```

POSIXシェルでは `cd emulator`、`node node_modules/typescript/bin/tsc` を使います。
インストール・ビルドが失敗したまま先へ進まず、[問題の切り分け](#troubleshooting)を確認してください。

### 2. エミュレーターを起動する

同じターミナルの `emulator` ディレクトリで実行します。

```powershell
$env:PORT = "3978"
$env:LANDING_PAGE_URL = "http://localhost:5134/"
$env:WEBHOOK_URL = "http://localhost:5134/api/webhook"
$env:PUBLISHER_ID = "FourthCoffee"
$env:REQUIRE_AUTH = "false"
npm start
```

POSIXの場合：

```bash
PORT=3978 LANDING_PAGE_URL=http://localhost:5134/ \
WEBHOOK_URL=http://localhost:5134/api/webhook PUBLISHER_ID=FourthCoffee \
REQUIRE_AUTH=false npm start
```

このターミナルは起動したままにします。エミュレーターのデータは既定で `emulator/config` に保存されます。
隔離した確認には `FILE_LOC` で別の保存ディレクトリを指定してください。
エミュレーターは親ディレクトリを再帰的に作らないため、起動前に親も含めて作成しておきます。
組み込みオファーを使う場合は `NO_SAMPLES=true` にしないでください。

### 3. パートナー企業側アプリを起動する

**別のターミナルをリポジトリのルートで開き**、実行します。

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:Fulfillment__BaseUrl = "http://localhost:3978/api"
$env:Fulfillment__PublisherId = "FourthCoffee"
$env:Landing__RequireAuthentication = "false"
$env:Fulfillment__Webhook__RequireSignedToken = "false"
dotnet run --no-launch-profile --project .\src\SaaSAgentSample.Web -- --urls http://localhost:5134
```

POSIXの場合：

```bash
ASPNETCORE_ENVIRONMENT=Development \
Fulfillment__BaseUrl=http://localhost:3978/api Fulfillment__PublisherId=FourthCoffee \
Landing__RequireAuthentication=false Fulfillment__Webhook__RequireSignedToken=false \
dotnet run --no-launch-profile --project src/SaaSAgentSample.Web -- --urls http://localhost:5134
```

`Database:ConnectionString` を上書きしない場合、アプリはSQLiteファイルを使います。
隔離した確認には、このターミナルで `Database__Provider=Sqlite` と
`Database__ConnectionString=Data Source=<新しいDBファイルの絶対パス>` を指定します。
アプリ・エミュレーターの保存先だけでなく、ブラウザーも新しいコンテキストを使ってください。
`SKIP_DATA_LOAD` だけではエミュレーターの書き込み先は分離されません。

### 4. アプリを開く

**http://localhost:5134/?culture=ja**（英語は `?culture=en`）を開き、
**購入体験を始める →** を選びます。別タブでストアが開きます。
購入後の設定リンクはエミュレーターの `/landing.html` ではなく、**パートナー企業側アプリ**へ進む必要があります。
有効化の結果まで進んで終えても、任意で同じ契約の保存記録を確認しても構いません。

`dotnet run` だけではエミュレーターは起動しません。
自動テストを実行しても、操作可能なストアが起動したまま残るわけではありません。

### 5. 自分のローカル環境を停止する

起動した各ターミナルでCtrl+Cを押します。プロセスは停止しますが、保存データは削除しません。
専用ターミナルを閉じると環境変数の上書きも終了します。
一時データを削除する場合は、停止後に自分が今回作成した保存先だけを対象にしてください。
共有デモの全件リセットを後片付けに使わないでください。

<a id="local-docker"></a>
## ローカルDocker手順

上記のビルド・エミュレーター起動の代わりにDockerを使います。.NETアプリはホストでビルド・実行します。
ComposeにはSQL Serverも定義され、そのパスワード変数はエミュレーターだけを選ぶ場合も展開されます。
ローカル専用の値を設定してください。別途DBテストをする場合以外、SQL Serverを起動する必要はありません。

リポジトリのルートでPowerShellから実行します。

```powershell
$env:MSSQL_SA_PASSWORD = "<強固なローカル専用の値>"
docker compose run --build --rm --service-ports --name marketplace-demo-emulator `
  -e LANDING_PAGE_URL=http://localhost:5134/ emulator
```

POSIXの場合：

```bash
MSSQL_SA_PASSWORD='<strong-local-only-value>' \
docker compose run --build --rm --service-ports --name marketplace-demo-emulator \
  -e LANDING_PAGE_URL=http://localhost:5134/ emulator
```

他の環境がある場合はコンテナー名・ポートを分けてください。Composeで必要に応じ同梱ソースからビルドし、
ホストの **8080** をコンテナーの **80** に公開します。
WebhookはComposeの `http://host.docker.internal:5134/api/webhook` を使います。
このターミナルは開いたままにし、別のアプリ用ターミナルでは上記の起動コマンドの
`Fulfillment__BaseUrl` だけを **`http://localhost:8080/api`** に変更します。
Composeだけではパートナー側のランディングURLが設定されないため、上の上書きは必須です。

起動したターミナルのCtrl+Cで停止します。`--rm` によりそのコンテナーとコンテナー内のエミュレーターデータが
削除されますが、アプリのSQLiteファイルは残ります。
他のSQL Serverやエミュレーターまで停止する `docker compose down` を後片付けに使わないでください。

## 3方向の接続を確認する

| 接続 | ローカルNode | ローカルDockerエミュレーター | Azureデモ |
| --- | --- | --- | --- |
| パートナーサーバー→API（`Fulfillment:BaseUrl`） | `http://localhost:3978/api` | `http://localhost:8080/api` | エミュレーターのHTTPS URL + `/api` |
| 購入者ブラウザー→パートナー（`LANDING_PAGE_URL`） | `http://localhost:5134/` | `http://localhost:5134/` | パートナーアプリのHTTPSルート |
| エミュレーター→パートナー（`WEBHOOK_URL`） | `http://localhost:5134/api/webhook` | `http://host.docker.internal:5134/api/webhook` | パートナーアプリのHTTPS URL + `/api/webhook` |

ポートを変えたら、影響する接続をすべて揃えてください。コンテナー内の `localhost` はホストではありません。
エミュレーターの `PUBLISHER_ID` とアプリの `Fulfillment:PublisherId` も一致させます。
旧トークンツールや内蔵APIランディングは、購入デモの入口ではありません。

<a id="azure-demo"></a>
## Azureデモ（ホスティングの承認がある場合のみ）

前提：.NET 10 SDK、Azure Developer CLI（`azd`）、Azure CLI（`az`）、`sqlcmd`、
対象環境でのリソース作成・DBアクセス付与の権限。
実行前に [azure.yaml](../azure.yaml)、[infra](../infra)、フックを確認してください。
エミュレーターはACRでリモートビルドするため、この経路にローカルDocker／Nodeは不要です。

```powershell
azd auth login
az login
azd up
```

両CLIで意図した同じテナント・サブスクリプションを使います。
`azd up` はApp Service、Azure SQL、ACR、Container Apps上のエミュレーターと関連リソースを作成します。
postprovisionフックはアプリ用SQLユーザーを作り、実行元の公開IPをSQLファイアウォールで一時的に許可します。
公開IPの取得には `api.ipify.org` を使います。

標準デモは購入者サインインが無効で、エミュレーターの未署名Webhookトークンを受け付けます。
本番用のセキュリティ設定として扱わないでください。
認証設定の変更だけで実Marketplaceに切り替わるわけでもありません。

出力の **App (start here)** を開きます。エミュレーターのルートではありません。
`azd show` でもURLを再表示できます。購入体験はローカルと同じです。

<a id="sql-access"></a>
### DBアクセスとデプロイ失敗

SQLユーザー作成に失敗した場合はフックのエラーを読み、対象サーバー・DBと権限を確認してから
[マネージドIDの手動SQL手順](deploy.ja.md#2-パスワードレス接続マネージド-id)を参照してください。
これは共通のDB設定手順の参照であり、その先の実Marketplace向け設定も実行する指示ではありません。

リージョンやリソースの利用可否はサブスクリプションによって異なります。この文書は利用可能性を保証せず、
リージョン候補機能を追加するものでもありません。エラーを確認し、既存デプロイを勝手に別環境へ振り替えないでください。

### Azureデモを削除する

対象環境を確認し、所有者の承認を得た場合だけ実行します。

```powershell
azd down
```

環境のリソースを削除し、契約データも失われ得ます。購入者の購読解約とは異なります。
共有環境や本番環境では実行しないでください。

<a id="troubleshooting"></a>
## 問題の切り分けと検証の限界

| 症状 | 確認すること |
| --- | --- |
| npm復元が失敗 | レジストリ・tarballの具体的なエラー。`npm config get registry` の設定とlockfileの取得URLは異なる場合がある。TLS無効化や依存バージョンの黙った変更はしない |
| ストアに接続できない | エミュレーターの起動とポート。アプリ単独起動では不足 |
| 設定リンクが内蔵APIページへ進む | `LANDING_PAGE_URL` がパートナー側アプリを指しているか |
| 通知後にパートナー記録が変わらない | 同じpublisher／購読か、Webhook到達性、応答、保存履歴。再読み込みだけでは配信の証拠にならない |
| ポートが使用中 | 空きポートを選び3方向の設定を変更。他の人のプロセスは止めない |

今回の文書更新で確認した範囲は[開発の検証記録](develop.ja.md#verification-record)に記載します。
ローカル確認の成功を、Azureデプロイ・実購入・本番適合の証明にはしません。
