(function () {
    const I18N = {
        en: {
            "nav.marketplace": "Marketplace",
            "map.step1": "Buy in Marketplace",
            "map.step1Desc": "You're the buyer, shopping in Microsoft's marketplace.",
            "map.step2": "Activate",
            "map.step2Desc": "The buyer lands here and confirms. Activation starts billing.",
            "map.step3": "Manage",
            "map.step3Desc": "The publisher's own subscription database — what the app checks before letting a customer in.",
            "map.step4": "Lifecycle events",
            "map.step4Desc": "Suspend, change, or cancel from here; webhooks update the publisher's state.",
            "map.hereEmulator": "Emulator (Microsoft)",
            "map.herePublisher": "Publisher app",
            "map.operatedBy": "Operated by",
            "map.youBuild": "You build",
            "map.whoBuyer": "Buyer",
            "map.whoPublisher": "Publisher (you)",
            "map.whoMicrosoft": "Microsoft",
            "map.partLanding": "Landing page",
            "map.partStore": "Your subscription database",
            "map.partWebhook": "Connection webhook",
            "map.webhookDesc": "Receives renewal, suspend, cancel and plan changes. No page — an endpoint.",
            "nav.subscriptions": "Subscriptions",
            "nav.landingPage": "Landing Page",
            "nav.offers": "Offers",
            "nav.config": "Config",
            "masthead.side": "Microsoft side (stand-in) — storefront, billing, webhooks",
            "hint.marketplace": "Shop as the buyer in Microsoft's marketplace, then hand off to the publisher's landing page.",
            "hint.subscriptions": "Stand in for the customer/Microsoft managing a subscription after purchase — change, suspend, reinstate, or cancel. Each action sends a webhook to the publisher app.",
            "hint.landing": "The emulator's own built-in landing page. In this demo the real landing is the publisher app, which the purchase redirects to.",
            "hint.offers": "Set up the sample offers and plans the Marketplace tab sells (setup, not part of the main flow).",
            "hint.config": "Emulator settings — webhook URL, timing delays, and sample data.",
            "common.introduction": "Introduction",
            "common.warning": "Warning",
            "common.configuration": "Configuration",
            "common.quantity": "Quantity",
            "common.subscriptionName": "Subscription Name",
            "common.status": "Status",
            "common.availableActions": "Available Actions",
            "common.offer": "Offer",
            "common.plan": "Plan",
            "common.offerId": "Offer Id",
            "common.planId": "Plan Id",
            "common.publisherId": "Publisher Id",
            "common.beneficiaryEmail": "Beneficiary Email",
            "common.companyName": "Company Name",
            "common.contactTelephone": "Contact Telephone",
            "common.continue": "Continue",
            "common.set": "Set",
            "common.yes": "Yes",
            "common.no": "No",
            "common.ok": "Ok",
            "common.close": "Close",
            "common.copy": "Copy",
            "common.copied": "Copied",
            "common.delete": "Delete",
            "common.save": "Save",
            "common.clone": "Clone",
            "common.cancel": "Cancel",
            "common.create": "Create",
            "common.view": "View",
            "common.edit": "Edit",
            "common.free": "Free",
            "common.unknownPrice": "Unknown price",
            "common.valueRequired": "Value is required",
            "common.invalidValue": "Invalid value",
            "common.error": "Error",
            "common.activate": "Activate",
            "common.activateSubscription": "Activate Subscription",
            "common.goToSubscriptions": "Go to Subscriptions",
            "common.subscriptionActivated": "Subscription Activated",
            "common.subscriptionJson": "Subscription JSON",
            "common.marketplaceToken": "Marketplace Token",
            "common.viewJson": "View JSON",
            "common.viewToken": "View token",
            "common.showOptionalFields": "Show optional fields",
            "common.hideOptionalFields": "Hide optional fields",
            "common.getItNow": "Get it now",
            "common.createNewOffer": "Create New Offer",
            "common.you": "You",
            "common.newOffer": "New Offer",
            "common.viewOffer": "View Offer",
            "common.editOffer": "Edit Offer",
            "common.offerName": "Offer Name",
            "common.priceModel": "Price Model",
            "common.perSeat": "Per Seat",
            "common.flatRate": "Flat Rate",
            "common.planName": "Plan Name",
            "common.billingTerm": "Billing Term",
            "common.price": "Price",
            "common.oneMonth": "1 Month",
            "common.oneYear": "1 Year",
            "common.offerCentral": "Offer Central",
            "common.publisherIdPrefix": "Publisher Id: ",
            "action.changeQuantity": "Change Quantity",
            "action.changePlan": "Change Plan",
            "action.suspend": "Suspend",
            "action.reinstate": "Reinstate",
            "action.unsubscribe": "Unsubscribe",
            "action.renew": "Renew",
            "action.detail": "Detail",
            "action.state": "State",
            "action.changeQuantityWebhook": "Change quantity",
            "action.changePlanWebhook": "Change plan",
            "status.PendingFulfillmentStart": "Pending",
            "status.Subscribed": "Subscribed",
            "status.Suspended": "Suspended",
            "status.Unsubscribed": "Unsubscribed",
            "notify.subscriptionUpdated": "Subscription updated",
            "notify.resolve": "/resolve",
            "notify.activate": "/activate",
            "offerTile.plansStartAt": "Plans start at",
            "offerTile.perUser": "user/",
            "offerTile.month": "month",
            "offerTile.year": "year",
            "index.infoHtml": "<p>This emulator stands in for Microsoft, so you can drive a purchase and the whole subscription lifecycle without a real Marketplace transaction. The map above shows where each step happens.</p><p>It ships with two sample offers (<em>flat-rate</em> and <em>per-user</em>), each with sample plans. API reference: <a href=\"https://learn.microsoft.com/en-us/partner-center/marketplace-offers/pc-saas-fulfillment-subscription-api\" target=\"_blank\" rel=\"noopener\">SaaS fulfillment Subscription APIs v2</a>.</p>",
            "index.sampleMarketplaceBehaviour": "Sample Marketplace Behaviour",
            "index.noOffersHtml": "No offers have been configured and sample offers have been disabled.<br />Go to <a href=\"/offers.html\">Offer Central</a> to create one",
            "index.placeholderHtml": "Select an offer to the left to configure the<br/>purchase by clicking \"Get it now\"",
            "index.configurePurchase": "Configure Purchase",
            "index.profileInfo": "This app requires some basic profile information. We have pulled your Microsoft Account data to help you get started. Azure Marketplace will save your information for next time.",
            "index.beneficiaryObjectId": "Beneficiary Object ID",
            "index.beneficiaryTenantId": "Beneficiary Tenant ID",
            "index.optionalRealUser": "To simulate a purchase with a real user, enter their AAD Object ID and Tenant ID below.",
            "index.optionalPurchaser": "To simulate a purchase with a real user on behalf of another real user, check \"Specify purchaser\" enter their AAD Object ID and Tenant ID below.",
            "index.specifyPurchaser": "Specify purchaser",
            "index.purchaserEmail": "Purchaser Email",
            "index.purchaserObjectId": "Purchaser Object ID",
            "index.purchaserTenantId": "Purchaser Tenant ID",
            "index.termsHtml": "Collect additional information above, as desired.<br />The user must also accept the Terms and Conditions and Privacy policy here to proceed.",
            "index.configError": "Something went wrong trying to get config from the emulator",
            "index.noLandingPageUrl": "No landing page URL set in config",
            "index.remoteLandingConfirmHtml": "The landing page is set to localhost but the emulator appears to be running on a remote host. Please confirm the landing page URL is correct. Visit the Config page to check.<br /><br />Would you like to continue?",
            "landing.withTokenHtml": "<p>This is the emulator's built-in landing page. It's a very simple implementation to provide something that works out the box.</p><p>The landing page resolves (decodes) the purchase token passed to it from the marketplace.</p><p>The token contains the purchase details, these are used to populate the fields on the right.</p><p>It is also the place to capture any additional details from the customer prior to onboarding.</p><p>Click the \"Activate Subscription\" button to activate the displayed subscription.</p>",
            "landing.noTokenInfoHtml": "<p>This is the emulator's built-in landing page. It's a very simple implementation to provide something that works out the box.</p><p>To make it function, a purchase token needs to be passed in the query string.</p><ul><li>Return to the <a href=\"/\">Marketplace page</a></li><li>Generate a token</li><li>Configure your purchase</li></ul>",
            "landing.configureSubscription": "Configure Subscription",
            "landing.noTokenHtml": "The url doesn't contain a marketplace token.<br />Go to the <a href=\"/\">Marketplace page</a> and purchase an offer.",
            "landing.marketplaceSso": "For the commercial marketplace, this page must be AAD SSO enabled You should check the user identity against the resolved token to ensure they match Optionally, you can collect additional details from the customer for onboarding (eg below)",
            "subs.workflow": "Subscription Workflow",
            "subs.infoHtml": "<p>Subscriptions will be listed below once created with the API using the marketplace token on the previous page.</p><p>Actions are limited to those available for the subscription state.</p><p>A suspended subscription can be reactivated, an unsubscribed subscription is locked at that state and cannot be resubscribed.</p><p>The webhook URL is set to the standard container configuration, if you are running on a different URL / Port update to enable the webhooks.</p>",
            "subs.testWebhookActions": "Subscriptions: Test Webhook Actions",
            "subs.col.subscriptionId": "Subscription Id",
            "subs.col.name": "Name",
            "subs.col.offer": "Offer",
            "subs.col.plan": "Plan",
            "subs.col.qty": "Qty",
            "subs.missingOffer": "The offer associated with this subscription has not been loaded or been deleted.",
            "subs.buttonColourKeyHtml": "Button Colour Key - emulate action changing the subscription <button class=\"detail\" disabled=\"disabled\">Detail</button> <button class=\"state\" disabled=\"disabled\">State</button>",
            "subs.renewNote": "Renew: you will see an HTTP response but no change to this page.",
            "subs.howManyLicenses": "How many licenses?",
            "subs.changePlanTo": "Change plan to?",
            "subs.deleteConfirmHtml": "Deleting a subscription cannot be undone<br /> <br />Are you sure you want to continue?",
            "subs.deleteTitle": "Delete Subscription",
            "subs.noOtherPlans": "There are no other plans defined on this offer",
            "offers.infoHtml": "<p>Use <strong>Offer Central</strong> to view, edit and create offers to use in the emulator.</p><p><strong>Points of note:</strong></p><ul><li>Offer Id must be unique - the Emulator, can replicate Partner Center</li><li>Basic offer and plan details are used for the Emulator, not the full scope</li><li>Plans only have one billing parameter for simplicity (see below)</li><li>You can clone existing offers as a template for a new one</li><li>You cannot edit the sample offers that ship with the Emulator</li><li>You cannot delete an offer if it is in use</li><li>The only currency is USD</li></ul><p><strong>In Partner Center</strong> you would build the Offer &gt; Plan &gt; Billing, using M365 as an example:</p><ul><li>Offer: the product, e.g. M365</li><li>Plan: a specific feature set, e.g. E3 and per user</li><li>Billing: pricing, e.g. per month, per annum</li></ul><p><strong>In the Emulator</strong>, currently, the Plan and Billing elements are a single item - <strong>create a Plan as required and add a single billing metric for that Plan.</strong></p>",
            "offers.offerIdExists": "Offer Id already exists",
            "offers.planIdExists": "Plan Id already exists",
            "offers.deleteConfirmHtml": "Deleting an offer cannot be undone<br /><br />Are you sure you want to continue?",
            "offers.deleteTitle": "Delete Offer",
            "offers.unableDelete": "Unable to delete offer, it might be associated with a subscription",
            "offers.copySuffix": " Copy",
            "config.warningHtml": "<p>This form allows you to update environment variables for the emulator. <strong>Understand the scope </strong>of the variables before updating to avoid unexpected behaviours from the emulator that may distort testing results.</p><p>Note: The default value for \"Landing Page URL\" assumes you are running the emulator locally. If you are running the emulator on a remote host (eg in Azure Container Images) update the Landing Page URL with the IP address or FQDN of your remote host.</p>",
            "config.summary": "Changing configuration on this page will only store the values until the emulator is restarted. To run the emulator with the new values, set the appropriate environment variables on startup.",
            "config.webhookLanding": "Webhook and Landing Page",
            "config.webhookLandingSummary": "The webhook and landing pages are required when creating an offer in Partner Center.",
            "config.webhookUrl": "Webhook URL",
            "config.landingPageUrl": "Landing Page URL",
            "config.emulatorBehaviour": "Emulator Behaviour",
            "config.emulatorBehaviourSummary": "This section controls the behaviour of the emulator, timeouts, delays, etc",
            "config.operationTimeout": "Operation Timeout (ms)",
            "config.subscriptionUpdateDelay": "Subscription Update Delay (ms)",
            "config.webhookCallDelay": "Webhook Call Delay (ms)",
            "config.webhookCallPatchDelay": "Webhook Call Patch Delay (ms)",
            "config.requireMarketplaceAuthToken": "Require Marketplace Auth Token",
            "config.showRawConfig": "Show Raw Config",
            "config.dangerZone": "Danger Zone!",
            "config.clearDataFile": "Clear Data File",
            "config.clear": "Clear",
            "config.changeConfirmHtml": "<p>This change will occur but not be persisted and will be lost if the emulator is restarted, to start the emulator with this new value use the following environment variable:</p><pre>{env} = {val}</pre><p>Do you want to continue?</p>",
            "config.changeTitle": "Change Config",
            "config.updateFailedHtml": "<p>Failed to update config</p><p class=\"error\">{error}</p>",
            "config.rawTitle": "Config",
            "config.clearConfirmHtml": "Clearing the data file will remove all custom offers and subscriptions and cannot be undone.<br /><br />Are you sure you want to continue?",
            "config.clearTitle": "Clear Data"
        },
        ja: {
            "nav.marketplace": "マーケットプレース",
            "map.step1": "マーケットプレースで購入",
            "map.step1Desc": "あなたは購入者。Microsoft のマーケットプレースで買い物をします。",
            "map.step2": "有効化",
            "map.step2Desc": "購入者がここに着地して確認します。有効化すると課金が始まります。",
            "map.step3": "管理",
            "map.step3Desc": "パブリッシャー自身の契約状況DB。顧客に使わせる前にアプリが見る場所です。",
            "map.step4": "ライフサイクル イベント",
            "map.step4Desc": "ここから一時停止・変更・解約すると、Webhook でパブリッシャー側の状態が更新されます。",
            "map.hereEmulator": "エミュレーター（Microsoft）",
            "map.herePublisher": "パブリッシャーのアプリ",
            "map.operatedBy": "操作するのは",
            "map.youBuild": "あなたが作る",
            "map.whoBuyer": "購入者",
            "map.whoPublisher": "パブリッシャー（あなた）",
            "map.whoMicrosoft": "Microsoft",
            "map.partLanding": "ランディング ページ",
            "map.partStore": "自社側の契約状況DB",
            "map.partWebhook": "接続 Webhook",
            "map.webhookDesc": "更新・一時停止・解約・プラン変更を受け取ります。画面はなくエンドポイントです。",
            "nav.subscriptions": "サブスクリプション",
            "nav.landingPage": "ランディングページ",
            "nav.offers": "オファー",
            "nav.config": "設定",
            "masthead.side": "Microsoft 側の代役 — ストア・課金・Webhook",
            "hint.marketplace": "購入者として Microsoft のマーケットプレースで買い物し、パブリッシャーのランディングページへ引き渡します。",
            "hint.subscriptions": "購入後に顧客／Microsoft がサブスクリプションを管理する操作の代役です — 変更・一時停止・再開・解約。各操作はパブリッシャーのアプリへ Webhook を送信します。",
            "hint.landing": "エミュレーター内蔵のランディングページです。本デモの実際のランディングはパブリッシャーのアプリで、購入後はそちらへリダイレクトされます。",
            "hint.offers": "マーケットプレースタブで販売するサンプルのオファーとプランを設定します（セットアップ用で、本筋の手順ではありません）。",
            "hint.config": "エミュレーターの設定 — Webhook URL、遅延、サンプルデータ。",
            "common.introduction": "はじめに",
            "common.warning": "警告",
            "common.configuration": "設定",
            "common.quantity": "数量",
            "common.subscriptionName": "サブスクリプション名",
            "common.status": "状態",
            "common.availableActions": "実行可能なアクション",
            "common.offer": "オファー",
            "common.plan": "プラン",
            "common.offerId": "オファー ID",
            "common.planId": "プラン ID",
            "common.publisherId": "パブリッシャー ID",
            "common.beneficiaryEmail": "受益者メール",
            "common.companyName": "会社名",
            "common.contactTelephone": "連絡先電話番号",
            "common.continue": "続行",
            "common.set": "設定",
            "common.yes": "はい",
            "common.no": "いいえ",
            "common.ok": "OK",
            "common.close": "閉じる",
            "common.copy": "コピー",
            "common.copied": "コピーしました",
            "common.delete": "削除",
            "common.save": "保存",
            "common.clone": "複製",
            "common.cancel": "キャンセル",
            "common.create": "作成",
            "common.view": "表示",
            "common.edit": "編集",
            "common.free": "無料",
            "common.unknownPrice": "価格不明",
            "common.valueRequired": "値は必須です",
            "common.invalidValue": "値が無効です",
            "common.error": "エラー",
            "common.activate": "有効化",
            "common.activateSubscription": "サブスクリプションを有効化",
            "common.goToSubscriptions": "サブスクリプションへ移動",
            "common.subscriptionActivated": "サブスクリプションを有効化しました",
            "common.subscriptionJson": "サブスクリプション JSON",
            "common.marketplaceToken": "マーケットプレース トークン",
            "common.viewJson": "JSON を表示",
            "common.viewToken": "トークンを表示",
            "common.showOptionalFields": "任意項目を表示",
            "common.hideOptionalFields": "任意項目を隠す",
            "common.getItNow": "今すぐ入手",
            "common.createNewOffer": "新しいオファーを作成",
            "common.you": "自分",
            "common.newOffer": "新しいオファー",
            "common.viewOffer": "オファーを表示",
            "common.editOffer": "オファーを編集",
            "common.offerName": "オファー名",
            "common.priceModel": "価格モデル",
            "common.perSeat": "シート単位",
            "common.flatRate": "定額",
            "common.planName": "プラン名",
            "common.billingTerm": "請求期間",
            "common.price": "価格",
            "common.oneMonth": "1 か月",
            "common.oneYear": "1 年",
            "common.offerCentral": "オファーセンター",
            "common.publisherIdPrefix": "パブリッシャー ID: ",
            "action.changeQuantity": "数量変更",
            "action.changePlan": "プラン変更",
            "action.suspend": "一時停止",
            "action.reinstate": "再開",
            "action.unsubscribe": "解約",
            "action.renew": "更新",
            "action.detail": "詳細",
            "action.state": "状態",
            "action.changeQuantityWebhook": "数量変更",
            "action.changePlanWebhook": "プラン変更",
            "status.PendingFulfillmentStart": "フルフィルメント開始待ち",
            "status.Subscribed": "有効",
            "status.Suspended": "一時停止中",
            "status.Unsubscribed": "解約済み",
            "notify.subscriptionUpdated": "サブスクリプションが更新されました",
            "notify.resolve": "/resolve",
            "notify.activate": "/activate",
            "offerTile.plansStartAt": "プランは次の価格から",
            "offerTile.perUser": "ユーザー/",
            "offerTile.month": "月",
            "offerTile.year": "年",
            "index.infoHtml": "<p>このエミュレーターは Microsoft 役です。実際のマーケットプレース取引なしに、購入とサブスクリプションのライフサイクル全体を動かせます。どのステップがどこで起きるかは上の地図のとおりです。</p><p>サンプルオファーは2つ（<em>flat-rate</em> と <em>per-user</em>）で、それぞれサンプルプランを含みます。API リファレンス: <a href=\"https://learn.microsoft.com/ja-jp/partner-center/marketplace-offers/pc-saas-fulfillment-subscription-api\" target=\"_blank\" rel=\"noopener\">SaaS fulfillment Subscription APIs v2</a>。</p>",
            "index.sampleMarketplaceBehaviour": "サンプル マーケットプレースの動作",
            "index.noOffersHtml": "オファーが設定されておらず、サンプル オファーも無効です。<br /><a href=\"/offers.html\">オファーセンター</a>で作成してください",
            "index.placeholderHtml": "左側のオファーで「今すぐ入手」をクリックし、<br/>購入内容を設定してください",
            "index.configurePurchase": "購入の設定",
            "index.profileInfo": "このアプリには基本的なプロフィール情報が必要です。開始しやすいように Microsoft アカウントのデータを取得しています。Azure Marketplace は次回のために情報を保存します。",
            "index.beneficiaryObjectId": "受益者オブジェクト ID",
            "index.beneficiaryTenantId": "受益者テナント ID",
            "index.optionalRealUser": "実在のユーザーによる購入をシミュレートするには、その AAD オブジェクト ID とテナント ID を以下に入力してください。",
            "index.optionalPurchaser": "別の実在ユーザーの代理として実在ユーザーが購入するシナリオをシミュレートするには、「購入者を指定」をオンにし、その AAD オブジェクト ID とテナント ID を以下に入力してください。",
            "index.specifyPurchaser": "購入者を指定",
            "index.purchaserEmail": "購入者メール",
            "index.purchaserObjectId": "購入者オブジェクト ID",
            "index.purchaserTenantId": "購入者テナント ID",
            "index.termsHtml": "必要に応じて、上記で追加情報を収集してください。<br />続行するには、ユーザーがここで使用条件とプライバシー ポリシーにも同意する必要があります。",
            "index.configError": "エミュレーターから設定を取得中に問題が発生しました",
            "index.noLandingPageUrl": "設定にランディングページ URL が設定されていません",
            "index.remoteLandingConfirmHtml": "ランディングページは localhost に設定されていますが、エミュレーターはリモート ホストで実行されているようです。ランディングページ URL が正しいことを確認してください。設定ページで確認できます。<br /><br />続行しますか?",
            "landing.withTokenHtml": "<p>これはエミュレーターに組み込まれているランディングページです。すぐに動作を確認できるようにした、とてもシンプルな実装です。</p><p>ランディングページは、マーケットプレースから渡された購入トークンを解決（デコード）します。</p><p>トークンには購入の詳細が含まれており、右側の項目に反映されます。</p><p>オンボーディング前に顧客から追加情報を収集する場所でもあります。</p><p>表示されているサブスクリプションを有効化するには、「サブスクリプションを有効化」ボタンをクリックします。</p>",
            "landing.noTokenInfoHtml": "<p>これはエミュレーターに組み込まれているランディングページです。すぐに動作を確認できるようにした、とてもシンプルな実装です。</p><p>動作させるには、クエリ文字列で購入トークンを渡す必要があります。</p><ul><li><a href=\"/\">マーケットプレース ページ</a>に戻ります</li><li>トークンを生成します</li><li>購入内容を設定します</li></ul>",
            "landing.configureSubscription": "サブスクリプションの設定",
            "landing.noTokenHtml": "URL にマーケットプレース トークンが含まれていません。<br /><a href=\"/\">マーケットプレース ページ</a>に移動してオファーを購入してください。",
            "landing.marketplaceSso": "コマーシャル マーケットプレースでは、このページで AAD SSO を有効にする必要があります。解決されたトークンとユーザー ID が一致することを確認してください。必要に応じて、オンボーディング用に顧客から追加情報（以下の例など）を収集できます。",
            "subs.workflow": "サブスクリプション ワークフロー",
            "subs.infoHtml": "<p>前のページのマーケットプレース トークンを使用して API で作成されたサブスクリプションが、下に一覧表示されます。</p><p>アクションは、サブスクリプションの状態で実行可能なものに限定されます。</p><p>一時停止中のサブスクリプションは再開できますが、解約済みのサブスクリプションはその状態で固定され、再サブスクライブできません。</p><p>Webhook URL は標準のコンテナー設定に設定されています。別の URL / ポートで実行している場合は、Webhook を有効にするために更新してください。</p>",
            "subs.testWebhookActions": "サブスクリプション: Webhook アクションのテスト",
            "subs.col.subscriptionId": "サブスクリプション ID",
            "subs.col.name": "名前",
            "subs.col.offer": "オファー",
            "subs.col.plan": "プラン",
            "subs.col.qty": "数量",
            "subs.missingOffer": "このサブスクリプションに関連付けられているオファーは読み込まれていないか、削除されています。",
            "subs.buttonColourKeyHtml": "ボタン色の凡例 - サブスクリプションを変更するアクションをエミュレートします <button class=\"detail\" disabled=\"disabled\">詳細</button> <button class=\"state\" disabled=\"disabled\">状態</button>",
            "subs.renewNote": "更新: HTTP 応答は表示されますが、このページには変更はありません。",
            "subs.howManyLicenses": "ライセンス数を入力してください",
            "subs.changePlanTo": "変更先のプランを選択してください",
            "subs.deleteConfirmHtml": "サブスクリプションの削除は元に戻せません。<br /> <br />続行してもよろしいですか?",
            "subs.deleteTitle": "サブスクリプションの削除",
            "subs.noOtherPlans": "このオファーには他のプランが定義されていません",
            "offers.infoHtml": "<p><strong>オファーセンター</strong>では、エミュレーターで使用するオファーを表示、編集、作成できます。</p><p><strong>注意点:</strong></p><ul><li>オファー ID は一意である必要があります。エミュレーターは Partner Center の動作を再現できます。</li><li>エミュレーターでは、基本的なオファーとプランの詳細のみを使用し、すべての範囲は扱いません。</li><li>簡素化のため、プランには請求パラメーターが 1 つだけあります（以下を参照）。</li><li>既存のオファーを新しいオファーのテンプレートとして複製できます。</li><li>エミュレーターに含まれるサンプル オファーは編集できません。</li><li>使用中のオファーは削除できません。</li><li>通貨は USD のみです。</li></ul><p><strong>Partner Center では</strong>、M365 を例にすると、オファー &gt; プラン &gt; 請求を構成します。</p><ul><li>オファー: 製品（例: M365）</li><li>プラン: 特定の機能セット（例: E3、ユーザー単位）</li><li>請求: 価格設定（例: 月単位、年単位）</li></ul><p><strong>エミュレーターでは</strong>、現在、プランと請求の要素は 1 つの項目です。<strong>必要に応じてプランを作成し、そのプランに 1 つの請求メトリックを追加してください。</strong></p>",
            "offers.offerIdExists": "オファー ID は既に存在します",
            "offers.planIdExists": "プラン ID は既に存在します",
            "offers.deleteConfirmHtml": "オファーの削除は元に戻せません。<br /><br />続行してもよろしいですか?",
            "offers.deleteTitle": "オファーの削除",
            "offers.unableDelete": "オファーを削除できません。サブスクリプションに関連付けられている可能性があります。",
            "offers.copySuffix": " のコピー",
            "config.warningHtml": "<p>このフォームでは、エミュレーターの環境変数を更新できます。テスト結果をゆがめる予期しないエミュレーター動作を避けるため、更新前に変数の<strong>影響範囲を理解してください</strong>。</p><p>注: \"Landing Page URL\" の既定値は、エミュレーターをローカルで実行していることを前提としています。リモート ホスト（Azure Container Images など）でエミュレーターを実行している場合は、ランディングページ URL をリモート ホストの IP アドレスまたは FQDN に更新してください。</p>",
            "config.summary": "このページで設定を変更しても、エミュレーターが再起動されるまでの間だけ値が保存されます。新しい値でエミュレーターを実行するには、起動時に該当する環境変数を設定してください。",
            "config.webhookLanding": "Webhook とランディングページ",
            "config.webhookLandingSummary": "Partner Center でオファーを作成する際には、Webhook とランディングページが必要です。",
            "config.webhookUrl": "Webhook URL",
            "config.landingPageUrl": "ランディングページ URL",
            "config.emulatorBehaviour": "エミュレーターの動作",
            "config.emulatorBehaviourSummary": "このセクションでは、タイムアウト、遅延など、エミュレーターの動作を制御します。",
            "config.operationTimeout": "操作タイムアウト (ms)",
            "config.subscriptionUpdateDelay": "サブスクリプション更新遅延 (ms)",
            "config.webhookCallDelay": "Webhook 呼び出し遅延 (ms)",
            "config.webhookCallPatchDelay": "Webhook 呼び出し PATCH 遅延 (ms)",
            "config.requireMarketplaceAuthToken": "マーケットプレース認証トークンを要求",
            "config.showRawConfig": "未加工の設定を表示",
            "config.dangerZone": "危険な操作",
            "config.clearDataFile": "データ ファイルをクリア",
            "config.clear": "クリア",
            "config.changeConfirmHtml": "<p>この変更は適用されますが永続化されず、エミュレーターを再起動すると失われます。この新しい値でエミュレーターを起動するには、次の環境変数を使用してください:</p><pre>{env} = {val}</pre><p>続行しますか?</p>",
            "config.changeTitle": "設定の変更",
            "config.updateFailedHtml": "<p>設定の更新に失敗しました</p><p class=\"error\">{error}</p>",
            "config.rawTitle": "設定",
            "config.clearConfirmHtml": "データ ファイルをクリアすると、すべてのカスタム オファーとサブスクリプションが削除され、元に戻せません。<br /><br />続行してもよろしいですか?",
            "config.clearTitle": "データのクリア"
        }
    };

    function i18nLang() {
        const stored = localStorage.getItem('emu-lang');
        if (stored === 'en' || stored === 'ja') {
            return stored;
        }
        return ((navigator.language || '').toLowerCase().indexOf('ja') === 0) ? 'ja' : 'en';
    }

    function t(key) {
        const lang = i18nLang();
        return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
    }

    function formatI18n(key, values) {
        return t(key).replace(/\{([^}]+)\}/g, function (_, name) {
            return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : '{' + name + '}';
        });
    }

    function applyI18n(root) {
        root = root || document;
        const $root = $(root);
        $root.find('[data-i18n]').addBack('[data-i18n]').each(function () {
            this.textContent = t(this.getAttribute('data-i18n'));
        });
        $root.find('[data-i18n-html]').addBack('[data-i18n-html]').each(function () {
            this.innerHTML = t(this.getAttribute('data-i18n-html'));
        });
        $root.find('[data-i18n-attr]').addBack('[data-i18n-attr]').each(function () {
            const el = this;
            const pairs = el.getAttribute('data-i18n-attr').split(';');
            pairs.forEach(function (pair) {
                const parts = pair.split(':');
                if (parts.length === 2) {
                    el.setAttribute(parts[0], t(parts[1]));
                }
            });
        });
    }

    function injectLanguageToggle() {
        const nav = document.querySelector('nav ul');
        if (!nav || nav.querySelector('li.lang')) {
            return;
        }

        const li = document.createElement('li');
        li.className = 'lang';
        li.innerHTML = '<a href="#" data-lang="en">EN</a><a href="#" data-lang="ja">日本語</a>';
        nav.appendChild(li);

        const lang = i18nLang();
        Array.prototype.forEach.call(li.querySelectorAll('a'), function (a) {
            if (a.getAttribute('data-lang') === lang) {
                a.className = 'active-lang';
            }
            a.addEventListener('click', function (e) {
                e.preventDefault();
                localStorage.setItem('emu-lang', a.getAttribute('data-lang'));
                location.reload();
            });
        });
    }

    let readyDone = false;
    function ready() {
        if (readyDone) {
            return;
        }
        readyDone = true;
        document.documentElement.lang = i18nLang();
        applyI18n(document);
        injectLanguageToggle();
    }

    window.I18N = I18N;
    window.t = t;
    window.formatI18n = formatI18n;
    window.applyI18n = applyI18n;
    window.i18nLang = i18nLang;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ready);
    } else {
        ready();
    }
    if (window.jQuery) {
        $(ready);
    }
}());
