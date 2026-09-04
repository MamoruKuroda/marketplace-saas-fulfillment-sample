namespace SaaSAgentSample.Core.Subscriptions;

/// <summary>Which of the publisher's three parts wrote a subscription's state.</summary>
public enum SubscriptionEventSource
{
    /// <summary>Start-up path: the buyer landing page (Resolve, then Activate).</summary>
    Landing,

    /// <summary>Start-up path: the publisher admin confirmed Activate.</summary>
    Admin,

    /// <summary>Operating path: a connection webhook from Microsoft, authorized via Get Operation.</summary>
    Webhook,
}

/// <summary>
/// One entry in a subscription's provenance trail: what wrote its state, and when.
///
/// This is part of the ledger, not a debugging aid. A state store that can say what a
/// subscription is but not why it got there cannot answer a support question, reconcile against
/// Microsoft's records, or survive an audit — so entries are durable and written in the same
/// transaction as the state change they describe.
///
/// The trail is still never <em>read</em> by a decision: entitlement and state transitions come
/// from <see cref="Subscription"/> alone. It is append-only; nothing rewrites history.
/// </summary>
public sealed class SubscriptionEvent
{
    private SubscriptionEvent()
    {
        // EF Core materialization.
        MarketplaceSubscriptionId = string.Empty;
        Action = string.Empty;
    }

    public SubscriptionEvent(
        Guid id,
        string marketplaceSubscriptionId,
        SubscriptionEventSource source,
        string action,
        string? detail,
        DateTimeOffset at)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(marketplaceSubscriptionId);
        ArgumentException.ThrowIfNullOrWhiteSpace(action);

        Id = id;
        MarketplaceSubscriptionId = marketplaceSubscriptionId;
        Source = source;
        Action = action;
        Detail = detail;
        At = at;
    }

    public Guid Id { get; private set; }

    /// <summary>Subscription the entry belongs to, by its Marketplace id.</summary>
    public string MarketplaceSubscriptionId { get; private set; }

    /// <summary>Which part of the publisher app wrote the state.</summary>
    public SubscriptionEventSource Source { get; private set; }

    /// <summary>The fulfillment action, e.g. Resolve, Activate, Suspend, ChangePlan.</summary>
    public string Action { get; private set; }

    /// <summary>Optional extra shown next to the action, e.g. the new plan id.</summary>
    public string? Detail { get; private set; }

    /// <summary>When it happened (UTC).</summary>
    public DateTimeOffset At { get; private set; }
}
