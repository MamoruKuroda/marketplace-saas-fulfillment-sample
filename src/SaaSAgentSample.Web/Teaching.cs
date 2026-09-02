using Microsoft.Extensions.Localization;
using SaaSAgentSample.Core.Subscriptions;
using SaaSAgentSample.Web.Services;

namespace SaaSAgentSample.Web;

/// <summary>Which of the three roles the current page puts the visitor in.</summary>
public enum DemoRole
{
    /// <summary>No single role — e.g. the home page, which is the map of all of them.</summary>
    None,
    Microsoft,
    Publisher,
    Buyer,
}

/// <summary>Which of the publisher's three parts the current page is.</summary>
public enum BuildPart
{
    /// <summary>No single part — e.g. the home page.</summary>
    None,

    /// <summary>The buyer landing page (demo step 2).</summary>
    Landing,

    /// <summary>The connection webhook — no page of its own; it receives the 4 → 3 arrow.</summary>
    Webhook,

    /// <summary>The subscription state store, surfaced by the publisher admin (demo step 3).</summary>
    StateStore,
}

/// <param name="Current">The role this page puts the visitor in.</param>
public sealed record RoleBadgeVm(DemoRole Current);

/// <param name="Current">The part this page is, if any.</param>
/// <param name="Expanded">True for the home page's full panel with descriptions; false for the compact strip.</param>
public sealed record BuildPartsVm(BuildPart Current, bool Expanded);

/// <param name="Events">Recorded entries for this subscription, newest first. May be empty.</param>
/// <param name="State">Current state, used to describe the provenance when nothing is recorded.</param>
/// <param name="Compact">True for the one-line form used in the admin list.</param>
public sealed record ProvenanceVm(IReadOnlyList<SubscriptionEvent> Events, SubscriptionState State, bool Compact);

/// <param name="MarketplaceSubscriptionId">Subscription the illustrative bar is derived from.</param>
/// <param name="PlanId">Plan the illustrative bar is derived from.</param>
/// <param name="Compact">True for the slim bar used in the admin list.</param>
public sealed record CapacityVm(string? MarketplaceSubscriptionId, string? PlanId, bool Compact);

/// <summary>A glossary term rendered as an inline tooltip. Both strings come from the shared
/// catalog, so a tooltip and the "Key terms" list can never drift apart.</summary>
/// <param name="Label">The word being explained.</param>
/// <param name="Definition">The plain-language explanation.</param>
public sealed record TermVm(string Label, string Definition)
{
    public static TermVm Resolve(IStringLocalizer<SharedResource> l) =>
        new(l["Resolve"], l["Exchanges the purchase token for the subscription — offer, plan, and buyer."]);

    public static TermVm Activate(IStringLocalizer<SharedResource> l) =>
        new(l["Activate"], l["Confirms fulfillment has started: moves the subscription to Subscribed and begins billing."]);

    public static TermVm Webhook(IStringLocalizer<SharedResource> l) =>
        new(l["Webhook (connection)"], l["Microsoft's notification of a plan/quantity change, suspend/reinstate, or cancel. The app validates it before updating state."]);

    public static TermVm LandingPage(IStringLocalizer<SharedResource> l) =>
        new(l["Landing page"], l["The page Microsoft opens after a purchase, carrying the purchase token. Where the buyer signs in and the subscription is activated."]);

    public static TermVm StateStore(IStringLocalizer<SharedResource> l) =>
        new(l["State store"], l["The publisher's own database of who has which subscription. The only thing this app consults to decide whether a customer may use the product."]);

    public static TermVm Dimension(IStringLocalizer<SharedResource> l) =>
        new(l["Dimension (billing unit)"], l["The unit a metered plan charges by — API calls, gigabytes, jobs. This sample is flat-rate only, so it has none."]);

    public static TermVm ChangePlan(IStringLocalizer<SharedResource> l) =>
        new(l["Change plan"], l["The buyer moves to a different plan on the same subscription. It stays one subscription; Microsoft handles the pricing side."]);

    public static TermVm PrepaidCapacity(IStringLocalizer<SharedResource> l) =>
        new(l["Prepaid capacity"], l["An allowance the customer pays for up front and draws down as they use the service. Shown here only to illustrate the idea."]);
}

/// <summary>
/// Display-only helpers for the teaching UI. Nothing here influences billing, entitlement, or
/// any state transition — the values are illustrative and are labelled as such on screen.
/// </summary>
public static class Teaching
{
    /// <summary>Illustrative allowances, smallest first. Picked deterministically per plan.</summary>
    private static readonly decimal[] Allowances = [5.00m, 10.00m, 25.00m, 50.00m];

    /// <summary>
    /// A stable, made-up "capacity used / capacity bought" pair for one subscription.
    ///
    /// It exists so a viewer can see the mental model customers actually hold — "I prepaid an
    /// allowance and my usage draws it down" — next to a subscription that is really flat-rate.
    /// Nothing is metered and nothing is billed from this. It is derived from the subscription
    /// and plan ids only, so it is stable across reloads and visibly moves when a ChangePlan
    /// webhook lands (which is the point: the plan changed, so the allowance changed).
    /// </summary>
    public static (decimal Used, decimal Total) IllustrativeCapacity(string? marketplaceSubscriptionId, string? planId)
    {
        var plan = planId ?? string.Empty;
        var total = Allowances[(int)(Hash(plan) % (uint)Allowances.Length)];

        // 8% .. 92% of the allowance, in 1% steps.
        var percent = 8 + (int)(Hash((marketplaceSubscriptionId ?? string.Empty) + "|" + plan) % 85u);
        var used = Math.Round(total * percent / 100m, 2, MidpointRounding.AwayFromZero);

        return (used, total);
    }

    /// <summary>FNV-1a. Chosen because it is stable across processes and runtimes, unlike
    /// <see cref="string.GetHashCode()"/>, so the illustrative bar does not jump between restarts.</summary>
    private static uint Hash(string value)
    {
        var hash = 2166136261u;
        foreach (var c in value)
        {
            hash = (hash ^ c) * 16777619u;
        }

        return hash;
    }
}
