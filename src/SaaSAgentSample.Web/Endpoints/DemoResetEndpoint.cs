using SaaSAgentSample.Core.Subscriptions;

namespace SaaSAgentSample.Web.Endpoints;

/// <summary>
/// Demo-harness endpoint that empties this app's subscription store, so the emulator can reset
/// both sides of the demo from one button.
///
/// <para>This is not a Marketplace capability. There is no Fulfillment API that lets anyone delete
/// a publisher's records — the emulator calls this only because it is a test harness driving a
/// sample, and the UI that calls it says so.</para>
///
/// <para>Reachable only when <c>Demo:AllowReset</c> is on, and only from the emulator's origin: it
/// requires a custom header, which forces a CORS preflight that any other origin fails. Without
/// the header requirement a plain cross-site form POST would go through, because CORS blocks the
/// reading of a response, not the sending of a simple request.</para>
/// </summary>
public static class DemoResetEndpoint
{
    public const string AllowResetConfigKey = "Demo:AllowReset";
    public const string CorsPolicyName = "DemoReset";

    /// <summary>Required on the request; its presence is what forces the preflight.</summary>
    public const string RequiredHeader = "X-Demo-Reset";

    public static IEndpointRouteBuilder MapDemoReset(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/demo/reset", HandleAsync)
            .AllowAnonymous()
            .RequireCors(CorsPolicyName);
        return endpoints;
    }

    internal static async Task<IResult> HandleAsync(
        HttpRequest request,
        IConfiguration config,
        IDemoDataReset reset,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        if (!config.GetValue(AllowResetConfigKey, false))
        {
            return Results.NotFound();
        }

        if (!request.Headers.ContainsKey(RequiredHeader))
        {
            return Results.BadRequest();
        }

        var cleared = await reset.ClearSubscriptionsAsync(cancellationToken);
        loggerFactory.CreateLogger(typeof(DemoResetEndpoint))
            .LogWarning("Demo reset removed {Count} subscription(s) and their provenance.", cleared);

        return Results.Ok(new { cleared });
    }
}
