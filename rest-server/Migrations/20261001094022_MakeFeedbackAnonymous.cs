using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestServer.Migrations
{
    /// <inheritdoc />
    public partial class MakeFeedbackAnonymous : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Feedback_Accounts_AccountId",
                table: "Feedback");

            migrationBuilder.DropIndex(
                name: "IX_Feedback_AccountId",
                table: "Feedback");

            migrationBuilder.DropIndex(
                name: "IX_Feedback_EventId_AccountId",
                table: "Feedback");

            migrationBuilder.DropColumn(
                name: "AccountId",
                table: "Feedback");

            migrationBuilder.CreateIndex(
                name: "IX_Feedback_EventId",
                table: "Feedback",
                column: "EventId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Feedback_EventId",
                table: "Feedback");

            migrationBuilder.AddColumn<int>(
                name: "AccountId",
                table: "Feedback",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Feedback_AccountId",
                table: "Feedback",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_Feedback_EventId_AccountId",
                table: "Feedback",
                columns: new[] { "EventId", "AccountId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Feedback_Accounts_AccountId",
                table: "Feedback",
                column: "AccountId",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
