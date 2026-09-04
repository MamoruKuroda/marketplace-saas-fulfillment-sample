using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SaaSAgentSample.Data.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSubscriptionEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SubscriptionEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MarketplaceSubscriptionId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Source = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Action = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Detail = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    At = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubscriptionEvents", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionEvents_MarketplaceSubscriptionId_At",
                table: "SubscriptionEvents",
                columns: new[] { "MarketplaceSubscriptionId", "At" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SubscriptionEvents");
        }
    }
}
