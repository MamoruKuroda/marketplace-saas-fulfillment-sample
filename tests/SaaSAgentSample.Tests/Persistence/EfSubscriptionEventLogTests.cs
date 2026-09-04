using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using SaaSAgentSample.Core.Subscriptions;
using SaaSAgentSample.Data.Persistence;

namespace SaaSAgentSample.Tests.Persistence;

/// <summary>
/// The provenance trail is part of the ledger, so these tests pin the two properties that make
/// it one: entries survive the process, and <c>Record</c> only stages — it cannot commit on its
/// own, which is what lets a state change and its cause land in a single transaction.
/// </summary>
public class EfSubscriptionEventLogTests : IDisposable
{
    private static readonly DateTimeOffset Now = new(2026, 7, 16, 0, 0, 0, TimeSpan.Zero);

    private readonly SqliteConnection _connection;
    private readonly DbContextOptions<SaasDbContext> _options;

    public EfSubscriptionEventLogTests()
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

    [Fact]
    public async Task Recorded_entry_survives_the_context_that_wrote_it()
    {
        await using (var db = new SaasDbContext(_options))
        {
            new EfSubscriptionEventLog(db, new FixedTime(Now))
                .Record("mkt-42", SubscriptionEventSource.Webhook, "Suspend");
            await db.SaveChangesAsync();
        }

        await using var reader = new SaasDbContext(_options);
        var entry = Assert.Single(new EfSubscriptionEventLog(reader).For("mkt-42"));

        Assert.Equal(SubscriptionEventSource.Webhook, entry.Source);
        Assert.Equal("Suspend", entry.Action);
        Assert.Equal(Now, entry.At);
    }

    [Fact]
    public async Task Record_stages_only_so_it_rides_the_callers_transaction()
    {
        await using (var db = new SaasDbContext(_options))
        {
            // No SaveChangesAsync: a caller that abandons the unit of work must leave no trail.
            new EfSubscriptionEventLog(db, new FixedTime(Now))
                .Record("mkt-42", SubscriptionEventSource.Webhook, "Suspend");
        }

        await using var reader = new SaasDbContext(_options);
        Assert.Empty(new EfSubscriptionEventLog(reader).For("mkt-42"));
    }

    [Fact]
    public async Task State_and_its_cause_commit_together()
    {
        var id = Guid.NewGuid();

        await using (var db = new SaasDbContext(_options))
        {
            var repo = new EfSubscriptionRepository(db);
            var log = new EfSubscriptionEventLog(db, new FixedTime(Now));

            var sub = new Subscription(id, "mkt-42", "offer-x", "plan-basic", Now);
            await repo.AddAsync(sub);
            log.Record("mkt-42", SubscriptionEventSource.Landing, "Resolve", "plan-basic");

            // One save, both rows.
            await repo.SaveChangesAsync();
        }

        await using var reader = new SaasDbContext(_options);
        Assert.NotNull(await new EfSubscriptionRepository(reader).GetByMarketplaceSubscriptionIdAsync("mkt-42"));
        Assert.Single(new EfSubscriptionEventLog(reader).For("mkt-42"));
    }

    [Fact]
    public async Task Trail_reads_newest_first_and_is_scoped_to_one_subscription()
    {
        await using (var db = new SaasDbContext(_options))
        {
            new EfSubscriptionEventLog(db, new FixedTime(Now))
                .Record("mkt-42", SubscriptionEventSource.Landing, "Resolve");
            await db.SaveChangesAsync();

            new EfSubscriptionEventLog(db, new FixedTime(Now.AddMinutes(1)))
                .Record("mkt-42", SubscriptionEventSource.Landing, "Activate");
            new EfSubscriptionEventLog(db, new FixedTime(Now.AddMinutes(2)))
                .Record("mkt-99", SubscriptionEventSource.Webhook, "Unsubscribe");
            await db.SaveChangesAsync();
        }

        await using var reader = new SaasDbContext(_options);
        var log = new EfSubscriptionEventLog(reader);

        Assert.Equal(new[] { "Activate", "Resolve" }, log.For("mkt-42").Select(e => e.Action));
        Assert.Equal("Activate", log.Latest("mkt-42")?.Action);
        Assert.Equal("Unsubscribe", log.Latest("mkt-99")?.Action);
    }

    [Fact]
    public void Latest_is_null_when_nothing_was_recorded()
    {
        using var db = new SaasDbContext(_options);
        Assert.Null(new EfSubscriptionEventLog(db).Latest("mkt-unknown"));
    }

    private sealed class FixedTime(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
