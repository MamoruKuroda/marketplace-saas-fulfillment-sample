# デプロイ地域の候補を選ぶ

> English: [deployment-regions.md](deployment-regions.md)

`azd up` はインフラのパラメーターを確定する前に、地域候補の案内を実行します。
使用するのは **azd の認証**であり、Azure CLI で別途選択されているアカウントではありません。
この案内処理は Azure リソースを作成せず、ログイン・Azure CLI の選択サブスクリプション変更・
SKU 変更もしません。確認後に、通常のプロビジョニング、SQL 権限付与フック、
アプリのデプロイへ進みます。

**無料構成に変更する機能ではありません。** App Service B1、SQL S0、ACR Basic、
Emulator、ログの既存構成はそのままです。

## 初回の流れ

1. .NET 10 SDK、azd 1.33.0 以降、Azure CLI とその Bicep CLI を用意します。
   後続の SQL フックには sqlcmd、Windows では PowerShell 7 も必要です。
   前提ツールは利用者が用意します。この案内処理はインストールしません。
2. `azd auth login` でサインインし、`azd up` を実行します。
3. 表示されたアカウントとサブスクリプションを確認します。azd 環境にサブスクリプションが
   未設定なら、照会できた azd テナントから見える候補を表示します。
   追加認証が必要なテナントは「未確認」と表示します。
   トークン取得には選んだサブスクリプションのテナントを明示し、
   別の既定 azd 環境に配置先の認証を左右されないようにします。
4. 配置先の国・地理範囲を指定するか、**希望なし**を選びます。名称は Azure の地域情報を使用します。
   英語表示だから米国、日本語表示だから日本、とは判断しません。
5. 事前チェックの結果から地域を選びます。最後に配置先と、課金対象の構成であることを確認します。

リソース種別・API バージョンの提供地域と、App Service の Linux 階層の提供地域で候補を絞ります。
その後、**実際の `infra/main.bicep` をコンパイルしたテンプレート**に、
`infra/main.parameters.json` の入力と候補地域を設定し、サブスクリプションスコープの
deployment **validate** API を `validationLevel: Provider` で呼び出します。

対象サブスクリプションとスコープに対する要求を Azure 側で評価します。
クォータ、ポリシー、権限などに関する事前検出可能な問題を拾います。
独自の Azure Policy 評価エンジンは実装せず、継承・除外・免除をすべて列挙したとも主張しません。
**提供地域一覧に載っているだけでは、残クォータがあるとはいえません。**

1回の候補表示では、最大5回の validation 呼び出し、または候補3件の発見で一区切りにします。
追加候補は、デプロイせずに続けて調べられます。「希望なし」では Azure の
`Recommended` 地域分類、続いて地域名のアルファベット順に調べます。
最安・最短遅延のランキングではありません。選んだ地理範囲は次回も保持します。

## 結果の意味と限界

| 結果 | 意味 |
| --- | --- |
| 候補 | その時点で Provider 検証を通過し、diagnostics が報告されなかった。デプロイ成功の保証ではない |
| 利用不可 | 提供地域の除外、または明示的な検証エラー。入れ子の原因も表示 |
| 未確認 | 権限不足、タイムアウト、API 制限、不完全な検証の diagnostics、想定外の応答。成功した候補としては選択できない |

チェックには API 呼び出しと時間が必要です。数分かかる場合があります。
アプリのリソースは作成しませんが、validate 操作が Azure のアクティビティログに
記録される場合があります。このヘルパーの ARM 操作は GET と deployment-validation POST のみで、
deployment-create は送信しません。

Azure の事前検証はベストエフォートです。確認後に容量が変わる場合があります。
ACR ビルド、イメージ取得、アプリ起動、postprovision の SQL ユーザー作成・Firewall 操作は
対象外です。候補になっても、それらの成功は保証しません。
照会と ARM 検証の権限が必要で、RBAC の迂回や Template-only 検証への切り替えはしません。

例えば `InternalSubscriptionIsOverQuotaForSku` で **B1 上限0・使用0・必要1**と出た場合、
ブロックされているのは App Service Plan です。Container Apps や SQL の失敗とは限りません。
このエラーの `Location:` 欄が空でも、テンプレートに地域が渡っていないとは断定できません。

## 作成済みの環境

`rg-<環境名>` が存在する場合は、その RG の地域だけを確認します。空の RG も同様です。
元の `AZURE_LOCATION` が不明、または RG の地域と食い違えば停止します。
提供地域との比較では表記を正規化しますが、検証とデプロイには**元の入力文字列をそのまま**
使用します。このサンプルでは、その文字列がリソース名の生成に含まれるためです。
Azure 側で正規化された地域名から元の入力を推測して置き換えません。

