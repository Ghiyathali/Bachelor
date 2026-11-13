using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestServer.Migrations
{
    /// <inheritdoc />
    public partial class AddEventWalkIns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "WalkIns",
                table: "Events",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Events_WalkIns",
                table: "Events",
                sql: "\"WalkIns\" >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Events_WalkIns",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "WalkIns",
                table: "Events");
        }
    }
}
