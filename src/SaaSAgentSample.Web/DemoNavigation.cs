using Microsoft.Extensions.Configuration;

namespace SaaSAgentSample.Web;

/// <summary>How much of the demo map to spell out.</summary>
public enum DemoMapDetail
{
    /// <summary>Only the step you are on is expanded. Used on every page except the home map.</summary>
    CurrentOnly,

    /// <summary>Every step is expanded. Used on the home page, where the map is the content.</summary>
    All,
}

/// <summary>View-model for the shared demo map, which is the one place the flow is explained.</summary>
/// <param name="Current">The step the visitor is on (1-4), or null when they are on none of them.</param>
/// <param name="Detail">Whether to expand every step or only the current one.</param>
public sealed record DemoMapVm(int? Current, DemoMapDetail Detail);

/// <summary>Helpers for the in-product demo wayfinding ("where do I start / where am I").</summary>
public static class DemoNavigation
{
    /// <summary>
    /// Best-effort URL of the Fulfillment API Emulator that backs this demo, so the app can link the
    /// buyer to step 1 ("Buy in Marketplace"). Prefers <c>Demo:EmulatorUrl</c>, otherwise derives it
    /// from <c>Fulfillment:BaseUrl</c> by dropping the API path. Returns null when the app is pointed
    /// at the real Marketplace API (there is no clickable emulator to send people to).
    /// </summary>
    public static string? EmulatorUrl(IConfiguration config)
    {
        var explicitUrl = config["Demo:EmulatorUrl"];
        if (!string.IsNullOrWhiteSpace(explicitUrl))
        {
            return explicitUrl.TrimEnd('/');
        }

        var baseUrl = config["Fulfillment:BaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl) || !Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri))
        {
            return null;
        }

        // The real Marketplace API is not a browsable emulator, so don't offer it as a link.
        if (uri.Host.Equals("marketplaceapi.microsoft.com", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        // Drop the path (e.g. /api) to get the emulator's browsable root.
        return uri.GetLeftPart(UriPartial.Authority);
    }
}
