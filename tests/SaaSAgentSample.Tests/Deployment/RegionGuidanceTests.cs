using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using DeploymentPreflight;

namespace SaaSAgentSample.Tests.Deployment;

public sealed class RegionGuidanceTests
{
    private static readonly Region Japan = new("japaneast", "Japan East", "Japan", true);
    private static readonly Region US = new("eastus", "East US", "United States", true);
    private const string SubId = "11111111-1111-1111-1111-111111111111";
    private const string TenantId = "22222222-2222-2222-2222-222222222222";
    private const string PrincipalId = "33333333-3333-3333-3333-333333333333";

    private const string Template = """
        {
          "parameters": {
            "environmentName": {"type":"string"},
            "location": {"type":"string"},
            "principalId": {"type":"string"},
            "principalType": {"type":"string"},
            "requireAuthentication": {"type":"bool"}
          },
          "resources": [
            {
              "type":"Microsoft.Resources/resourceGroups", "apiVersion":"2024-03-01",
              "name":"[format('rg-{0}', parameters('environmentName'))]", "location":"[parameters('location')]"
            },
            {
              "type":"Microsoft.Resources/deployments", "apiVersion":"2022-09-01",
              "properties":{"template":{"resources":[
                {"type":"Microsoft.Web/serverfarms", "apiVersion":"2024-04-01",
                 "name":"example", "location":"[parameters('location')]",
                 "sku":{"name":"B1"}, "properties":{"reserved":true}}
              ]}}
            }
          ]
        }
        """;
    private const string Parameters = """
        {"parameters":{
          "environmentName":{"value":"${AZURE_ENV_NAME}"},
          "location":{"value":"${AZURE_LOCATION}"},
          "principalId":{"value":"${AZURE_PRINCIPAL_ID}"},
          "principalType":{"value":"${AZURE_PRINCIPAL_TYPE=User}"},
          "requireAuthentication":{"value":"${REQUIRE_AUTHENTICATION=false}"}
        }}
        """;
    private const string Success = """{"properties":{"provisioningState":"Succeeded","diagnostics":[]}}""";
    private const string QuotaError = """
        {"error":{"code":"InvalidTemplateDeployment","message":"Invalid deployment","details":[
          {"code":"ValidationForResourceFailed","details":[
            {"code":"InternalSubscriptionIsOverQuotaForSku",
             "message":"Current Limit (B1 VMs): 0; Current Usage: 0; Amount required: 1",
             "target":"Microsoft.Web/serverFarms"}
          ]}
        ]}}
        """;

    [Fact]
    public void InteractiveHookFlagPermitsForwardedInputWithoutApprovingChoices()
    {
        var options = DeploymentPreflight.Program.ParseArguments(["--interactive"]);
        Assert.False(options.CheckOnly);
        Assert.True(options.Interactive);
        var ui = new ConsoleUi(Env(), new StringReader("1\n"), new StringWriter(), options.Interactive);
        Assert.False(ui.Accepted);
        Assert.Equal(0, ui.Choose("Pick", "選択", ["A", "B"]));
        Assert.False(new ConsoleUi(Env(), new StringReader("1\n"), new StringWriter(), true)
            .Confirm("Continue?", "続行しますか？"));
    }

    [Theory]
    [InlineData("CI")]
    [InlineData("AZD_NON_INTERACTIVE")]
    public void InteractiveHookFlagStillHonorsUnattendedMode(string key)
    {
        var env = Env();
        env[key] = "true";
        var ui = new ConsoleUi(env, new StringReader("2\n"), new StringWriter(), true);
        Assert.Throws<InvalidOperationException>(() => ui.Confirm("Continue?", "続行しますか？"));
    }

    [Fact]
    public void CheckOnlyAndInteractiveAreMutuallyExclusive()
    {
        Assert.Equal((true, false), DeploymentPreflight.Program.ParseArguments(["--check-only"]));
        Assert.Equal((false, false), DeploymentPreflight.Program.ParseArguments([]));
        Assert.Throws<ArgumentException>(() =>
            DeploymentPreflight.Program.ParseArguments(["--check-only", "--interactive"]));
    }

    [Fact]
    public void ForwardedInputEofCancelsInsteadOfAssumingConsent()
    {
        var ui = new ConsoleUi(Env(), new StringReader(""), new StringWriter(), true);
        Assert.Throws<OperationCanceledException>(() => ui.Confirm("Continue?", "続行しますか？"));
    }

