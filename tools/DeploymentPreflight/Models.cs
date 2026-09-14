using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace DeploymentPreflight;

internal sealed record Region(string Name, string DisplayName, string Geography, bool Recommended);
internal sealed record Subscription(string Id, string Name, string TenantId);
internal enum CheckStatus { Candidate, Blocked, Unknown }
internal sealed record RegionCheck(Region Region, CheckStatus Status, string Detail);

internal static partial class RegionRules
{
    internal static string Normalize(string name) =>
        string.Concat(name.Where(char.IsLetterOrDigit)).ToLowerInvariant();

    internal static IReadOnlyList<Region> Candidates(
        IEnumerable<Region> regions, string? geography, string? requestedLocation) =>
        regions
            .Where(r => string.IsNullOrEmpty(geography) || r.Geography.Equals(geography, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(r => r.Name.Equals(requestedLocation, StringComparison.OrdinalIgnoreCase))
            .ThenByDescending(r => r.Recommended)
            .ThenBy(r => r.Name, StringComparer.Ordinal)
            .ToArray();

    internal static string? PinnedLocation(string? requested, string? resourceGroupLocation)
    {
        if (string.IsNullOrWhiteSpace(resourceGroupLocation))
            return null;
        if (string.IsNullOrWhiteSpace(requested))
            throw new InvalidOperationException(
                "The resource group exists but the original AZURE_LOCATION input is missing. " +
                "Restore the original azd environment input instead of inferring it from Azure's canonical region name.");
        if (!Normalize(requested).Equals(Normalize(resourceGroupLocation), StringComparison.Ordinal))
            throw new InvalidOperationException(
                "AZURE_LOCATION differs from the existing resource group's location. " +
                "This helper will not move an existing environment. See docs/deployment-regions.md.");
        // The exact string is hashed into resourceToken by main.bicep.
        return requested;
    }

    internal static RegionCheck Interpret(Region region, int statusCode, JsonObject? response)
    {
        if (response?["error"] is JsonObject error)
        {
            var details = ErrorDetails(error).ToArray();
            var uncertain = statusCode is 401 or 403 or 408 or 429 or >= 500 ||
                details.Any(d => d.Contains("AuthorizationFailed", StringComparison.OrdinalIgnoreCase));
            // Policy denies can use HTTP 403; that is a known rejection, not a permission-query failure.
            if (details.Any(d => d.Contains("RequestDisallowedByPolicy", StringComparison.OrdinalIgnoreCase)))
                uncertain = false;
            return new(region, uncertain ? CheckStatus.Unknown : CheckStatus.Blocked,
                Redact(string.Join(" | ", details)));
        }

        if (statusCode != 200 || response?["properties"] is not JsonObject properties)
            return new(region, CheckStatus.Unknown, $"Unexpected validation response (HTTP {statusCode}).");

        if (properties["diagnostics"] is JsonArray diagnostics && diagnostics.Count > 0)
        {
            var detail = string.Join(" | ", diagnostics.OfType<JsonObject>().Select(d =>
                $"{d["code"]}: {d["message"]}"));
            return new(region, CheckStatus.Unknown, Redact("Validation diagnostics: " + detail));
        }

        if (properties["provisioningState"]?.GetValue<string>() is { } state &&
            !state.Equals("Succeeded", StringComparison.OrdinalIgnoreCase))
            return new(region, CheckStatus.Unknown, $"Validation state: {Redact(state)}");

        return new(region, CheckStatus.Candidate, "");
    }

    private static IEnumerable<string> ErrorDetails(JsonObject error)
    {
        yield return $"{error["code"]}: {error["message"]} ({error["target"]})";
        if (error["details"] is JsonArray details)
            foreach (var child in details.OfType<JsonObject>())
                foreach (var detail in ErrorDetails(child))
                    yield return detail;
        if ((error["innererror"] ?? error["innerError"]) is JsonObject inner)
            foreach (var detail in ErrorDetails(inner))
                yield return detail;
    }

    internal static string Redact(string text)
    {
        text = SecretPattern().Replace(text, "$1[redacted]");
        text = TokenPattern().Replace(text, "[token]");
        text = GuidPattern().Replace(text, "[id]");
        text = EmailPattern().Replace(text, "[account]");
        text = string.Concat(text.Select(c => char.IsControl(c) ? ' ' : c));
        return text.Length > 1800 ? text[..1800] + "..." : text;
    }

    [GeneratedRegex(@"(?i)\b(password\s*=\s*|pwd\s*=\s*|accountkey\s*=\s*|authorization\s*:\s*bearer\s+)[^;\s]+")]
    private static partial Regex SecretPattern();
    [GeneratedRegex(@"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b")]
    private static partial Regex TokenPattern();
    [GeneratedRegex(@"\b[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}\b")]
    private static partial Regex GuidPattern();
    [GeneratedRegex(@"[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}")]
    private static partial Regex EmailPattern();
}
