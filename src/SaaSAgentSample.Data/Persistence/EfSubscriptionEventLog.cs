using Microsoft.EntityFrameworkCore;
using SaaSAgentSample.Core.Subscriptions;

namespace SaaSAgentSample.Data.Persistence;

/// <summary>
/// EF Core <see cref="ISubscriptionEventLog"/> over the same <see cref="SaasDbContext"/> the
/// subscription repository uses.
///
/// <see cref="Record"/> only stages the entry. Because the context is shared, the caller's
/// existing <c>SaveChangesAsync</c> commits the state change and its provenance together — the
/// ledger cannot end up holding a state whose cause was lost, which is the whole reason this is
/// durable rather than a screen-local trail.
/// </summary>
public sealed class EfSubscriptionEventLog : ISubscriptionEventLog
{
    private readonly SaasDbContext _db;
    private readonly TimeProvider _time;

    public EfSubscriptionEventLog(SaasDbContext db, TimeProvider? timeProvider = null)
    {
        _db = db ?? throw new ArgumentNullException(nameof(db));
        _time = timeProvider ?? TimeProvider.System;
    }

    public void Record(string marketplaceSubscriptionId, SubscriptionEventSource source, string action, string? detail = null)
    {
        if (string.IsNullOrWhiteSpace(marketplaceSubscriptionId) || string.IsNullOrWhiteSpace(action))
        {
            return;
        }

        _db.SubscriptionEvents.Add(new SubscriptionEvent(
            Guid.NewGuid(),
            marketplaceSubscriptionId,
            source,
            action,
            detail,
            _time.GetUtcNow()));
    }

    public IReadOnlyList<SubscriptionEvent> For(string marketplaceSubscriptionId)
    {
        if (string.IsNullOrWhiteSpace(marketplaceSubscriptionId))
        {
            return Array.Empty<SubscriptionEvent>();
        }

        // Order client-side, as EfSubscriptionRepository does and for the same reason: SQLite
        // (the arm64/dev fallback provider) cannot ORDER BY a DateTimeOffset column, so sorting
        // in the database would throw there. The index below narrows the read to one
        // subscription first, so the client-side sort only ever sees that subscription's trail.
        var entries = _db.SubscriptionEvents
            .Where(e => e.MarketplaceSubscriptionId == marketplaceSubscriptionId)
            .AsNoTracking()
            .ToList();

        return entries
            .OrderByDescending(e => e.At)
            .ToList();
    }

    public SubscriptionEvent? Latest(string marketplaceSubscriptionId)
        => For(marketplaceSubscriptionId).FirstOrDefault();
}