    [Fact]
    public void GeographyIsAnExplicitFilterNotTheDisplayLanguage()
    {
        Assert.Equal(new[] { Japan }, RegionRules.Candidates([US, Japan], "Japan", "eastus"));
        Assert.Equal(new[] { US, Japan }, RegionRules.Candidates([Japan, US], "", null));
        Assert.Equal(new[] { Japan, US }, RegionRules.Candidates([US, Japan], null, "japaneast"));
        Assert.Empty(RegionRules.Candidates([US, Japan], "missing", null));
    }

    [Theory]
    [InlineData(null, null, null)]
    [InlineData("eastus", null, null)]
    [InlineData("eastus", "eastus", "eastus")]
    [InlineData("East US", "eastus", "East US")]
    public void ExistingGroupPinsTheLocation(string? requested, string? group, string? expected) =>
        Assert.Equal(expected, RegionRules.PinnedLocation(requested, group));

    [Fact]
    public void ExistingGroupCannotBeSilentlyMoved() =>
        Assert.Throws<InvalidOperationException>(() => RegionRules.PinnedLocation("japaneast", "eastus"));

    [Fact]
    public void MissingOriginalInputCannotBeReplacedWithCanonicalAzureLocation() =>
        Assert.Throws<InvalidOperationException>(() => RegionRules.PinnedLocation(null, "eastus"));

    [Fact]
    public void NestedQuotaErrorRetainsTheActualCause()
    {
        var result = RegionRules.Interpret(US, 400, JsonNode.Parse(QuotaError)!.AsObject());
        Assert.Equal(CheckStatus.Blocked, result.Status);
        Assert.Contains("InternalSubscriptionIsOverQuotaForSku", result.Detail);
        Assert.Contains("Current Limit (B1 VMs): 0", result.Detail);
        Assert.Contains("Amount required: 1", result.Detail);
    }

    [Theory]
    [InlineData(403, """{"error":{"code":"AuthorizationFailed","message":"denied"}}""")]
    [InlineData(429, """{"error":{"code":"TooManyRequests"}}""")]
    [InlineData(500, """{"error":{"code":"InternalServerError"}}""")]
    [InlineData(200, """{"properties":{"diagnostics":[{"code":"NestedDeploymentShortCircuited","level":"Warning"}]}}""")]
    [InlineData(200, """{"properties":{"provisioningState":"Running"}}""")]
    [InlineData(200, "{}")]
    public void MissingPermissionsAndIncompleteResponsesAreNotSuccess(int status, string json) =>
        Assert.Equal(CheckStatus.Unknown, RegionRules.Interpret(Japan, status, JsonNode.Parse(json)!.AsObject()).Status);

    [Fact]
    public void PolicyDenialIsBlockedEvenWithHttp403() =>
        Assert.Equal(CheckStatus.Blocked, RegionRules.Interpret(Japan, 403,
            JsonNode.Parse("""{"error":{"code":"RequestDisallowedByPolicy","message":"region is denied"}}""")!.AsObject()).Status);

    [Fact]
    public void ErrorsRedactIdentifiersAndCredentials()
    {
        var redacted = RegionRules.Redact(
            $"{SubId} someone@example.com Password=secret; Bearer eyJabc.def.ghi\nB1 required: 1");
        Assert.DoesNotContain(SubId, redacted);
        Assert.DoesNotContain("someone@", redacted);
        Assert.DoesNotContain("secret", redacted);
        Assert.DoesNotContain("eyJabc", redacted);
        Assert.Contains("B1 required: 1", redacted);
    }

    [Theory]
    [InlineData("https://example.com/steal")]
    [InlineData("http://management.azure.com/path")]
    [InlineData("https://management.azure.com:444/path")]
    [InlineData("https://user@management.azure.com/path")]
    public void ArmLinksCannotSendTokensToAnotherOrigin(string uri) =>
        Assert.Throws<InvalidOperationException>(() => ArmClient.SafeUri(uri));

