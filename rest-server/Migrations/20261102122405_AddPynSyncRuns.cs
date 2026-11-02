using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace RestServer.Migrations
{
    /// <inheritdoc />
    public partial class AddPynSyncRuns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PynSyncRuns",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TriggeredBy = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    FinishedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    Succeeded = table.Column<bool>(type: "boolean", nullable: false),
                    EventsRead = table.Column<int>(type: "integer", nullable: false),
                    EventsInserted = table.Column<int>(type: "integer", nullable: false),
                    EventsUpdated = table.Column<int>(type: "integer", nullable: false),
                    EventsSkipped = table.Column<int>(type: "integer", nullable: false),
                    EventTypesCreated = table.Column<int>(type: "integer", nullable: false),
                    RegistrationsRead = table.Column<int>(type: "integer", nullable: false),
                    RegistrationsInserted = table.Column<int>(type: "integer", nullable: false),
                    RegistrationsUpdated = table.Column<int>(type: "integer", nullable: false),
                    RegistrationsEventNotFound = table.Column<int>(type: "integer", nullable: false),
                    RegistrationsEventAmbiguous = table.Column<int>(type: "integer", nullable: false),
                    RegistrationsUnknownStatus = table.Column<int>(type: "integer", nullable: false),
                    Error = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PynSyncRuns", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PynSyncRuns_StartedAt",
                table: "PynSyncRuns",
                column: "StartedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PynSyncRuns");
        }
    }
}
