using System.Text.Json.Nodes;

namespace DeploymentPreflight;

internal sealed class RegionCatalog(ArmClient arm)
{
    internal async Task<IReadOnlyList<Region>> LoadAsync(string subscriptionId, CancellationToken cancellation)
    {
        var locations = await arm.ListAsync(
            $"/subscriptions/{subscriptionId}/locations?api-version=2022-12-01", cancellation);
        return locations
            .Where(l => l["type"]?.GetValue<string>() == "Region" &&
                l["metadata"]?["regionType"]?.GetValue<string>() == "Physical")
            .Select(l => new Region(
                l["name"]!.GetValue<string>(),
                l["displayName"]!.GetValue<string>(),
                l["metadata"]?["geography"]?.GetValue<string>() ?? "(unspecified)",
                l["metadata"]?["regionCategory"]?.GetValue<string>() == "Recommended"))
            .ToArray();
    }

    internal async Task<Dictionary<string, string>> ExclusionsAsync(
        string subscriptionId, TemplateInputs inputs, IReadOnlyList<Region> regions, CancellationToken cancellation)
    {
        var excluded = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var group in inputs.RegionalResources().GroupBy(r => r.Type.Split('/')[0]))
        {
            var provider = await arm.GetAsync(
                $"/subscriptions/{subscriptionId}/providers/{group.Key}?api-version=2021-04-01", false, cancellation);
            if (provider?["resourceTypes"] is not JsonArray types)
                throw new InvalidOperationException($"Provider catalog is unavailable: {group.Key}");
            foreach (var requirement in group)
            {
                var typeName = requirement.Type[(group.Key.Length + 1)..];
                var type = types.OfType<JsonObject>().FirstOrDefault(t =>
                    string.Equals(t["resourceType"]?.GetValue<string>(), typeName, StringComparison.OrdinalIgnoreCase));
                if (type is null || type["apiVersions"] is not JsonArray versions ||
                    !versions.Any(v => v?.GetValue<string>() == requirement.ApiVersion))
                    throw new InvalidOperationException($"Resource type/API version is not in the provider catalog: {requirement}");
                if (type["locations"] is not JsonArray locations || locations.Count == 0)
                    continue; // No regional catalog filter; the actual template is still validated below.
                var available = locations.Select(l => RegionRules.Normalize(l!.GetValue<string>())).ToHashSet();
                foreach (var region in regions)
                    if (!available.Contains(RegionRules.Normalize(region.Name)) &&
                        !available.Contains(RegionRules.Normalize(region.DisplayName)))
                        excluded.TryAdd(region.Name, $"{requirement.Type}: region is not in the provider catalog.");
            }
        }

        var webLocations = await arm.ListAsync(
            $"/subscriptions/{subscriptionId}/providers/Microsoft.Web/geoRegions" +
            $"?api-version=2024-04-01&sku={inputs.AppServiceTier()}&linuxWorkersEnabled=true", cancellation);
        var webNames = webLocations.SelectMany(l => new[]
        {
            l["name"]?.GetValue<string>() ?? "",
            l["properties"]?["displayName"]?.GetValue<string>() ?? ""
        }).Where(n => n.Length > 0).Select(RegionRules.Normalize).ToHashSet();
        if (webNames.Count == 0)
            throw new InvalidOperationException("App Service returned no Linux regions for the configured tier.");
        foreach (var region in regions)
            if (!webNames.Contains(RegionRules.Normalize(region.Name)) &&
                !webNames.Contains(RegionRules.Normalize(region.DisplayName)))
                excluded.TryAdd(region.Name, "App Service: this Linux tier is not listed in the region.");
        return excluded;
    }
}