前回が RG を作る前に失敗していれば、別の候補を選べます。
記録済みのサブスクリプションが変更されていた場合も停止します。
既存環境を別のサブスクリプションへ向け直すのではなく、別の azd 環境を使用してください。
このヘルパーは既存リソースを削除・移行しません。

## 任意設定

`azd up` の**前に** `azd env set <キー> <値> --environment <環境名>` で設定します。
フックには選択した azd 環境の変数が渡され、同名の OS 環境変数より優先されます。

| 設定 | 意味 |
| --- | --- |
| `AZURE_SUBSCRIPTION_ID` | 対象サブスクリプション。未設定なら対話選択 |
| `AZURE_TENANT_ID` | azd トークンのテナントを明示。ゲストアカウント等で使用。自動ログインはしない |
| `AZURE_LOCATION` | 新規環境で優先する地域。無人実行ではこの地域だけを確認。既存 RG の地域と一致し、元の入力の表記も保持する |
| `DEPLOYMENT_GEOGRAPHY` | Azure の geography 名（例：`Japan`）。空文字は希望なし。新規環境の探索だけを絞る |
| `DEPLOYMENT_PREFLIGHT_LANGUAGE` | `en` / `ja`。未設定ならプロセスの UI カルチャに従い、日本語以外は英語 |
| `DEPLOYMENT_PREFLIGHT_ACCEPT` | `true` で無人実行の確認を許可。ただしサブスクリプションと地域の指定が必要。新たな地域を自動選択しない |
| `DEPLOYMENT_PREFLIGHT_MODE` | `off` で候補案内を明示的に無効化。通常の azd 検証は残り、成功した結果を偽装しない |

確認後、選択した azd 環境に `AZURE_SUBSCRIPTION_ID`、`AZURE_TENANT_ID`、`AZURE_LOCATION`、
地理条件とサブスクリプション変更検知用の値を保存します。
アクセストークンや ARM 応答全文は保存しません。アカウントは手元の画面に表示されるため、
スクリーンショットを共有する際は伏せてください。
エラー表示では GUID・メールアドレス・一般的な資格情報の形式をマスクします。

CI ではサブスクリプション・地域・`DEPLOYMENT_PREFLIGHT_ACCEPT=true` を事前設定し、
`AZD_NON_INTERACTIVE=true` で実行します。`--no-prompt` だけでスクリプトフックの
入力制御まで設定されるとは考えないでください。配置先が未設定なら推測せず停止します。

登録したフックは `--interactive` を渡し、azd がパイプ経由で転送する標準入力も受け付けます。
質問を有効にするもので、自動承認ではありません。CI・非対話設定は引き続き適用され、
キャンセルや入力終了（EOF）では停止します。`--check-only` との併用はできません。

この経路では `azd up --location` / `--subscription` ではなく、azd 環境に設定してください。
azd 1.33.0 ではこれらのフラグは **preup の後**に適用され、フックで選んだ値と
矛盾すると azd が拒否する場合があります。
案内は `up` に接続され、単独の `provision` / `deploy` では実行されません。

### デプロイ・設定保存をせずに候補だけ確認する

単独ヘルパーは `--check-only` を受け付けます。プロセスの環境変数に
`AZURE_ENV_NAME` と対象の `AZURE_SUBSCRIPTION_ID` を明示してください。
`AZURE_TENANT_ID` も指定すればテナント横断の探索を避けられます。
`DEPLOYMENT_GEOGRAPHY` や `AZURE_LOCATION` で確認範囲を絞ることもできます。

```bash
dotnet run --project tools/DeploymentPreflight --configuration Release -- --check-only
```

候補を1バッチだけ確認して終了し、地域選択の質問、azd 環境の保存、
プロビジョニングへの続行は行いません。終了コード0は候補が1件以上通過、
非0は候補を確定できないか前提条件の失敗です。バッチ外の地域は未確認のままです。
この確認専用経路には `azd up` を使用しないでください。

対象は、このリポジトリのサブスクリプションスコープ Bicep 構成と Azure パブリッククラウドです。
テナントをまたぐ委任デプロイ、独自の IaC パス／プロバイダー、任意の ARM パラメーター式には対応しません。
これらを変える際はヘルパーも更新し、異なるテンプレートや入力での代理検証にしないでください。

## バージョンと確認範囲

