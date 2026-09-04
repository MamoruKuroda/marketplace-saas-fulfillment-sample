using Microsoft.EntityFrameworkCore;
using SaaSAgentSample.Core.Subscriptions;

namespace SaaSAgentSample.Data.Persistence;

/// <summary>
/// EF Core <see cref="IDemoDataReset"/>. Deletes the trail and its subjects in one
/// <c>SaveChangesAsync</c>, for the same reason they are written in one: the provenance table
/// carries no foreign key by design, so clearing only one side would leave a trail describing
/// subscriptions that no longer exist.
/// </summary>
public sealed class EfDemoDataReset : IDemoDataReset
{
    private readonly SaasDbContext _db;

    public EfDemoDataReset(SaasDbContext db) => _db = db ?? throw new ArgumentNullException(nameof(db));

    public async Task<int> ClearSubscriptionsAsync(CancellationToken cancellationToken = default)
    {
        // Loaded rather than bulk-deleted: ExecuteDelete is not supported on the InMemory
        // provider the tests and the in-memory demo mode use, and a demo store is small.
        var subscriptions = await _db.Subscriptions.ToListAsync(cancellationToken).ConfigureAwait(false);
        var events = await _db.SubscriptionEvents.ToListAsync(cancellationToken).ConfigureAwait(false);

        _db.SubscriptionEvents.RemoveRange(events);
        _db.Subscriptions.RemoveRange(subscriptions);
        await _db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        return subscriptions.Count;
    }
}
