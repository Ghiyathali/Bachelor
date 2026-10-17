using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestServer.Migrations
{
    /// <inheritdoc />
    public partial class DecoupleRegistrationsFromAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_EventRegistrations_Accounts_AccountId",
                table: "EventRegistrations");

            migrationBuilder.DropIndex(
                name: "IX_EventRegistrations_AccountId",
                table: "EventRegistrations");

            migrationBuilder.DropIndex(
                name: "IX_EventRegistrations_EventId_AccountId",
                table: "EventRegistrations");

            migrationBuilder.DropColumn(
                name: "AccountId",
                table: "EventRegistrations");

            // Remove only the synthetic accounts created by the earlier dashboard seeder.
            // Their registration rows remain intact now that the foreign key is gone.
            migrationBuilder.Sql("""
                DELETE FROM "Accounts"
                WHERE "Username" LIKE 'dashboard-demo-attendee-%'
                  AND "Email" LIKE 'dashboard-demo-attendee-%@example.invalid';
                """);

            migrationBuilder.CreateIndex(
                name: "IX_EventRegistrations_EventId",
                table: "EventRegistrations",
                column: "EventId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Anonymous registrations cannot be mapped back to accounts during a downgrade.
            migrationBuilder.Sql("""DELETE FROM "EventRegistrations";""");

            migrationBuilder.DropIndex(
                name: "IX_EventRegistrations_EventId",
                table: "EventRegistrations");

            migrationBuilder.AddColumn<int>(
                name: "AccountId",
                table: "EventRegistrations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_EventRegistrations_AccountId",
                table: "EventRegistrations",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_EventRegistrations_EventId_AccountId",
                table: "EventRegistrations",
                columns: new[] { "EventId", "AccountId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_EventRegistrations_Accounts_AccountId",
                table: "EventRegistrations",
                column: "AccountId",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
