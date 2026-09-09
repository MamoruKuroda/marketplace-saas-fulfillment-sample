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

この経路では `azd up --location` / `--subscription` ではなく、azd 環境に設定してください。
azd 1.33.0 ではこれらのフラグは **preup の後**に適用され、フックで選んだ値と
矛盾すると azd が拒否する場合があります。
案内は `up` に接続され、単独の `provision` / `deploy` では実行されません。

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
- **Azure 実環境での一連の動作確認：未実施。** ソースの確認やオフライン検査を
  「クラウドへのデプロイ成功」と記載してはいけません。

## 出典

- [Azure の地域と geography 情報](https://learn.microsoft.com/en-us/rest/api/resources/subscriptions/list-locations?view=rest-resources-2022-12-01)
- [App Service SKU の提供地域](https://learn.microsoft.com/en-us/cli/azure/appservice?view=azure-cli-latest#az-appservice-list-locations)
- [サブスクリプションスコープの validation API](https://learn.microsoft.com/en-us/rest/api/resources/deployments/validate-at-subscription-scope?view=rest-resources-2025-04-01)
- [ARM preflight と限界](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/deploy-preflight)
- [検証レベルと権限](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/deploy-what-if)
- [Azure Policy のスコープ・除外・免除](https://learn.microsoft.com/en-us/azure/governance/policy/concepts/scope)
- [azd 1.33.0 preup middleware](https://github.com/Azure/azure-dev/blob/29133b640536436db9b56f8db4b1781cb136e5ba/cli/azd/cmd/middleware/hooks.go)
- [azd 1.33.0 フック後の環境再読み込み](https://github.com/Azure/azure-dev/blob/29133b640536436db9b56f8db4b1781cb136e5ba/cli/azd/pkg/ext/hooks_runner.go)