    [Fact]
    public void TemplateParametersMatchAzdSubstitutionAndUseTheCandidateLocation()
    {
        var env = Env();
        env["AZURE_LOCATION"] = "eastus";
        env["AZURE_PRINCIPAL_ID"] = "do-not-trust-this-override";
        env["REQUIRE_AUTHENTICATION"] = "true";
        var inputs = Inputs();
        var actual = inputs.Resolve(env, "japaneast", PrincipalId, "ServicePrincipal");
        Assert.Equal("japaneast", actual["location"]!["value"]!.GetValue<string>());
        Assert.Equal("demo", actual["environmentName"]!["value"]!.GetValue<string>());
        Assert.Equal(PrincipalId, actual["principalId"]!["value"]!.GetValue<string>());
        Assert.Equal("ServicePrincipal", actual["principalType"]!["value"]!.GetValue<string>());
        Assert.True(actual["requireAuthentication"]!["value"]!.GetValue<bool>());
        Assert.Equal("rg-demo", inputs.ResourceGroupName("demo"));
        Assert.Equal("Basic", inputs.AppServiceTier());
        Assert.Single(inputs.RegionalResources());
    }

    [Fact]
    public void ChangedLocationMappingFailsInsteadOfValidatingDifferentInputs()
    {
        var parameters = JsonNode.Parse(Parameters)!.AsObject();
        parameters["parameters"]!["location"]!["value"] = "westus3";
        var inputs = new TemplateInputs(JsonNode.Parse(Template)!.AsObject(), parameters);
        Assert.Throws<InvalidOperationException>(() => inputs.Resolve(Env(), "japaneast", PrincipalId, "User"));
    }

    [Fact]
    public void ChangedGroupContractCannotBypassExistingResourceDetection()
    {
        var template = JsonNode.Parse(Template)!.AsObject();
        template["resources"]![0]!["name"] = "another-rg";
        var inputs = new TemplateInputs(template, JsonNode.Parse(Parameters)!.AsObject());
        Assert.Throws<InvalidOperationException>(() => inputs.ResourceGroupName("demo"));
    }

    [Fact]
    public void ContainerAppPodTemplateIsNotAnArmNestedDeployment()
    {
        var template = JsonNode.Parse(Template)!.AsObject();
        template["resources"]![1]!["properties"]!["template"]!["resources"]!.AsArray().Add(
            JsonNode.Parse("""
                {"type":"Microsoft.App/containerApps","apiVersion":"2024-03-01",
                 "location":"[parameters('location')]",
                 "properties":{"template":{"containers":[{"name":"emulator","image":"example"}]}}}
                """));
        var inputs = new TemplateInputs(template, JsonNode.Parse(Parameters)!.AsObject());
        Assert.Equal("Basic", inputs.AppServiceTier());
        Assert.Equal(2, inputs.RegionalResources().Count);
        Assert.Contains(inputs.RegionalResources(), r => r.Type == "Microsoft.App/containerApps");
    }

    [Fact]
    public async Task FreshEnvironmentRejectsB1QuotaThenSavesOnlyTheConfirmedCandidate()
    {
        var env = Env();
        env.Remove("AZURE_SUBSCRIPTION_ID");
        var commands = new FakeCommands();
        var server = new FakeArm { RejectUS = true };
        var output = new StringWriter();
        var ui = new ConsoleUi(env, new StringReader("1\n1\n1\n2\n"), output, true);
        await Run(env, ui, commands, server);

        Assert.Equal(new[] { "eastus", "japaneast" }, server.ValidatedRegions);
        Assert.Equal("japaneast", commands.Saved["AZURE_LOCATION"]);
        Assert.Equal(SubId, commands.Saved["AZURE_SUBSCRIPTION_ID"]);
        Assert.Equal("", commands.Saved["DEPLOYMENT_GEOGRAPHY"]);
        Assert.Contains("InternalSubscriptionIsOverQuotaForSku", output.ToString());
        Assert.All(server.ValidationBodies, b =>
        {
            Assert.Equal("Provider", b["properties"]!["validationLevel"]!.GetValue<string>());
            Assert.True(JsonNode.DeepEquals(JsonNode.Parse(Template), b["properties"]!["template"]));
            Assert.Equal(PrincipalId, b["properties"]!["parameters"]!["principalId"]!["value"]!.GetValue<string>());
            Assert.Equal(b["location"]!.GetValue<string>(), b["properties"]!["parameters"]!["location"]!["value"]!.GetValue<string>());
        });
        Assert.All(commands.Calls.Where(c => c.File == "az"), c => Assert.Equal("bicep", c.Args[0]));
        Assert.DoesNotContain(commands.Calls, c => c.Args.Contains("login") || c.Args.Contains("account"));
    }

