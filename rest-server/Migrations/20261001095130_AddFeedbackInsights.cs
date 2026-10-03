using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestServer.Migrations
{
    /// <inheritdoc />
    public partial class AddFeedbackInsights : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "InclusionRating",
                table: "Feedback",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UsefulnessRating",
                table: "Feedback",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WhatCouldBeImproved",
                table: "Feedback",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WhatWorkedWell",
                table: "Feedback",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Feedback_InclusionRating",
                table: "Feedback",
                sql: "\"InclusionRating\" BETWEEN 1 AND 5");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Feedback_UsefulnessRating",
                table: "Feedback",
                sql: "\"UsefulnessRating\" BETWEEN 1 AND 5");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Feedback_InclusionRating",
                table: "Feedback");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Feedback_UsefulnessRating",
                table: "Feedback");

            migrationBuilder.DropColumn(
                name: "InclusionRating",
                table: "Feedback");

            migrationBuilder.DropColumn(
                name: "UsefulnessRating",
                table: "Feedback");

            migrationBuilder.DropColumn(
                name: "WhatCouldBeImproved",
                table: "Feedback");

            migrationBuilder.DropColumn(
                name: "WhatWorkedWell",
                table: "Feedback");
        }
    }
}
