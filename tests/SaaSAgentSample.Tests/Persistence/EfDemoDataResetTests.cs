using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using SaaSAgentSample.Core.Subscriptions;
using SaaSAgentSample.Data.Persistence;

namespace SaaSAgentSample.Tests.Persistence;

/// <summary>
/// The demo reset clears transactions, not the catalogue. There is no catalogue in this store to
/// protect - offers and plans belong to the Marketplace - so what these pin is that it takes the
/// provenance trail with it. The trail carries no foreign key by design, so clearing one side
/// alone would leave history describing subscriptions that no longer exist.
/// </summary>
public class EfDemoDataResetTests : IDisposable
{
    private static readonly DateTimeOffset Now = new(2026, 7, 16, 0, 0, 0, TimeSpan.Zero);

    private readonly SqliteConnection _connection;
    private readonly DbContextOptions<SaasDbContext> _options;

    public EfDemoDataResetTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        _options = new DbContextOptionsBuilder<SaasDbContext>()
            .UseSqlite(_connection)
            .Options;

        using var seedContext = new SaasDbContext(_options);
        seedContext.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _connection.Dispose();
        GC.SuppressFinalize(this);
    }

    private async Task SeedAsync(params string[] marketplaceIds)
    {
        await using var db = new SaasDbContext(_options);
        var repo = new EfSubscriptionRepository(db);
        var log = new EfSubscriptionEventLog(db);

        foreach (var id in marketplaceIds)
        {
            await repo.AddAsync(new Subscription(Guid.NewGuid(), id, "offer-x", "plan-basic", Now));
            log.Record(id, SubscriptionEventSource.Landing, "Resolve", "plan-basic");
        }

        await repo.SaveChangesAsync();
    }

    [Fact]
    public async Task Clears_subscriptions_and_takes_their_history_with_them()
    {
        await SeedAsync("mkt-1", "mkt-2");

        await using (var db = new SaasDbContext(_options))
        {
            Assert.Equal(2, await new EfDemoDataReset(db).ClearSubscriptionsAsync());
        }

        await using var reader = new SaasDbContext(_options);
        Assert.Empty(await reader.Subscriptions.ToListAsync());
        Assert.Empty(await reader.SubscriptionEvents.ToListAsync());
    }

    [Fact]
    public async Task Is_safe_to_run_on_an_empty_store()
    {
        await using var db = new SaasDbContext(_options);
        Assert.Equal(0, await new EfDemoDataReset(db).ClearSubscriptionsAsync());
    }

    [Fact]
    public async Task Leaves_the_store_usable_afterwards()
    {
        await SeedAsync("mkt-1");

        await using (var db = new SaasDbContext(_options))
        {
            await new EfDemoDataReset(db).ClearSubscriptionsAsync();
        }

        // The same Marketplace id can be resolved again: the unique index is free once more.
        await SeedAsync("mkt-1");

        await using var reader = new SaasDbContext(_options);
        Assert.Single(await reader.Subscriptions.ToListAsync());
        Assert.Single(new EfSubscriptionEventLog(reader).For("mkt-1"));
    }
}
