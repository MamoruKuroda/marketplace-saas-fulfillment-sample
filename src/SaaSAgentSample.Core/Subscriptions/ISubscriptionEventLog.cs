namespace SaaSAgentSample.Core.Subscriptions;

/// <summary>
/// The provenance trail for the subscription state store: what wrote each state, and when.
///
/// <para><see cref="Record"/> stages an entry; it does not commit. The caller commits it with
/// the same <see cref="ISubscriptionRepository.SaveChangesAsync"/> that persists the state
/// change, so a subscription can never end up in a state whose cause was lost. Record before
/// you save.</para>
///
/// <para>Nothing reads this to make a decision — entitlement and state transitions come from
/// <see cref="Subscription"/> alone. The trail exists so the ledger can answer "why", which a
/// publisher needs for support, reconciliation against Microsoft's records, and audit.</para>
/// </summary>
public interface ISubscriptionEventLog
{
    /// <summary>Stages an entry. Committed by the next <c>SaveChangesAsync</c> on the same unit of work.</summary>
    void Record(string marketplaceSubscriptionId, SubscriptionEventSource source, string action, string? detail = null);

    /// <summary>Entries for one subscription, newest first.</summary>
    IReadOnlyList<SubscriptionEvent> For(string marketplaceSubscriptionId);

    /// <summary>The most recent entry for one subscription, or null when nothing is recorded.</summary>
    SubscriptionEvent? Latest(string marketplaceSubscriptionId);
}
