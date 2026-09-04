using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SaaSAgentSample.Core.Subscriptions;

namespace SaaSAgentSample.Data.Persistence.Configurations;

/// <summary>
/// EF Core mapping for <see cref="SubscriptionEvent"/>. Like the subscription's own state, the
/// <c>Source</c> column is persisted as its string name so a downstream reader never depends on
/// the numeric ordinal of the enum.
///
/// There is no foreign key to Subscriptions on purpose: the trail is append-only and outlives
/// what it describes, so a cancelled subscription that is later purged still leaves its history.
/// The schema fits both SQL Server (authoritative migration) and SQLite (EnsureCreated).
/// </summary>
internal sealed class SubscriptionEventConfiguration : IEntityTypeConfiguration<SubscriptionEvent>
{
    public void Configure(EntityTypeBuilder<SubscriptionEvent> builder)
    {
        builder.ToTable("SubscriptionEvents");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .ValueGeneratedNever();

        builder.Property(e => e.MarketplaceSubscriptionId)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(e => e.Source)
            .IsRequired()
            .HasMaxLength(64)
            .HasConversion<string>();

        builder.Property(e => e.Action)
            .IsRequired()
            .HasMaxLength(64);

        builder.Property(e => e.Detail)
            .HasMaxLength(200);

        builder.Property(e => e.At)
            .IsRequired();

        // Reads are always "the trail for one subscription, newest first".
        builder.HasIndex(e => new { e.MarketplaceSubscriptionId, e.At })
            .HasDatabaseName("IX_SubscriptionEvents_MarketplaceSubscriptionId_At");
    }
}
