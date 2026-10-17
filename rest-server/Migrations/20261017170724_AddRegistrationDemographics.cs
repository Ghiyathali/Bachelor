using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestServer.Migrations
{
    /// <inheritdoc />
    public partial class AddRegistrationDemographics : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AgeBand",
                table: "EventRegistrations",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AttendedBefore",
                table: "EventRegistrations",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "City",
                table: "EventRegistrations",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "EventRegistrations",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HeardAbout",
                table: "EventRegistrations",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Nationality",
                table: "EventRegistrations",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_EventRegistrations_AgeBand",
                table: "EventRegistrations",
                sql: "\"AgeBand\" IS NULL OR \"AgeBand\" BETWEEN 0 AND 3");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_EventRegistrations_AgeBand",
                table: "EventRegistrations");

            migrationBuilder.DropColumn(
                name: "AgeBand",
                table: "EventRegistrations");

            migrationBuilder.DropColumn(
                name: "AttendedBefore",
                table: "EventRegistrations");

            migrationBuilder.DropColumn(
                name: "City",
                table: "EventRegistrations");

            migrationBuilder.DropColumn(
                name: "Gender",
                table: "EventRegistrations");

            migrationBuilder.DropColumn(
                name: "HeardAbout",
                table: "EventRegistrations");

            migrationBuilder.DropColumn(
                name: "Nationality",
                table: "EventRegistrations");
        }
    }
}
