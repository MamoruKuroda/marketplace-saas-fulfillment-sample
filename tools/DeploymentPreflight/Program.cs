using System.ComponentModel;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace DeploymentPreflight;

internal static class Program
{
    private static async Task<int> Main(string[] args)
    {
        var environment = Environment.GetEnvironmentVariables().Cast<System.Collections.DictionaryEntry>()
            .ToDictionary(e => (string)e.Key, e => (string?)e.Value ?? "", StringComparer.OrdinalIgnoreCase);
        var ui = new ConsoleUi(environment);
        using var cancellation = new CancellationTokenSource();
        Console.CancelKeyPress += (_, e) => { e.Cancel = true; cancellation.Cancel(); };
        try
        {
            if (args.Length > 1 || args.Any(arg => arg != "--check-only"))
                throw new ArgumentException("Supported argument: --check-only");
            await RunAsync(environment, ui, cancellation.Token, checkOnly: args.Contains("--check-only"));
            return 0;
        }
        catch (OperationCanceledException)
        {
            ui.Write("Region selection cancelled or timed out. Deployment has not started.",
                "地域選択を中止したか、制限時間を超えました。デプロイは開始していません。");
            return 1;
        }
        catch (Exception ex) when (ex is InvalidOperationException or JsonException or IOException
            or HttpRequestException or Win32Exception or FormatException or ArgumentException
            or CommandFailureException or ArmQueryException)
        {
            ui.Write("Region preflight stopped:", "地域の事前チェックを停止しました：");
            Console.Error.WriteLine(RegionRules.Redact(ex.Message));
            ui.Write("See docs/deployment-regions.md. No resource creation, SKU change, or login was attempted.",
                "docs/deployment-regions.ja.md を参照してください。リソース作成・SKU変更・ログインは行っていません。");
            return 1;
        }
    }

