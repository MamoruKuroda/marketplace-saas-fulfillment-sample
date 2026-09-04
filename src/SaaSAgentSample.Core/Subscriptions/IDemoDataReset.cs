namespace SaaSAgentSample.Core.Subscriptions;

/// <summary>
/// Clears the demo's transaction data so a run can start from a clean slate.
///
/// <para>Deliberately not a method on <see cref="ISubscriptionRepository"/>: the repository is
/// the ledger's contract, and "wipe the ledger" is not a ledger operation. This is a demo
/// affordance, kept separate and named so, and it is only reachable when the host explicitly
/// enables it.</para>
///
/// <para>It removes subscriptions and their provenance trail together. There is no catalogue to
/// protect on this side — offers and plans belong to the Marketplace (the emulator), not to the
/// publisher's store, so a reset can never cost you what you sell.</para>
/// </summary>
public interface IDemoDataReset
{
    /// <summary>
    /// Deletes every subscription and every provenance entry, in one transaction. Returns how
    /// many subscriptions were removed.
    /// </summary>
    Task<int> ClearSubscriptionsAsync(CancellationToken cancellationToken = default);
}
