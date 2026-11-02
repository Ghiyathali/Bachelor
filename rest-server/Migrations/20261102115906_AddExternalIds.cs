using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestServer.Migrations
{
    /// <inheritdoc />
    public partial class AddExternalIds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ExternalId",
                table: "Events",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "ExternalId",
                table: "EventRegistrations",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Events_ExternalId",
                table: "Events",
                column: "ExternalId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EventRegistrations_ExternalId",
                table: "EventRegistrations",
                column: "ExternalId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Events_ExternalId",
                table: "Events");

            migrationBuilder.DropIndex(
                name: "IX_EventRegistrations_ExternalId",
                table: "EventRegistrations");

            migrationBuilder.DropColumn(
                name: "ExternalId",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "ExternalId",
                table: "EventRegistrations");
        }
    }
}
