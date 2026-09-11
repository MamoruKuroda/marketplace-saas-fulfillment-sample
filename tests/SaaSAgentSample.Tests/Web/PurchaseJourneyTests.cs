using System.Net;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using SaaSAgentSample.Core.Subscriptions;
using SaaSAgentSample.Fulfillment;
using SaaSAgentSample.Fulfillment.Models;
using SaaSAgentSample.Tests.L2;
using SaaSAgentSample.Tests.LandingTests;
using SaaSAgentSample.Web;

namespace SaaSAgentSample.Tests.Web;

public class PurchaseJourneyTests
{
    [Theory]
    [InlineData("web-card")]
    [InlineData("web-azure")]
    [InlineData("azure-portal")]
    public void Only_known_scenarios_are_carried(string scenario)
    {
        var link = DemoNavigation.WithScenario("/admin?other=value#how", scenario);
        Assert.Equal(scenario, DemoNavigation.PurchaseScenario(scenario));
        Assert.Contains("scenario=" + scenario, link);
        Assert.Contains("other=value", link);
        Assert.EndsWith("#how", link);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("WEB-CARD")]
    [InlineData("approved")]
    [InlineData("web-card&role=owner")]
    public void Unknown_scenarios_cannot_become_purchase_claims(string? scenario)
    {
        Assert.Null(DemoNavigation.PurchaseScenario(scenario));
        Assert.Equal("/admin", DemoNavigation.WithScenario("/admin?scenario=old", scenario));
    }

    [Fact]
    public void Switching_culture_preserves_token_scenario_and_fragment()
    {
        var url = DemoNavigation.WithCulture(
            "/?token=a%2Bb%2Fc%3D&scenario=web-card&culture=ja&ui-culture=ja#how", "en");
        var query = QueryHelpers.ParseQuery(new Uri("https://example.test" + url).Query);
        Assert.Equal("a+b/c=", query["token"].ToString());
        Assert.Equal("web-card", query["scenario"].ToString());
        Assert.Equal("en", query["culture"].ToString());
        Assert.False(query.ContainsKey("ui-culture"));
        Assert.EndsWith("#how", url);
    }

