using System.Net;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
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
        Assert.Contains("Purchase routes and permissions", html);
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

    private static WebApplicationFactory<Program> CreateApp(L2AppFactory source, FakeFulfillmentClient fake)
        => source.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(
                new Dictionary<string, string?> { ["Demo:EmulatorUrl"] = "https://emulator.example.test" }));
            builder.ConfigureTestServices(services => services.AddSingleton<IFulfillmentClient>(fake));
        });
}
