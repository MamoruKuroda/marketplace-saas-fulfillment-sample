namespace SaaSAgentSample.Web.Services;

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

/// <param name="MarketplaceSubscriptionId">Subscription the entry belongs to.</param>
/// <param name="Source">Which part of the publisher app wrote the state.</param>
/// <param name="Action">The fulfillment action, e.g. Resolve, Activate, Suspend, ChangePlan.</param>
/// <param name="Detail">Optional extra shown next to the action, e.g. the new plan id.</param>
/// <param name="At">When it was recorded (UTC).</param>
public sealed record SubscriptionEvent(
    string MarketplaceSubscriptionId,
    SubscriptionEventSource Source,
    string Action,
    string? Detail,
    DateTimeOffset At);

/// <summary>
/// Display-only "what last wrote this state" trail for the publisher admin.
///
/// This is a TEACHING AID, not a system of record. It is deliberately:
/// <list type="bullet">
///   <item>in memory only — it clears on restart, redeploy, or scale-out;</item>
///   <item>never read by any decision — entitlement and state transitions come from the
///     subscription state store alone;</item>
///   <item>append-only after the fact — recording an entry cannot change what happened.</item>
/// </list>
/// The durable trail is the application log (and, for state itself, the state store).
/// The admin UI says so on screen, because "the screen history is volatile, the state store
/// is not" is the point the sample is making.
/// </summary>
public interface ISubscriptionEventLog
{
    void Record(string marketplaceSubscriptionId, SubscriptionEventSource source, string action, string? detail = null);

    /// <summary>Entries for one subscription, newest first.</summary>
    IReadOnlyList<SubscriptionEvent> For(string marketplaceSubscriptionId);

    /// <summary>The most recent entry for one subscription, or null when nothing is recorded.</summary>
    SubscriptionEvent? Latest(string marketplaceSubscriptionId);
}

/// <summary>
/// Bounded in-memory <see cref="ISubscriptionEventLog"/>. Registered as a singleton so a demo
/// session accumulates a visible trail; the bound keeps a long-running demo from growing without
/// limit. Oldest entries are dropped first.
/// </summary>
public sealed class InMemorySubscriptionEventLog : ISubscriptionEventLog
{
    /// <summary>Entries retained across all subscriptions before the oldest is dropped.</summary>
    public const int Capacity = 200;

    private readonly Queue<SubscriptionEvent> _entries = new();
    private readonly Lock _gate = new();
    private readonly TimeProvider _time;

    public InMemorySubscriptionEventLog(TimeProvider? timeProvider = null)
        => _time = timeProvider ?? TimeProvider.System;

    public void Record(string marketplaceSubscriptionId, SubscriptionEventSource source, string action, string? detail = null)
    {
        if (string.IsNullOrWhiteSpace(marketplaceSubscriptionId) || string.IsNullOrWhiteSpace(action))
        {
            return;
        }

        var entry = new SubscriptionEvent(marketplaceSubscriptionId, source, action, detail, _time.GetUtcNow());

        lock (_gate)
        {
            _entries.Enqueue(entry);
            while (_entries.Count > Capacity)
            {
                _entries.Dequeue();
            }
        }
    }

    public IReadOnlyList<SubscriptionEvent> For(string marketplaceSubscriptionId)
    {
        if (string.IsNullOrWhiteSpace(marketplaceSubscriptionId))
        {
            return Array.Empty<SubscriptionEvent>();
        }

        lock (_gate)
        {
            return _entries
                .Where(e => string.Equals(e.MarketplaceSubscriptionId, marketplaceSubscriptionId, StringComparison.OrdinalIgnoreCase))
                .Reverse()
                .ToArray();
        }
    }

    public SubscriptionEvent? Latest(string marketplaceSubscriptionId) => For(marketplaceSubscriptionId).FirstOrDefault();
}
