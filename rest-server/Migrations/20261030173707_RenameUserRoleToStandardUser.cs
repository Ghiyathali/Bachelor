using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestServer.Migrations
{
    /// <inheritdoc />
    public partial class RenameUserRoleToStandardUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "Roles",
                keyColumn: "Id",
                keyValue: 4,
                column: "Name",
                value: "Standard User");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "Roles",
                keyColumn: "Id",
                keyValue: 4,
                column: "Name",
                value: "User");
        }
    }
}