    [Fact]
    public async Task CountryPreferenceRestrictsTheActualValidationCalls()
    {
        var env = Env();
        env["DEPLOYMENT_PREFLIGHT_LANGUAGE"] = "en";
        var commands = new FakeCommands();
        var server = new FakeArm();
        await Run(env, new ConsoleUi(env, new StringReader("2\n1\n1\n2\n"), new StringWriter(), true), commands, server);
        Assert.Equal(new[] { "japaneast" }, server.ValidatedRegions);
        Assert.Equal("Japan", commands.Saved["DEPLOYMENT_GEOGRAPHY"]);
    }

    [Fact]
    public async Task ExistingEnvironmentChecksOnlyItsOwnRegion()
    {
        var env = Env();
        env["AZURE_LOCATION"] = "eastus";
        env["DEPLOYMENT_PREFLIGHT_ACCEPT"] = "true";
        var server = new FakeArm { ExistingLocation = "eastus" };
        var commands = new FakeCommands();
        await Run(env, new ConsoleUi(env, output: new StringWriter()), commands, server);
        Assert.Equal(new[] { "eastus" }, server.ValidatedRegions);
        Assert.Equal("eastus", commands.Saved["AZURE_LOCATION"]);
    }

    [Fact]
    public async Task ExistingEnvironmentPreservesTheExactLocationStringUsedForResourceNames()
    {
        var env = Env();
        env["AZURE_LOCATION"] = "East US";
        env["DEPLOYMENT_PREFLIGHT_ACCEPT"] = "true";
        var commands = new FakeCommands();
        var server = new FakeArm { ExistingLocation = "eastus" };
        await Run(env, new ConsoleUi(env, output: new StringWriter()), commands, server);
        Assert.Equal("East US", commands.Saved["AZURE_LOCATION"]);
        Assert.Equal("East US", server.ValidationBodies.Single()["properties"]!["parameters"]!["location"]!["value"]!.GetValue<string>());
        Assert.Equal("eastus", server.ValidationBodies.Single()["location"]!.GetValue<string>());
    }

    [Fact]
    public async Task NondefaultEnvironmentDoesNotValidateWithTheDefaultEnvironmentsTenant()
    {
        var env = Env();
        env["AZURE_LOCATION"] = "eastus";
        env["DEPLOYMENT_PREFLIGHT_ACCEPT"] = "true";
        var commands = new FakeCommands { BootstrapTenant = "44444444-4444-4444-4444-444444444444" };
        var server = new FakeArm();
        await Run(env, new ConsoleUi(env, output: new StringWriter()), commands, server);
        Assert.Contains(commands.Calls, c => c.Args.Contains("--tenant-id") && c.Args.Contains(TenantId));
        Assert.Equal(TenantId, commands.Saved["AZURE_TENANT_ID"]);
        Assert.Single(server.ValidatedRegions);
    }

