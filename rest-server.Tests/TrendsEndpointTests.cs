using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RestServer.Controllers;
using RestServer.Data;
using RestServer.Models;

namespace RestServer.Tests;

// ApiFactory configures process-wide environment variables; fixtures must run serially.
[Collection("API integration")]
public class TrendsEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Trends_MatchMonthlySql_RespectFiltersAndPreserveGaps()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        // #25 / NFR-02: groups of fewer than 5 people are hidden, so every rating and sign-up
        // is created 5 times. Averages stay the same; counts are 5x and therefore visible.
        const int copies = 5;
        Event MakeEvent(string date, int[] ratings, params RegistrationStatus[] statuses) => new()
        {
            Name = "Trend check", StartsAt = DateTimeOffset.Parse(date).ToUniversalTime(),
            EndsAt = DateTimeOffset.Parse(date).ToUniversalTime().AddHours(2),
            // Deliberately submitted later: grouping must use the event date.
            Feedback = Enumerable.Repeat(ratings, copies).SelectMany(r => r)
                .Select(r => new Feedback { Rating = r, CreatedAt = DateTimeOffset.Parse("2036-01-01T00:00:00Z") }).ToList(),
            Registrations = Enumerable.Repeat(statuses, copies).SelectMany(s => s)
                .Select(s => new EventRegistration { Status = s }).ToList(),
        };
        var first = MakeEvent("2035-01-01T00:00:00Z", [5, 5], RegistrationStatus.Accepted,
            RegistrationStatus.Accepted, RegistrationStatus.Waiting, RegistrationStatus.Rejected);
        var second = MakeEvent("2035-02-01T00:30:00+01:00", [1], RegistrationStatus.Accepted);
        db.Events.AddRange(first, second,
            MakeEvent("2035-03-01T00:00:00Z", [], RegistrationStatus.Pending),
            MakeEvent("2035-04-30T23:59:59Z", [2]),
            MakeEvent("2035-05-01T00:00:00Z", [4], RegistrationStatus.Accepted),
            MakeEvent("2034-12-01T00:00:00Z", [3], RegistrationStatus.Accepted));
        await db.SaveChangesAsync();

        using var client = await factory.CreateAdminClientAsync();
        var monthly = await client.GetFromJsonAsync<TrendsResponse>(
            "/api/dashboard/trends?from=2035-01-01&to=2035-04-30");
        Assert.NotNull(monthly);
        Assert.Equal(4, monthly.Periods.Count);
        Assert.Equal(11.0 / 3, monthly.Periods[0].AverageSatisfaction);
        Assert.Equal(3 * copies, monthly.Periods[0].Participants);
        Assert.Equal(new TrendPoint(new DateOnly(2035, 2, 1), 0, null, null, null), monthly.Periods[1]);
        Assert.Null(monthly.Periods[2].AverageSatisfaction);
        Assert.Null(monthly.Periods[2].Participants); // 0 accepted: fewer than 5, so hidden
        Assert.Equal(2, monthly.Periods[3].AverageSatisfaction);

        // Independent, manually written monthly SQL: aggregate each child table first
        // so feedback and registrations cannot multiply each other.
        var sql = await db.Database.SqlQueryRaw<MonthlyCheck>("""
            WITH feedback AS (
                SELECT "EventId", count(*) AS responses, sum("Rating") AS rating_sum
                FROM "Feedback" GROUP BY "EventId"
            ), participants AS (
                SELECT "EventId", count(*) AS accepted
                FROM "EventRegistrations" WHERE "Status" = 1 GROUP BY "EventId"
            )
            SELECT date_trunc('month', e."StartsAt" AT TIME ZONE 'UTC')::date AS "PeriodStart",
                   count(*)::int AS "EventCount",
                   coalesce(sum(f.responses), 0)::int AS "FeedbackResponses",
                   sum(f.rating_sum)::double precision / nullif(sum(f.responses), 0)::double precision AS "AverageSatisfaction",
                   coalesce(sum(p.accepted), 0)::int AS "Participants"
            FROM "Events" e
            LEFT JOIN feedback f ON f."EventId" = e."Id"
            LEFT JOIN participants p ON p."EventId" = e."Id"
            WHERE e."StartsAt" >= '2035-01-01T00:00:00Z'::timestamptz
              AND e."StartsAt" < '2035-05-01T00:00:00Z'::timestamptz
            GROUP BY 1 ORDER BY 1
            """).ToListAsync();
        // The SQL returns raw numbers, so apply the same NFR-02 rule before comparing.
        int? Hide(int count) => count >= 5 ? count : null;
        foreach (var row in sql)
            Assert.Equal(new TrendPoint(row.PeriodStart, row.EventCount, Hide(row.FeedbackResponses),
                row.FeedbackResponses >= 5 ? row.AverageSatisfaction : null,
                row.EventCount == 0 ? null : Hide(row.Participants)),
                monthly.Periods.Single(p => p.PeriodStart == row.PeriodStart));

        var filtered = await client.GetFromJsonAsync<TrendsResponse>(
            $"/api/dashboard/trends?eventId={first.Id}&from=2035-01-01&to=2035-04-30");
        Assert.Equal(5, filtered!.Periods[0].AverageSatisfaction);
        Assert.Equal(2 * copies, filtered.Periods[0].Participants);
        Assert.All(filtered.Periods.Skip(1), p => Assert.Null(p.Participants));

        var seasonal = await client.GetFromJsonAsync<TrendsResponse>(
            "/api/dashboard/trends?interval=season&from=2034-12-01&to=2035-04-30");
        Assert.Equal(2, seasonal!.Periods.Count);
        Assert.Equal(new DateOnly(2034, 12, 1), seasonal.Periods[0].PeriodStart);
        Assert.Equal(3.5, seasonal.Periods[0].AverageSatisfaction); // (3 + 5 + 5 + 1) / 4
        Assert.Equal(4 * copies, seasonal.Periods[0].Participants);
        Assert.Equal(2, seasonal.Periods[1].AverageSatisfaction);

        var empty = await client.GetFromJsonAsync<TrendsResponse>(
            "/api/dashboard/trends?from=2040-01-01&to=2040-03-31");
        Assert.Equal(3, empty!.Periods.Count);
        Assert.All(empty.Periods, p => { Assert.Null(p.Participants); Assert.Null(p.AverageSatisfaction); });
    }

    [Theory]
    [InlineData("interval=week")]
    [InlineData("from=2035-04-01&to=2035-01-01")]
    [InlineData("from=bad-date")]
    [InlineData("from=1800-01-01&to=2035-01-01")]
    public async Task Trends_RejectInvalidFilters(string query)
    {
        using var client = await factory.CreateAdminClientAsync();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"/api/dashboard/trends?{query}")).StatusCode);
    }

    [Fact]
    public async Task Trends_RequiresAuthentication()
    {
        using var client = factory.CreateHttpsClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/dashboard/trends")).StatusCode);
    }

    public class MonthlyCheck
    {
        public DateOnly PeriodStart { get; set; }
        public int EventCount { get; set; }
        public int FeedbackResponses { get; set; }
        public double? AverageSatisfaction { get; set; }
        public int Participants { get; set; }
    }
}