    [Fact]
    public void Real_marketplace_has_no_emulator_entry_link()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?> { ["Fulfillment:BaseUrl"] = "https://marketplaceapi.microsoft.com/api" })
            .Build();
        Assert.Null(DemoNavigation.EmulatorLink(config, DemoNavigation.PurchaseEntryPath, "web-card"));
    }

    [Theory]
    [InlineData("web-card", "en")]
    [InlineData("web-card", "ja")]
    [InlineData("web-azure", "en")]
    [InlineData("web-azure", "ja")]
    [InlineData("azure-portal", "en")]
    [InlineData("azure-portal", "ja")]
    public async Task Every_scenario_reaches_the_same_activation_form(string scenario, string culture)
    {
        var fake = Fulfillment("PendingFulfillmentStart");
        using var source = new L2AppFactory("http://127.0.0.1:1/api");
        using var app = CreateApp(source, fake);
        using var client = app.CreateClient();
        var html = await client.GetStringAsync($"/?token=demo&scenario={scenario}&culture={culture}");

        Assert.Contains($"<html lang=\"{culture}\">", html);
        Assert.Contains("class=\"purchase-arrival\"", html);
        Assert.Contains("name=\"__RequestVerificationToken\"", html);
        Assert.Contains("name=\"subscriptionId\" value=\"journey-sub\"", html);
        Assert.Contains("name=\"planId\" value=\"purchased-plan\"", html);
        Assert.Contains($"start.html?culture={culture}&amp;scenario={scenario}", html);
        Assert.Contains(culture == "ja" ? "購入経路の例" : "Illustrative purchase route", html);
        AssertCompactLanding(html, culture);
        Assert.Equal(0, fake.ActivateCallCount);
    }

    [Theory]
    [InlineData("en")]
    [InlineData("ja")]
    public async Task Landing_without_scenario_keeps_the_same_compact_confirmation(string culture)
    {
        var fake = Fulfillment("PendingFulfillmentStart");
        using var source = new L2AppFactory("http://127.0.0.1:1/api");
        using var app = CreateApp(source, fake);
        using var client = app.CreateClient();
        var html = await client.GetStringAsync($"/?token=demo&culture={culture}");
        AssertCompactLanding(html, culture);
        Assert.DoesNotContain("class=\"purchase-arrival\"", html);
        Assert.DoesNotContain("class=\"purchase-route-details\"", html);
        Assert.Contains("name=\"subscriptionId\" value=\"journey-sub\"", html);
        Assert.Equal(0, fake.ActivateCallCount);
    }

    [Fact]
    public async Task Activation_preserves_real_plan_and_context()
    {
        var fake = Fulfillment("PendingFulfillmentStart");
        using var source = new L2AppFactory("http://127.0.0.1:1/api");
        using var app = CreateApp(source, fake);
        using var client = app.CreateClient();
        const string url = "/?token=demo&scenario=web-azure&culture=en";
        var html = await client.GetStringAsync(url);
        var csrf = Regex.Match(html, "name=\"__RequestVerificationToken\"[^>]*value=\"([^\"]+)\"").Groups[1].Value;
        Assert.NotEmpty(csrf);
        using var response = await client.PostAsync(url, new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["__RequestVerificationToken"] = WebUtility.HtmlDecode(csrf),
            ["subscriptionId"] = "journey-sub",
            ["planId"] = "purchased-plan",
            ["quantity"] = "1",
        }));
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadAsStringAsync();
        Assert.Contains("Activated.", result);
        Assert.Contains("/admin?scenario=web-azure", result);
        Assert.Equal(1, fake.ActivateCallCount);
        using var scope = app.Services.CreateScope();
        var record = await scope.ServiceProvider.GetRequiredService<ISubscriptionRepository>()
            .GetByMarketplaceSubscriptionIdAsync("journey-sub");
        Assert.Equal("purchased-plan", record!.PlanId);
        Assert.Equal(SubscriptionState.Subscribed, record.State);
        var decoded = WebUtility.HtmlDecode(result);
        var resultBanner = Regex.Match(decoded, "<div class=\"banner buyer-result\".*?</div>\\s*</div>", RegexOptions.Singleline).Value;
        Assert.NotEmpty(resultBanner);
        Assert.DoesNotContain("<a ", resultBanner);
        Assert.DoesNotContain("role switch", resultBanner, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("This completes the buyer walkthrough.", resultBanner);
        Assert.Contains($"href=\"/admin/{record.Id}?scenario=web-azure&culture=en\"", decoded);
        Assert.Contains("id=\"behind-scenes\"", decoded);
        Assert.Contains("class=\"kv saved-result\"", decoded);
    }

    [Theory]
    [InlineData("en")]
    [InlineData("ja")]
    public async Task Active_return_is_labelled_without_activating_again(string culture)
    {
        var fake = Fulfillment("Subscribed");
        using var source = new L2AppFactory("http://127.0.0.1:1/api");
        using var app = CreateApp(source, fake);
        using var client = app.CreateClient();
        var html = await client.GetStringAsync($"/?token=demo&scenario=web-card&culture={culture}");
        Assert.Contains(culture == "ja" ? "有効化済みの契約に戻る" : "Return to your subscription", html);
        Assert.DoesNotContain("name=\"subscriptionId\"", html);
        Assert.DoesNotContain("class=\"substeps\"", html);
        Assert.Contains("id=\"how\"", html);
        Assert.Equal(0, fake.ActivateCallCount);
    }

    [Fact]
    public async Task Home_links_to_entry_and_does_not_claim_a_purchase()
    {
        using var source = new L2AppFactory("http://127.0.0.1:1/api");
        using var app = CreateApp(source, Fulfillment("PendingFulfillmentStart"));
        using var client = app.CreateClient();
        var html = await client.GetStringAsync("/?scenario=web-card&culture=en");
        Assert.Contains("https://emulator.example.test/start.html?culture=en&amp;scenario=web-card", html);
        Assert.DoesNotContain("class=\"purchase-arrival\"", html);
        Assert.DoesNotContain("class=\"purchase-permissions\"", html);
        AssertImplementationGuide(html, "en");
    }

    [Fact]
    public async Task Forged_scenario_is_not_rendered_and_does_not_skip_activation()
    {
        var fake = Fulfillment("PendingFulfillmentStart");
        using var source = new L2AppFactory("http://127.0.0.1:1/api");
        using var app = CreateApp(source, fake);
        using var client = app.CreateClient();
        var html = await client.GetStringAsync("/?token=demo&scenario=approved&culture=en");
        Assert.DoesNotContain("class=\"purchase-arrival\"", html);
        Assert.Contains("name=\"subscriptionId\" value=\"journey-sub\"", html);
        Assert.Equal(0, fake.ActivateCallCount);
    }

    [Fact]
    public async Task Toggle_overrides_arrival_query_and_keeps_scenario()
    {
        using var source = new L2AppFactory("http://127.0.0.1:1/api");
        using var app = CreateApp(source, Fulfillment("PendingFulfillmentStart"));
        using var client = app.CreateClient();
        var html = await client.GetStringAsync("/?culture=ja&scenario=web-card");
        var href = Regex.Match(html, "href=\"(/set-culture\\?culture=en[^\\\"]+)\"").Groups[1].Value;
        Assert.NotEmpty(href);
        var switched = await client.GetStringAsync(WebUtility.HtmlDecode(href));
        Assert.Contains("<html lang=\"en\">", switched);
        Assert.Contains("start.html?culture=en&amp;scenario=web-card", switched);
    }

    [Fact]
    public async Task Navigation_preserves_query_culture_without_a_language_cookie()
    {
        using var source = new L2AppFactory("http://127.0.0.1:1/api");
        using var app = CreateApp(source, Fulfillment("PendingFulfillmentStart"));
        using var client = app.CreateClient();
        client.DefaultRequestHeaders.AcceptLanguage.ParseAdd("en");
        var landing = await client.GetStringAsync("/?token=demo&culture=ja&scenario=web-azure");
        var adminLink = WebUtility.HtmlDecode(Regex.Match(landing, "href=\"(/admin[^\\\"]*)\"").Groups[1].Value);
        Assert.Contains("culture=ja", adminLink);
        var list = await client.GetStringAsync(adminLink);
        Assert.Contains("<html lang=\"ja\">", list);
        var detailLink = WebUtility.HtmlDecode(Regex.Match(list, "href=\"(/admin/[0-9a-f-]+[^\\\"]*)\"").Groups[1].Value);
        Assert.Contains("culture=ja", detailLink);
        Assert.Contains("scenario=web-azure", detailLink);
        var detail = await client.GetStringAsync(detailLink);
        Assert.Contains("<html lang=\"ja\">", detail);
        Assert.Contains("action=\"?handler=Activate&amp;scenario=web-azure&amp;culture=ja\"", detail);
    }

    [Theory]
    [InlineData("ja")]
    [InlineData("en")]
    public async Task Buyer_and_operations_have_distinct_responsibility_headers(string culture)
    {
        var fake = Fulfillment("PendingFulfillmentStart");
        using var source = new L2AppFactory("http://127.0.0.1:1/api");
        using var app = CreateApp(source, fake);
        using var client = app.CreateClient();
        var buyer = WebUtility.HtmlDecode(await client.GetStringAsync($"/?token=private-demo-token&culture={culture}"));
        var admin = WebUtility.HtmlDecode(await client.GetStringAsync($"/admin?culture={culture}"));
        Assert.Contains("class=\"partner-page area-buyer\"", buyer);
        Assert.Contains("class=\"partner-page area-operations\"", admin);
        var buyerHeader = Regex.Match(buyer, "<header class=\"site-header\">.*?</header>", RegexOptions.Singleline).Value;
        var adminHeader = Regex.Match(admin, "<header class=\"site-header\">.*?</header>", RegexOptions.Singleline).Value;
        Assert.Contains(culture == "ja" ? "パートナー企業のサイト / 購入者向け" : "Partner company site / for buyers", buyerHeader);
        Assert.Contains(culture == "ja" ? "パートナー企業（SaaS提供者）" : "Partner company (SaaS publisher)", buyerHeader);
        Assert.Contains(culture == "ja" ? "運用担当者向け" : "for operators", adminHeader);
        Assert.Contains(culture == "ja" ? "パートナー企業が実装する運用管理画面の例" : "Example operations UI implemented by the partner company", adminHeader);
        var implementationNote = culture == "ja" ? "この管理UIは任意で、既存の管理機能でも構いません" : "This management UI is optional and can reuse existing tools";
        Assert.DoesNotContain(implementationNote, admin);
        Assert.Contains("<caption class=\"data-source\">", admin);
        var detailLink = Regex.Match(admin, "href=\"(/admin/[0-9a-f-]+[^\\\"]*)\"").Groups[1].Value;
        Assert.NotEmpty(detailLink);
        var detail = WebUtility.HtmlDecode(await client.GetStringAsync(detailLink));
        Assert.DoesNotContain(implementationNote, detail);
        Assert.Contains(culture == "ja" ? "表示元：パートナー企業の契約DB" : "Source: partner contract DB", detail);
        Assert.DoesNotContain("href=\"/admin", buyerHeader);
        Assert.DoesNotContain("class=\"top\"", buyer);
        Assert.Contains("class=\"demo-role-switch\"", buyer);
        Assert.Contains(culture == "ja" ? "説明用の役割切替" : "Demonstration role switch", buyer);
        Assert.Contains(culture == "ja" ? "アクセス権の付与や認証の変更は行いません" : "does not grant access or change authentication", buyer);
        Assert.Contains(culture == "ja" ? "未到着の通知は判定できません" : "cannot detect notifications still in transit", detail);
        var guide = Regex.Match(buyer, "<div class=\"orient-bar.*?</nav>", RegexOptions.Singleline).Value;
        Assert.DoesNotContain("private-demo-token", guide);
        Assert.DoesNotContain("自社", buyer);
        Assert.DoesNotContain("自社", admin);
        AssertImplementationGuide(buyer, culture);
        AssertImplementationGuide(admin, culture);
        AssertImplementationGuide(detail, culture);
        Assert.Equal(0, fake.ActivateCallCount);
    }

    [Theory]
    [InlineData("en")]
    [InlineData("ja")]
    public async Task Responsibility_overview_separates_screens_backend_and_both_stores(string culture)
    {
        using var source = new L2AppFactory("http://127.0.0.1:1/api");
        using var app = CreateApp(source, Fulfillment("PendingFulfillmentStart"));
        using var client = app.CreateClient();
        var home = WebUtility.HtmlDecode(await client.GetStringAsync($"/?culture={culture}"));
        Assert.Contains("id=\"boundary\"", home);
        Assert.Contains("<details class=\"explainer learn\" id=\"boundary\">", home);
        var main = home[home.IndexOf("<main ", StringComparison.Ordinal)..];
        var primary = main[..main.IndexOf("<details", StringComparison.Ordinal)];
        Assert.Contains(culture == "ja" ? "購入体験を始める" : "Start the purchase experience", primary);
        Assert.DoesNotContain("responsibility-map", primary);
        Assert.DoesNotContain("<select", primary);
        Assert.Single(Regex.Matches(home, "class=\"demo-notice\""));
        foreach (var marker in new[] { "microsoft-side", "partner-side", "screen-node", "server-node", "database-node", "service-node", "boundary-flows" })
            Assert.Contains(marker, home);
        Assert.Contains(culture == "ja" ? "製品の利用制御は本サンプルの範囲外" : "Product access enforcement is outside this sample", home);
        Assert.Contains(culture == "ja" ? "2つの状態ストアは別物" : "The two stores are separate", home);
        Assert.Contains(culture == "ja" ? "パートナー企業が実装" : "Partner company implements", home);
        AssertImplementationGuide(home, culture);
    }

    [Theory]
    [InlineData("en")]
    [InlineData("ja")]
    public async Task Selected_contract_filter_is_exact_and_reload_preserves_it(string culture)
    {
        using var source = new L2AppFactory("http://127.0.0.1:1/api");
        var fake = Fulfillment("PendingFulfillmentStart");
        using var app = CreateApp(source, fake);
        using var client = app.CreateClient();
        await client.GetStringAsync("/?token=demo");
        using (var scope = app.Services.CreateScope())
        {
            var repository = scope.ServiceProvider.GetRequiredService<ISubscriptionRepository>();
            await repository.AddAsync(new Subscription(Guid.NewGuid(), "unrelated-sub", "other-offer", "other-plan", DateTimeOffset.UtcNow));
            await repository.SaveChangesAsync();
        }
        var selected = WebUtility.HtmlDecode(await client.GetStringAsync($"/admin?marketplaceSubscriptionId=journey-sub&scenario=web-card&culture={culture}"));
        Assert.Contains("journey-sub", selected);
        Assert.DoesNotContain("unrelated-sub", selected);
        Assert.Contains($"href=\"/admin?marketplaceSubscriptionId=journey-sub&scenario=web-card&culture={culture}\"", selected);
        var detailPath = Regex.Match(selected, "href=\"(/admin/[0-9a-f-]+[^\\\"]*)\"").Groups[1].Value;
        var detail = WebUtility.HtmlDecode(await client.GetStringAsync(detailPath));
        Assert.Contains($"subscriptions.html?culture={culture}&scenario=web-card&subscriptionId=journey-sub", detail);
        Assert.Contains("class=\"reload-record\" method=\"get\"", detail);
        var refresh = Regex.Match(detail, "name=\"refresh\" value=\"([0-9a-f]+)\"").Groups[1].Value;
        Assert.NotEmpty(refresh);
        var reloaded = WebUtility.HtmlDecode(await client.GetStringAsync(detailPath));
        Assert.DoesNotContain($"name=\"refresh\" value=\"{refresh}\"", reloaded);
        Assert.Contains($"name=\"culture\" value=\"{culture}\"", detail);
        Assert.Contains("name=\"scenario\" value=\"web-card\"", detail);
        foreach (var invalid in new[] { "journey", "JOURNEY-SUB", "<script>bad</script>" })
        {
            var missing = WebUtility.HtmlDecode(await client.GetStringAsync($"/admin?marketplaceSubscriptionId={Uri.EscapeDataString(invalid)}&culture={culture}"));
            Assert.DoesNotContain("<tbody>", missing);
            Assert.Contains(culture == "ja" ? "保存記録は見つかりませんでした" : "No saved partner record was found", missing);
        }
        Assert.Equal(0, fake.ActivateCallCount);
    }

    [Fact]
    public async Task Active_return_does_not_fabricate_the_partner_state()
    {
        using var source = new L2AppFactory("http://127.0.0.1:1/api");
        using var app = CreateApp(source, Fulfillment("Subscribed"));
        using var client = app.CreateClient();
        var html = WebUtility.HtmlDecode(await client.GetStringAsync("/?token=demo&culture=en"));
        Assert.Contains("Already active.", html);
        var saved = Regex.Match(html, "<dl class=\"kv saved-result\">.*?</dl>", RegexOptions.Singleline).Value;
        Assert.Contains("PendingFulfillmentStart", saved); // Existing resolve storage behavior, not a claimed sync.
        Assert.DoesNotContain("Subscribed", saved);
    }

    [Fact]
    public async Task Plan_comparison_uses_only_recorded_plan_values()
    {
        using var source = new L2AppFactory("http://127.0.0.1:1/api");
        using var app = CreateApp(source, Fulfillment("PendingFulfillmentStart"));
        using var client = app.CreateClient();
        var id = Guid.NewGuid();
        using (var scope = app.Services.CreateScope())
        {
            var repository = scope.ServiceProvider.GetRequiredService<ISubscriptionRepository>();
            await repository.AddAsync(new Subscription(id, "history-only", "offer", "current-not-history", DateTimeOffset.UtcNow));
            var events = scope.ServiceProvider.GetRequiredService<ISubscriptionEventLog>();
            events.Record("history-only", SubscriptionEventSource.Webhook, "ChangePlan", "recorded-new-plan");
            await repository.SaveChangesAsync();
        }
        var html = WebUtility.HtmlDecode(await client.GetStringAsync($"/admin/{id}?culture=en"));
        var comparison = Regex.Match(html, "<div class=\"recorded-plan-changes.*?</div>", RegexOptions.Singleline).Value;
        Assert.Contains("Not recorded", comparison);
        Assert.Contains("recorded-new-plan", comparison);
        Assert.DoesNotContain("current-not-history", comparison);
    }

    [Fact]
    public void Teaching_roles_do_not_remove_the_configured_authentication_requirement()
    {
        using var source = new L2AppFactory("http://127.0.0.1:1/api");
        using var app = source.WithWebHostBuilder(builder => builder
            .UseSetting("Landing:RequireAuthentication", "true")
            .UseSetting("AzureAd:Instance", "https://login.microsoftonline.com/")
            .UseSetting("AzureAd:TenantId", "common")
            .UseSetting("AzureAd:ClientId", "00000000-0000-0000-0000-000000000001"));
        var policy = app.Services.GetRequiredService<IOptions<AuthorizationOptions>>().Value.FallbackPolicy;
        Assert.NotNull(policy);
        Assert.Contains(policy.Requirements, requirement => requirement is DenyAnonymousAuthorizationRequirement);
    }

    private static FakeFulfillmentClient Fulfillment(string status) => new(new ResolvedSubscription
    {
        Id = "journey-sub",
        SubscriptionName = "Purchase journey",
        OfferId = "sample-service",
        PlanId = "purchased-plan",
        Quantity = 1,
        Subscription = new FulfillmentSubscription
        {
            Id = "journey-sub",
            PlanId = "purchased-plan",
            SaasSubscriptionStatus = status,
        },
    });

    private static void AssertCompactLanding(string html, string culture)
    {
        html = WebUtility.HtmlDecode(html);
        var main = html.IndexOf("<main ", StringComparison.Ordinal);
        var boundary = html.IndexOf("<details class=\"explainer learn\" id=\"boundary\">", StringComparison.Ordinal);
        Assert.True(main >= 0 && boundary > main);
        var primary = html[main..boundary];
        var progress = Regex.Match(primary, "<ol class=\"substeps\".*?</ol>", RegexOptions.Singleline).Value;
        Assert.NotEmpty(progress);
        Assert.Equal(3, Regex.Matches(progress, "<li\\b").Count);
        Assert.DoesNotContain("<p", progress);
        Assert.Contains("aria-current=\"step\"", progress);
        Assert.Contains(culture == "ja" ? "未サインイン" : "Not signed in", progress);
        Assert.Contains(culture == "ja" ? "契約確認: 完了" : "Purchase details: Completed", progress);
        Assert.Contains("class=\"card activation-card\"", primary);
        Assert.Contains(culture == "ja" ? "既存ユーザー／顧客企業ID" : "existing user or customer-company ID", primary);
        Assert.Contains("type=\"submit\"", primary);
        Assert.DoesNotContain("purchase-route-details", primary);
        var routeNotice = culture == "ja" ? "経路の表示は、決済や権限" : "The route label does not verify";
        Assert.DoesNotContain(routeNotice, primary);
        foreach (var text in culture == "ja"
            ? new[] { "ブラウザーで開く必要", "Entra シングル サインオン", "購入トークンを契約情報に交換", "オファーを自動有効化" }
            : new[] { "Only this one screen", "Entra single sign-on", "The purchase token is exchanged",
                "Offers can also auto-activate" })
        {
            Assert.DoesNotContain(text, primary);
        }
        AssertImplementationGuide(html, culture);
    }

    private static void AssertImplementationGuide(string html, string culture)
    {
        var links = Regex.Matches(html, "<a class=\"implementation-guide\"[^>]*>");
        Assert.Single(links);
        var href = WebUtility.HtmlDecode(Regex.Match(links[0].Value, "href=\"([^\"]+)\"").Groups[1].Value);
        Assert.Equal("https://github.com/MamoruKuroda/marketplace-saas-fulfillment-sample/blob/main/docs/" +
            (culture == "ja" ? "walkthrough.ja.md" : "walkthrough.md"), href);
        Assert.Contains("target=\"_blank\"", links[0].Value);
        Assert.Contains("rel=\"noopener noreferrer\"", links[0].Value);
        Assert.DoesNotContain("data-learning-focus", html);
        Assert.DoesNotContain("class=\"implementation-details\"", html);
        Assert.DoesNotContain("class=\"glossary\"", html);
        Assert.DoesNotContain("<details class=\"explainer learn\" id=\"how\">", html);
    }

    private static WebApplicationFactory<Program> CreateApp(L2AppFactory source, FakeFulfillmentClient fake)
        => source.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(
                new Dictionary<string, string?> { ["Demo:EmulatorUrl"] = "https://emulator.example.test" }));
            builder.ConfigureTestServices(services => services.AddSingleton<IFulfillmentClient>(fake));
        });
}