    [Fact]
    public async Task ChangedExistingRegionStopsBeforeValidationOrSaving()
    {
        var env = Env();
        env["AZURE_LOCATION"] = "japaneast";
        var commands = new FakeCommands();
        var server = new FakeArm { ExistingLocation = "eastus" };
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Run(env, new ConsoleUi(env, output: new StringWriter()), commands, server));
        Assert.Empty(server.ValidatedRegions);
        Assert.Empty(commands.Saved);
    }

    [Fact]
    public async Task CancellationAfterCheckingDoesNotChangeTheEnvironment()
    {
        var env = Env();
        var commands = new FakeCommands();
        await Assert.ThrowsAsync<OperationCanceledException>(() =>
            Run(env, new ConsoleUi(env, new StringReader("1\n1\n1\n"), new StringWriter(), true), commands, new FakeArm()));
        Assert.Empty(commands.Saved);
    }

    [Fact]
    public async Task UnknownValidationCannotBeSelectedEvenInUnattendedMode()
    {
        var env = Env();
        env["AZURE_LOCATION"] = "eastus";
        env["DEPLOYMENT_PREFLIGHT_ACCEPT"] = "true";
        var commands = new FakeCommands();
        var server = new FakeArm { UnknownValidation = true };
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Run(env, new ConsoleUi(env, output: new StringWriter()), commands, server));
        Assert.Empty(commands.Saved);
    }

    [Fact]
    public async Task ExplicitOptOutDoesNotCallAnyToolsOrApis()
    {
        var env = Env();
        env["DEPLOYMENT_PREFLIGHT_MODE"] = "off";
        var commands = new FakeCommands();
        var server = new FakeArm();
        await Run(env, new ConsoleUi(env, output: new StringWriter()), commands, server);
        Assert.Empty(commands.Calls);
        Assert.Equal(0, server.CallCount);
    }

    [Fact]
    public async Task CheckOnlyUsesRealFlowWithoutPromptsSavingOrDeployment()
    {
        var env = Env();
        var commands = new FakeCommands();
        var server = new FakeArm { RejectUS = true };
        var output = new StringWriter();
        await DeploymentPreflight.Program.RunAsync(env,
            new ConsoleUi(env, new StringReader(""), output, false), CancellationToken.None,
            commands, server, _ => Task.FromResult(Parameters), checkOnly: true);
        Assert.Equal(new[] { "eastus", "japaneast" }, server.ValidatedRegions);
        Assert.Empty(commands.Saved);
        Assert.Contains("No target was selected or saved", output.ToString());
    }

    [Fact]
    public async Task CheckOnlyWithoutExplicitSubscriptionStopsBeforeAuthentication()
    {
        var env = Env();
        env.Remove("AZURE_SUBSCRIPTION_ID");
        var commands = new FakeCommands();
        var server = new FakeArm();
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            DeploymentPreflight.Program.RunAsync(env,
                new ConsoleUi(env, output: new StringWriter()), CancellationToken.None,
                commands, server, _ => Task.FromResult(Parameters), checkOnly: true));
        Assert.Empty(commands.Calls);
        Assert.Equal(0, server.CallCount);
    }

    [Fact]
    public async Task EmptyResourceGroupVariableIsNotAnOverride()
    {
        var env = Env();
        env["AZURE_RESOURCE_GROUP"] = "";
        var commands = new FakeCommands();
        var server = new FakeArm();
        await DeploymentPreflight.Program.RunAsync(env,
            new ConsoleUi(env, new StringReader(""), new StringWriter(), false), CancellationToken.None,
            commands, server, _ => Task.FromResult(Parameters), checkOnly: true);
        Assert.NotEmpty(server.ValidatedRegions);
        Assert.Empty(commands.Saved);
    }

    [Fact]
    public async Task ValidationPollsOnlyTheReturnedArmLocation()
    {
        var count = 0;
        using var http = new HttpClient(new DelegateHandler(request =>
        {
            count++;
            if (count == 1)
            {
                Assert.Equal(HttpMethod.Post, request.Method);
                var response = new HttpResponseMessage(HttpStatusCode.Accepted);
                response.Headers.Location = new Uri("/poll", UriKind.Relative);
                response.Headers.RetryAfter = new System.Net.Http.Headers.RetryConditionHeaderValue(TimeSpan.FromSeconds(1));
                return response;
            }
            Assert.Equal(HttpMethod.Get, request.Method);
            Assert.Equal("https://management.azure.com/poll", request.RequestUri!.ToString());
            if (count == 2)
                return new HttpResponseMessage(HttpStatusCode.Accepted);
            return Json(Success);
        }));
        var client = new ArmClient(http, _ => Task.FromResult("not-a-real-token"));
        var check = await client.ValidateAsync(SubId, "example", Japan, new(), new(), CancellationToken.None);
        Assert.Equal(CheckStatus.Candidate, check.Status);
        Assert.Equal(3, count);
    }

    private static TemplateInputs Inputs() => new(JsonNode.Parse(Template)!.AsObject(), JsonNode.Parse(Parameters)!.AsObject());
    private static Dictionary<string, string> Env() => new(StringComparer.OrdinalIgnoreCase)
    {
        ["AZURE_ENV_NAME"] = "demo",
        ["AZURE_SUBSCRIPTION_ID"] = SubId,
        ["DEPLOYMENT_PREFLIGHT_LANGUAGE"] = "en"
    };
    private static Task Run(Dictionary<string, string> env, ConsoleUi ui, FakeCommands commands, FakeArm server) =>
        DeploymentPreflight.Program.RunAsync(env, ui, CancellationToken.None, commands, server, _ => Task.FromResult(Parameters));
    private static HttpResponseMessage Json(string json, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    private sealed class FakeCommands : Commands
    {
        internal string BootstrapTenant { get; init; } = TenantId;
        internal Dictionary<string, string> Saved { get; } = [];
        internal List<(string File, string[] Args)> Calls { get; } = [];
        internal override Task<string> RunAsync(string file, IReadOnlyList<string> arguments, CancellationToken cancellation)
        {
            Calls.Add((file, arguments.ToArray()));
            if (file == "az")
                return Task.FromResult(arguments[1] == "build" ? Template : "Bicep CLI test fixture");
            if (arguments[0] == "version")
                return Task.FromResult("azd version 1.33.0 (test fixture)");
            if (arguments[0] == "auth" && arguments[1] == "status")
                return Task.FromResult("""{"status":"authenticated","type":"user","email":"test@example.invalid"}""");
            if (arguments[0] == "auth" && arguments[1] == "token")
            {
                var tenantFlag = Array.IndexOf(arguments.ToArray(), "--tenant-id");
                var tenant = tenantFlag >= 0 ? arguments[tenantFlag + 1] : BootstrapTenant;
                var payload = Convert.ToBase64String(Encoding.UTF8.GetBytes(
                    $$"""{"oid":"{{PrincipalId}}","tid":"{{tenant}}","scp":"user_impersonation"}"""))
                    .TrimEnd('=').Replace('+', '-').Replace('/', '_');
                return Task.FromResult($$"""{"token":"fixture.{{payload}}.signature","expiresOn":"2099-01-01T00:00:00Z"}""");
            }
            if (arguments[0] == "env" && arguments[1] == "set")
            {
                Saved[arguments[2]] = arguments[3];
                return Task.FromResult("");
            }
            throw new InvalidOperationException("Unexpected command in offline test.");
        }
    }

    private sealed class FakeArm : HttpMessageHandler
    {
        internal bool RejectUS { get; init; }
        internal bool UnknownValidation { get; init; }
        internal string? ExistingLocation { get; init; }
        internal int CallCount { get; private set; }
        internal List<string> ValidatedRegions { get; } = [];
        internal List<JsonObject> ValidationBodies { get; } = [];
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            CallCount++;
            Assert.Equal("management.azure.com", request.RequestUri!.Host);
            Assert.Equal("Bearer", request.Headers.Authorization!.Scheme);
            var tokenTenant = DeploymentPreflight.Program.TokenClaims(request.Headers.Authorization.Parameter!)["tid"]!.GetValue<string>();
            var path = request.RequestUri.AbsolutePath;
            if (path == "/tenants")
                return Json($$"""{"value":[{"tenantId":"{{TenantId}}"}]}""");
            if (path == "/subscriptions" && tokenTenant != TenantId)
                return Json("""{"value":[]}""");
            Assert.Equal(TenantId, tokenTenant);
            if (request.Method == HttpMethod.Post && path.EndsWith("/validate", StringComparison.Ordinal))
            {
                var body = JsonNode.Parse(await request.Content!.ReadAsStringAsync(cancellationToken))!.AsObject();
                var region = body["location"]!.GetValue<string>();
                ValidatedRegions.Add(region);
                ValidationBodies.Add(body);
                if (UnknownValidation)
                    return Json("""{"error":{"code":"AuthorizationFailed","message":"no permission"}}""", HttpStatusCode.Forbidden);
                return RejectUS && region == "eastus" ? Json(QuotaError, HttpStatusCode.BadRequest) : Json(Success);
            }
            Assert.Equal(HttpMethod.Get, request.Method);
            var subscription = $$"""{"subscriptionId":"{{SubId}}","displayName":"Fixture","tenantId":"{{TenantId}}","state":"Enabled"}""";
            if (path == "/subscriptions")
                return Json("""{"value":[""" + subscription + "]}");
            if (path == "/subscriptions/" + SubId)
                return Json(subscription);
            if (path.Contains("/resourceGroups/", StringComparison.Ordinal))
                return ExistingLocation is null ? Json("{}", HttpStatusCode.NotFound) :
                    Json($$"""{"location":"{{ExistingLocation}}"}""");
            if (path.EndsWith("/locations", StringComparison.Ordinal))
                return Json(System.Text.Json.JsonSerializer.Serialize(new
                {
                    value = new[] { US, Japan }.Select(r => new
                    {
                        name = r.Name, displayName = r.DisplayName, type = "Region",
                        metadata = new { regionType = "Physical", geography = r.Geography, regionCategory = "Recommended" }
                    })
                }));
            if (path.EndsWith("/providers/Microsoft.Web", StringComparison.Ordinal))
                return Json("""{"resourceTypes":[{"resourceType":"serverfarms","locations":["East US","Japan East"],"apiVersions":["2024-04-01"]}]}""");
            if (path.EndsWith("/geoRegions", StringComparison.Ordinal))
                return Json("""{"value":[{"name":"East US"},{"name":"Japan East"}]}""");
            throw new InvalidOperationException("Unexpected ARM endpoint in offline test: " + path);
        }
    }

    private sealed class DelegateHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(respond(request));
    }
}
