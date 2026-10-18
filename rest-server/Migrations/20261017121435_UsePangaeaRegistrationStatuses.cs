using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestServer.Migrations
{
    /// <inheritdoc />
    public partial class UsePangaeaRegistrationStatuses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_EventRegistrations_Status",
                table: "EventRegistrations");

            migrationBuilder.AddCheckConstraint(
                name: "CK_EventRegistrations_Status",
                table: "EventRegistrations",
                sql: "\"Status\" BETWEEN 0 AND 3");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_EventRegistrations_Status",
                table: "EventRegistrations");

            migrationBuilder.AddCheckConstraint(
                name: "CK_EventRegistrations_Status",
                table: "EventRegistrations",
                sql: "\"Status\" BETWEEN 0 AND 2");
        }
    }
}