    internal static async Task RunAsync(
        Dictionary<string, string> environment, ConsoleUi ui, CancellationToken cancellation,
        Commands? commandRunner = null, HttpMessageHandler? messageHandler = null,
        Func<CancellationToken, Task<string>>? readParameters = null, bool checkOnly = false)
    {
        if (environment.GetValueOrDefault("DEPLOYMENT_PREFLIGHT_MODE") == "off")
        {
            if (checkOnly)
                throw new InvalidOperationException("Check-only cannot run while DEPLOYMENT_PREFLIGHT_MODE=off.");
            ui.Write("Region guidance explicitly disabled. Normal azd validation still applies.",
                "地域候補の案内は明示的に無効化されています。通常の azd 検証は実施されます。");
            return;
        }
        var environmentName = Required(environment, "AZURE_ENV_NAME");
        if (checkOnly && string.IsNullOrWhiteSpace(environment.GetValueOrDefault("AZURE_SUBSCRIPTION_ID")))
            throw new InvalidOperationException("Check-only requires an explicit AZURE_SUBSCRIPTION_ID.");
        if (environment.GetValueOrDefault("AZURE_CLOUD_NAME", "AzureCloud") != "AzureCloud")
            throw new InvalidOperationException("Region guidance currently supports AzureCloud only.");
        var groupOverride = environment.GetValueOrDefault("AZURE_RESOURCE_GROUP");
        if (!string.IsNullOrWhiteSpace(groupOverride) && groupOverride != $"rg-{environmentName}")
            throw new InvalidOperationException("The resource-group override does not match this sample's template.");

        var commands = commandRunner ?? new Commands();
        var version = await commands.RunAsync("azd", ["version"], cancellation);
        ui.Write("Checking deployment regions with your azd identity (no resources are created).",
            "azd の認証でデプロイ地域を確認します（リソースは作成しません）。");
        ui.Value(version.Trim());
        var auth = await commands.AzdJsonAsync(["auth", "status"], cancellation);
        if (auth["status"]?.GetValue<string>() != "authenticated")
            throw new InvalidOperationException("Sign in with azd auth login before running azd up.");
        ui.Value($"{ui.Text("Account", "アカウント")}: {auth["email"] ?? auth["clientId"] ?? auth["type"]}");

        var tenant = environment.GetValueOrDefault("AZURE_TENANT_ID", "");
        string? cachedToken = null;
        DateTimeOffset expires = DateTimeOffset.MinValue;
        async Task<string> Token(CancellationToken ct)
        {
            if (cachedToken is not null && expires > DateTimeOffset.UtcNow.AddMinutes(5))
                return cachedToken;
            List<string> arguments = ["auth", "token", "--scope", ArmClient.Endpoint + "/.default"];
            if (tenant.Length > 0)
                arguments.AddRange(["--tenant-id", tenant]);
            var token = await commands.AzdJsonAsync(arguments.ToArray(), ct);
            cachedToken = token["token"]?.GetValue<string>()
                ?? throw new InvalidOperationException("azd auth token returned no token.");
            expires = DateTimeOffset.Parse(token["expiresOn"]!.GetValue<string>());
            return cachedToken;
        }

        using var http = new HttpClient(messageHandler ?? new HttpClientHandler { AllowAutoRedirect = false })
            { Timeout = TimeSpan.FromSeconds(60) };
        var arm = new ArmClient(http, Token);
        var subscriptionId = environment.GetValueOrDefault("AZURE_SUBSCRIPTION_ID", "");
        var explicitTenant = tenant.Length > 0;
        // Bootstrap only tenant discovery from azd's default token. Every target-subscription
        // request below uses an explicitly resolved tenant, even for a nondefault azd environment.
        var bootstrapClaims = TokenClaims(await Token(cancellation));
        tenant = bootstrapClaims["tid"]?.GetValue<string>()
            ?? throw new InvalidOperationException("The azd ARM token has no tenant ID.");
        async Task ActivateTenant(string id)
        {
            if (tenant == id)
                return;
            tenant = id;
            cachedToken = null;
            await Token(cancellation);
        }
        async Task<Subscription[]> TenantSubscriptions()
        {
            return (await arm.ListAsync("/subscriptions?api-version=2022-12-01", cancellation))
                .Where(s => s["state"]?.GetValue<string>() == "Enabled")
                .Select(s => new Subscription(s["subscriptionId"]!.GetValue<string>(),
                    s["displayName"]!.GetValue<string>(), s["tenantId"]!.GetValue<string>()))
                .ToArray();
        }
        var visibleSubscriptions = new List<Subscription>(await TenantSubscriptions());
        if (!explicitTenant && (subscriptionId.Length == 0 ||
            !visibleSubscriptions.Any(s => s.Id.Equals(subscriptionId, StringComparison.OrdinalIgnoreCase))))
        {
            var initialTenant = tenant;
            var tenants = await arm.ListAsync("/tenants?api-version=2022-12-01", cancellation);
            foreach (var item in tenants)
            {
                var id = item["tenantId"]?.GetValue<string>();
                if (!Guid.TryParse(id, out _) || id == initialTenant)
                    continue;
                try
                {
                    await ActivateTenant(id);
                    visibleSubscriptions.AddRange(await TenantSubscriptions());
                }
                catch (Exception ex) when (ex is CommandFailureException or ArmQueryException or HttpRequestException)
                {
                    ui.Write($"Tenant ...{id[^8..]} could not be inspected; its subscriptions are unverified.",
                        $"テナント ...{id[^8..]} は照会できず、そのサブスクリプションは未確認です。");
                    ui.Value(RegionRules.Redact(ex.Message));
                }
                if (subscriptionId.Length > 0 &&
                    visibleSubscriptions.Any(s => s.Id.Equals(subscriptionId, StringComparison.OrdinalIgnoreCase)))
                    break;
            }
        }
        if (subscriptionId.Length == 0)
        {
            var subscriptions = visibleSubscriptions.DistinctBy(s => s.Id)
                .OrderBy(s => s.Name, StringComparer.Ordinal).ToArray();
            if (subscriptions.Length == 0)
                throw new InvalidOperationException("No enabled subscription is visible to this azd tenant. " +
                    "For a guest tenant, explicitly configure AZURE_TENANT_ID and AZURE_SUBSCRIPTION_ID.");
            var selected = ui.Choose("Choose the target subscription:", "対象サブスクリプションを選択してください：",
                subscriptions.Select(s => $"{s.Name} (...{s.Id[^8..]})").ToArray());
            subscriptionId = subscriptions[selected].Id;
        }
        var target = visibleSubscriptions.FirstOrDefault(s =>
            s.Id.Equals(subscriptionId, StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("The selected subscription was not found in the inspected azd tenants. " +
                "Explicitly configure AZURE_TENANT_ID for the target subscription.");
        await ActivateTenant(target.TenantId);
        if (!Guid.TryParse(subscriptionId, out _))
            throw new InvalidOperationException("AZURE_SUBSCRIPTION_ID must be a subscription UUID.");
        if (environment.TryGetValue("DEPLOYMENT_PREFLIGHT_SUBSCRIPTION_ID", out var previous) &&
            previous.Length > 0 && !previous.Equals(subscriptionId, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("This azd environment was previously checked for another subscription. " +
                "Use a separate azd environment instead of silently changing its subscription.");
        var subscription = await arm.GetAsync($"/subscriptions/{subscriptionId}?api-version=2022-12-01", false, cancellation);
        ui.Value($"{ui.Text("Subscription", "サブスクリプション")}: {subscription!["displayName"]} (...{subscriptionId[^8..]})");
        var claims = TokenClaims(await Token(cancellation));
        var principalId = claims["oid"]?.GetValue<string>()
            ?? throw new InvalidOperationException("The azd ARM token has no principal object ID.");
        var tokenTenant = claims["tid"]?.GetValue<string>();
        if (tokenTenant != subscription["tenantId"]?.GetValue<string>())
            throw new InvalidOperationException("The token tenant differs from the subscription tenant. " +
                "Select the target tenant with AZURE_TENANT_ID; delegated cross-tenant deployment is not supported by this sample.");
        var principalType = claims.ContainsKey("scp") ? "User" : "ServicePrincipal";
        ui.Value($"{ui.Text("Tenant", "テナント")}: ...{tokenTenant![^8..]}");
        environment["AZURE_SUBSCRIPTION_ID"] = subscriptionId;

        // Compile locally; do not use az's authentication for ARM calls or change its selected subscription.
        await commands.RunAsync("az", ["bicep", "version"], cancellation);
        var compiled = await commands.RunAsync("az", ["bicep", "build", "--file", "infra/main.bicep", "--stdout"], cancellation);
        readParameters ??= ct => File.ReadAllTextAsync(Path.Combine("infra", "main.parameters.json"), ct);
        var inputs = new TemplateInputs(JsonNode.Parse(compiled)!.AsObject(),
            JsonNode.Parse(await readParameters(cancellation))!.AsObject());
        // Fail locally if the parameter contract has drifted, before any candidate checks.
        inputs.Resolve(environment, "preflight-placeholder", principalId, principalType);
        var groupName = inputs.ResourceGroupName(environmentName);
        var resourceGroup = await arm.GetAsync(
            $"/subscriptions/{subscriptionId}/resourceGroups/{Uri.EscapeDataString(groupName)}?api-version=2022-09-01",
            true, cancellation);
        var requested = environment.GetValueOrDefault("AZURE_LOCATION", "");
        var pinned = RegionRules.PinnedLocation(requested, resourceGroup?["location"]?.GetValue<string>());
        if (pinned is not null)
            ui.Write($"Existing resource group: keeping region {pinned}.",
                $"既存リソースグループがあります。地域 {pinned} を維持します。");
        ui.Value(inputs.Summary());
        ui.Write("SKUs will not be changed. This cloud demo includes billable resources.",
            "SKUは変更しません。このクラウドデモには課金対象のリソースが含まれます。");
        var catalog = new RegionCatalog(arm);
        var regions = await catalog.LoadAsync(subscriptionId, cancellation);
        if (regions.Count == 0)
            throw new InvalidOperationException("Azure returned no physical deployment regions.");

        string? geography = environment.GetValueOrDefault("DEPLOYMENT_GEOGRAPHY");
        if (pinned is null && requested.Length == 0 && geography is null && !ui.Accepted && !checkOnly)
        {
            var specify = ui.Choose("Do you want to restrict the deployment geography?",
                "配置先の国・地理範囲に希望はありますか？",
                [ui.Text("No preference", "希望なし"), ui.Text("Choose a country/geography", "国・地理範囲を指定する")]);
            geography = "";
            if (specify == 1)
            {
                var geographies = regions.Select(r => r.Geography).Distinct().Order(StringComparer.Ordinal).ToArray();
                geography = geographies[ui.Choose("Choose the geography (Azure's names):",
                    "国・地理範囲を選択してください（Azure の名称）：", geographies)];
            }
        }
        if (ui.Accepted && requested.Length == 0 && pinned is null)
            throw new InvalidOperationException("Unattended runs require an explicit AZURE_LOCATION; no region is automatically chosen.");
        var candidates = pinned is not null
            ? regions.Where(r => RegionRules.Normalize(r.Name) == RegionRules.Normalize(pinned)).ToArray()
            : ui.Accepted
                ? regions.Where(r => r.Name.Equals(requested, StringComparison.OrdinalIgnoreCase)).ToArray()
                : RegionRules.Candidates(regions, geography, requested);
        if (candidates.Count == 0)
            throw new InvalidOperationException("No physical regions match the configured location/geography.");
        var exclusions = await catalog.ExclusionsAsync(subscriptionId, inputs, regions, cancellation);
        var checks = new List<RegionCheck>();
        Region? chosen = null;
        var index = 0;
        while (index < candidates.Count && chosen is null)
        {
            // Bound each interactive batch. Catalog exclusions don't consume slow ARM validation calls.
            var validated = 0;
            var batchCandidates = 0;
            while (index < candidates.Count && validated < 5 && batchCandidates < 3)
            {
                var region = candidates[index++];
                RegionCheck check;
                if (exclusions.TryGetValue(region.Name, out var reason))
                    check = new(region, CheckStatus.Blocked, reason);
                else
                {
                    ui.Write($"Validating {region.Name}...", $"{region.Name} を事前検証しています...");
                    check = await arm.ValidateAsync(subscriptionId, "preflight-" + Guid.NewGuid().ToString("N"),
                        region, inputs.Template, inputs.Resolve(environment, pinned ?? region.Name, principalId, principalType), cancellation);
                    validated++;
                }
                checks.Add(check);
                if (check.Status == CheckStatus.Candidate)
                    batchCandidates++;
                ui.Result(check);
            }
            var passed = checks.Where(c => c.Status == CheckStatus.Candidate).ToArray();
            if (checkOnly)
            {
                ui.Write($"Check-only complete: {passed.Length} candidate(s); {candidates.Count - index} region(s) not checked. No target was selected or saved; no deployment was started.",
                    $"チェックのみ完了：候補 {passed.Length} 件、残り未確認 {candidates.Count - index} 件。配置先の選択・保存、デプロイは行っていません。");
                if (passed.Length == 0)
                    throw new InvalidOperationException("No selectable candidates in this batch. Unchecked regions have not been ruled out.");
                return;
            }
            if (ui.Accepted)
            {
                if (passed.Length == 1)
                    chosen = passed[0].Region;
                break;
            }
            if (passed.Length == 0 && index == candidates.Count)
                break;
            var choices = passed.Select(c => $"{c.Region.DisplayName} ({c.Region.Name}, {c.Region.Geography})").ToList();
            if (index < candidates.Count)
                choices.Add(ui.Text($"Check more regions ({candidates.Count - index} not checked)",
                    $"他の地域を確認する（未確認 {candidates.Count - index} 件）"));
            choices.Add(ui.Text("Cancel", "キャンセル"));
            var selection = ui.Choose("Choose a candidate; unverified regions cannot be selected:",
                "候補を選択してください。未確認の地域は選べません：", choices);
            if (selection < passed.Length)
                chosen = passed[selection].Region;
            else if (selection == choices.Count - 1)
                throw new OperationCanceledException();
        }
        if (chosen is null)
            throw new InvalidOperationException(ui.Text(
                "No candidate passed in the checked regions. Review the reasons above; no deployment was started.",
                "確認した地域に事前検証を通過した候補がありません。上の理由を確認してください。デプロイは開始していません。"));
        ui.Write($"Selected: {chosen.DisplayName} ({chosen.Name}, {chosen.Geography}). Provider validation passed, not a success guarantee.",
            $"選択地域：{chosen.DisplayName}（{chosen.Name}, {chosen.Geography}）。事前検証通過はデプロイ成功の保証ではありません。");
        if (!ui.Confirm("Save this target and continue azd up with the unchanged, billable configuration?",
            "この配置先を保存し、現在の課金対象構成のまま azd up を続行しますか？"))
            throw new OperationCanceledException();
        await commands.SaveAsync(environmentName, "AZURE_SUBSCRIPTION_ID", subscriptionId, cancellation);
        await commands.SaveAsync(environmentName, "AZURE_LOCATION", pinned ?? chosen.Name, cancellation);
        await commands.SaveAsync(environmentName, "AZURE_TENANT_ID", tokenTenant, cancellation);
        await commands.SaveAsync(environmentName, "DEPLOYMENT_PREFLIGHT_SUBSCRIPTION_ID", subscriptionId, cancellation);
        if (geography is not null)
            await commands.SaveAsync(environmentName, "DEPLOYMENT_GEOGRAPHY", geography, cancellation);
        ui.Write("Target saved. Returning to azd.", "配置先を保存しました。azd の処理に戻ります。");
    }

    internal static JsonObject TokenClaims(string token)
    {
        var parts = token.Split('.');
        if (parts.Length != 3)
            throw new InvalidOperationException("The azd token format is not supported.");
        var payload = parts[1].Replace('-', '+').Replace('_', '/');
        payload = payload.PadRight((payload.Length + 3) / 4 * 4, '=');
        // Claims select the same SQL administrator as azd. Azure, not this decoder, authenticates the token.
        return JsonNode.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(payload)))!.AsObject();
    }

    private static string Required(IReadOnlyDictionary<string, string> environment, string key) =>
        environment.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value)
            ? value : throw new InvalidOperationException($"Missing {key}. Run this helper through azd up.");
}