- **azd 1.33.0**：公開リリースのソースで呼び出し順序を確認。
  `preup` は up のパラメーター確定前に実行され、フック後に azd が環境を再読み込みします。
  ヘルパーは現在 hidden コマンドである `azd auth token` を使用します。
  azd 更新時にはこのインターフェースの変更も確認が必要です。
- **オフラインの対象**：既存 .NET/xUnit で、地域絞り込み、入れ子のエラー、
  不完全な検証、ARM ポーリング、既存環境の保護、確認後の保存を CLI/HTTP の代替応答で扱います。
- **オフライン検査に使用した SDK**：Windows ARM64 上の .NET SDK 10.0.112。
- **ローカル Bicep コンパイラー**：0.45.15。地域の必須パラメーター化と、
  ヘルパーが使用する RG の命名契約を含む実テンプレートのコンパイルを確認しています。
- **2026-09-10 の実環境 check-only 実行**：セッション専用に展開した公式 azd 1.33.0 を使い、
  既存の azd 検証用認証と1つの検証サブスクリプションで確認しました。
  `australiaeast`、`austriaeast`、`canadacentral` は Provider 検証を通過しました。
  `brazilsouth` は App Service B1 の上限0・必要1で拒否され、
  `belgiumcentral` は Log Analytics の提供地域一覧により除外されました。
  これは当該サブスクリプション・当該時点の結果であり、推奨地域や他環境での成功保証ではありません。
  このバッチの残り58地域は未確認です。
- **この実行の範囲**：配置先の保存・リソース作成は行っていません。
  単独の check-only 経路であり、`azd up` 全体の実行ではありません。
  既存の azd 1.28.1 の更新や再ログインは行っていません。
- **2026-09-12 の実フック接続確認**：セッション専用コピーで公式 azd 1.33.0 の
  `up` コマンドと実ヘルパー・フックスクリプト・Bicep 入力を使用しました。
  安全のため services と SQL フックを置かず、検証用 `up` ワークフローは
  `env get-value AZURE_LOCATION` のみとし、ローカルの `postup` 検査で
  引き継いだ地域と検証用 `.env` の保存値を照合しました。
  転送された標準入力で実際の質問に回答し、ARM 検証・azd 環境再読み込みも実物で確認しています。
  `australiaeast` の選択・確認後は Bicep 初期化と読み取り専用の引き継ぎ検査に到達しました。
  最後の確認でキャンセルした場合、`azd up` は非0で終了し、地域を保存せず後続処理にも進みませんでした。
  成功・キャンセル両ケースの対象 RG は引き続き HTTP 404 でした。
- この確認で、転送入力がリダイレクト扱いになるため `Console.IsInputRedirected` だけでは
  有効な対話も拒否してしまう問題を発見・修正しました。明示的な対話モード、
  CI・非対話設定、キャンセル・EOF の回帰テストを追加しています。
- **引き続き未確認**：通常の provision/package/publish/deploy ワークフロー全体、
  実リソース作成、ポリシー拒否の実ケース、SQL 設定、アプリ起動、
  全対応 OS・ターミナルでの対話動作です。検証用ワークフローの azd 成功メッセージを
  クラウドへのデプロイ成功と解釈してはいけません。
  保存したのは検証用コピーのローカル環境だけで、既存 Azure 認証・リソース、
  リポジトリの `.azure` 状態、インストール済み azd は変更していません。

## 出典

- [Azure の地域と geography 情報](https://learn.microsoft.com/en-us/rest/api/resources/subscriptions/list-locations?view=rest-resources-2022-12-01)
- [App Service SKU の提供地域](https://learn.microsoft.com/en-us/cli/azure/appservice?view=azure-cli-latest#az-appservice-list-locations)
- [サブスクリプションスコープの validation API](https://learn.microsoft.com/en-us/rest/api/resources/deployments/validate-at-subscription-scope?view=rest-resources-2025-04-01)
- [ARM preflight と限界](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/deploy-preflight)
- [検証レベルと権限](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/deploy-what-if)
- [Azure Policy のスコープ・除外・免除](https://learn.microsoft.com/en-us/azure/governance/policy/concepts/scope)
- [azd 1.33.0 preup middleware](https://github.com/Azure/azure-dev/blob/29133b640536436db9b56f8db4b1781cb136e5ba/cli/azd/cmd/middleware/hooks.go)
- [azd 1.33.0 フック後の環境再読み込み](https://github.com/Azure/azure-dev/blob/29133b640536436db9b56f8db4b1781cb136e5ba/cli/azd/pkg/ext/hooks_runner.go)
