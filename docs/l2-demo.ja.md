<a id="l2-ウォークスルー合成フルフィルメントライフサイクル"></a>

# フルフィルメント連携を検証する

パートナー側の保存結果を確認し、エミュレーターやAPIの応答と区別します。
**購入デモは有効化で完結し、以下の確認は任意です。**

> English: **[l2-demo.md](l2-demo.md)**
>
> ファイル名と `SyntheticL2LifecycleTests` クラスは従来の名前を保持しています。
> 「L2」はこのリポジトリの統合テスト分類で、Marketplaceの階層やデモ参加の前提用語ではありません。
> ブラウザー環境の準備は[run-demo](run-demo.ja.md)、意味の説明は[実装ガイド](walkthrough.ja.md)を参照してください。

<a id="a-自動の合成-l2推奨"></a>
<a id="automated-checks"></a>
## 自動テストと確認範囲

リポジトリのルートで実行します。

```powershell
dotnet test SaaSAgentSample.slnx --filter "FullyQualifiedName~SyntheticL2LifecycleTests|FullyQualifiedName~PurchaseJourneyTests"
```

| 確認 | 対象 | 証明しないこと |
| --- | --- | --- |
| `SyntheticL2LifecycleTests` | 実Fulfillmentクライアント→HTTPエミュレータースタブ、WebApplicationFactoryのアプリ、InMemory記録。Resolve→Activate→ChangePlan→Suspend→Reinstate→Unsubscribe | 完全なNodeエミュレーター、ブラウザー購入、実SQL永続化、実Marketplace |
| 同テスト内の有効化 | `LandingService`を直接呼び、外部APIを呼び出す | 購入者ページのクリックやフォームPOST |
| `PurchaseJourneyTests` | 別のページ／フォームPOST、文脈、保存記録リンク、日英表示、固定ガイドURL | Nodeエミュレーターを実行するブラウザー全体 |
| エミュレーターのJest | API動作とクライアントロジック。購入画面のテストはNode VM／模擬DOMを使用 | アプリを跨ぐブラウザーE2E全体 |
| SQL Server統合テスト | 明示的に有効にした場合のプロバイダ固有の保存・マイグレーション | SyntheticL2のDB変更。同フィクスチャは引き続きInMemoryを選ぶ |

合成ライフサイクルテストは遷移後のパートナー状態とプラン変更への応答を確認します。
別のテストでは未知のoperationを403で拒否し、状態を変えないことを確認します。
これらは記載範囲内の証拠であり、本番認定ではありません。

前提条件と広い範囲のテストコマンドは[develop](develop.ja.md#ビルドとテスト)へ。
自動テスト終了後にブラウザー用デモが動作したまま残るわけではありません。

<a id="b-実エミュレーター相手の手動ウォークスルー"></a>
<a id="1-エミュレーターを起動"></a>
<a id="2-エミュレーターに向けてアプリを起動"></a>
<a id="3-resolve-と-activate"></a>
## 手動確認の準備

[run-demo](run-demo.ja.md)で両コンポーネントを起動し、3方向の接続を揃えます。
自分の隔離環境で架空データを使い、**アプリ `/` → 購入体験を始める → ストア → 注文 →
パートナー企業のサイトで設定する → サブスクリプションを有効化**と進みます。
結果から同じ保存済み契約を開きます。APIだけの確認をしたい場合以外は、
旧トークンツールを入口にしないでください。

<a id="4-webhook-を駆動"></a>
<a id="manual-checks"></a>
## 任意の通知・保存状態の確認

保存済み契約の **この契約の変更を試す ↗** で同じエミュレーター購読を選びます。
現在の状態で有効な画面操作を使ってください。以下は通知action名であり、
購入者が必ず実行する別の操作順ではありません。

| action・前提 | 期待するパートナー側の記録 |
| --- | --- |
| 新しい購入をResolve | `PendingFulfillmentStart` |
| 明示的なActivate | `Subscribed` |
| 有効状態でChangePlan | 新しい `PlanId`、状態は `Subscribed`。保存イベントと記録された以前のプランを確認 |
| 有効状態でSuspend | `Suspended` |
| 停止状態でReinstate | `Subscribed` |
| 有効・停止中のテスト購読でUnsubscribe | `Unsubscribed`。この記録では終端 |
| ChangeQuantity | イベント・応答。パートナー側ドメインに数量項目は追加されない |
| Renew | 情報通知イベント。この実装では状態は変更しない |

エミュレーターの購読IDとパートナーレコードのGUIDは別です。架空のIDを手で作らず、
生成されたリンクを使ってください。パートナー一覧のMarketplace IDフィルターは完全一致です。
同じ `/admin/{guid}#history` に戻って再読み込みし、保存された証拠を確認します。
以前のプランが記録されていなければ、比較は推測ではなく **記録なし** が期待値です。

Webhook配信、処理、応答、保存は別の段階です。更新が見えない場合は単に「反映待ち」と決めつけず、
エラーや記録の有無を確認してください。カタログ編集、操作ボタンの色、
エミュレーターのHTTP成功応答はパートナー側への保存を証明しません。

標準デモは未署名のエミュレーター通知のためJWT署名検証を緩和し、Get Operation照合は残しています。
本番用Webhook認証の検証ではありません。実Marketplaceでの検証は別の作業です。
[実装範囲](walkthrough.ja.md#implementation-boundary)を参照してください。

<a id="5-破棄teardown"></a>
## 終了する

[run-demo](run-demo.ja.md)に従い、自分のプロセスだけを停止します。
この確認のために共有購読を全件リセットしないでください。
デモのリセットはデータを削除する別のテストツールで、Marketplaceの購入・解約操作ではありません。

<a id="設定リファレンス"></a>
接続値は[run-demo](run-demo.ja.md#3方向の接続を確認する)、
アプリ設定とDBの動作は[develop](develop.ja.md#ローカル設定)にまとめています。
エミュレーター単体の設定参考は[こちら](../emulator/docs/config.md)です。

<a id="出典http-200-で取得確認"></a>
## 参考資料と証跡

[公式の連携資料](walkthrough.ja.md#sources)と
[今回の文書検証記録](develop.ja.md#verification-record)では、
仕様、自動テスト、手動観測、過去の画像証跡を区別しています。
