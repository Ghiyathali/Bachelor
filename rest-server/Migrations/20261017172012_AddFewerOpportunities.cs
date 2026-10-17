using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestServer.Migrations
{
    /// <inheritdoc />
    public partial class AddFewerOpportunities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "FewerOpportunities",
                table: "EventRegistrations",
                type: "boolean",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FewerOpportunities",
                table: "EventRegistrations");
        }
    }
}
