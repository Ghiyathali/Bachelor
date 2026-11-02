using RestServer.Models;
using RestServer.Sync;
using static RestServer.Sync.PynMapping;

namespace RestServer.Tests;

// #69: the conversion rules of the PYN sync. Pure functions - no database, no Docker needed.
public class PynMappingTests
{
    // ---------- Age band ----------

    [Theory]
    [InlineData("Under18", AgeBand.Under18)]
    [InlineData("From18To24", AgeBand.From18To24)]
    [InlineData("From25To30", AgeBand.From25To30)]
    [InlineData(" Over30 ", AgeBand.Over30)]
    [InlineData("under18", null)]   // only the exact names from the view
    [InlineData("2", null)]         // a number is not a band name
    [InlineData("", null)]
    [InlineData(null, null)]
    public void ParseAgeBand_AcceptsOnlyTheViewsBandNames(string? input, AgeBand? expected) =>
        Assert.Equal(expected, ParseAgeBand(input));

    // ---------- Status ----------

    [Theory]
    [InlineData("Accepted", RegistrationStatus.Accepted)]
    [InlineData(" pending ", RegistrationStatus.Pending)]
    [InlineData("WAITING", RegistrationStatus.Waiting)]
    [InlineData("Rejected", RegistrationStatus.Rejected)]
    [InlineData("Attended", null)]   // PYN has no such status
    [InlineData(null, null)]
    public void ParseStatus_MapsPynsFourStatuses(string? input, RegistrationStatus? expected) =>
        Assert.Equal(expected, ParseStatus(input));

    // ---------- Text ----------

    [Theory]
    [InlineData("  horsens ", "Horsens")]
    [InlineData("danish ", "Danish")]
    [InlineData("  aarhus", "Aarhus")]
    [InlineData("new   york", "New York")]
    [InlineData("", null)]
    [InlineData("   ", null)]
    [InlineData(null, null)]
    public void CleanText_TidiesSpacesAndCapitalises(string? input, string? expected) =>
        Assert.Equal(expected, CleanText(input, 100));

    [Fact]
    public void CleanText_CutsToMaxLength() =>
        Assert.Equal(100, CleanText(new string('a', 150), 100)!.Length);

    [Theory]
    [InlineData("  Language   café ", "Language café")]
    [InlineData("workshop", "workshop")]   // letter case kept
    [InlineData("  ", null)]
    public void CleanName_TidiesSpacesButKeepsLetterCase(string? input, string? expected) =>
        Assert.Equal(expected, CleanName(input, 100));

    // ---------- Dates ----------

    [Theory]
    [InlineData("2026-09-10", "2026-09-10T00:00:00+00:00")]
    [InlineData("2026-10-14T18:00", "2026-10-14T18:00:00+00:00")]
    [InlineData(" 2026-10-14 18:00:00 ", "2026-10-14T18:00:00+00:00")]
    [InlineData("2026-10-14T18:00:00+02:00", "2026-10-14T16:00:00+00:00")]
    public void ParseEventDate_ReadsIsoDates(string input, string expectedUtc) =>
        Assert.Equal(DateTimeOffset.Parse(expectedUtc), ParseEventDate(input));

    [Theory]
    [InlineData("10/09/2026")]   // ambiguous format - not guessed
    [InlineData("soon")]
    [InlineData("")]
    [InlineData(null)]
    public void ParseEventDate_RejectsAnythingElse(string? input) =>
        Assert.Null(ParseEventDate(input));

    // ---------- Matching (same situation as the mock PYN data) ----------

    private static readonly EventCandidate[] Events =
    [
        new(1, "Reggaeton Dance Workshop", new DateTimeOffset(2026, 9, 10, 0, 0, 0, TimeSpan.Zero)),
        new(7, "Reggaeton Dance Workshop", new DateTimeOffset(2026, 10, 28, 0, 0, 0, TimeSpan.Zero)),
        new(2, "Running Club", new DateTimeOffset(2026, 9, 15, 0, 0, 0, TimeSpan.Zero)),
    ];

    [Fact]
    public void MatchEvent_UniqueName_MatchesIgnoringCaseAndSpaces() =>
        Assert.Equal(new EventMatch(MatchOutcome.Matched, 2), MatchEvent(Events, "  running   CLUB ", null));

    [Fact]
    public void MatchEvent_SameNameTwice_UsesTheSignUpDate() =>
        Assert.Equal(new EventMatch(MatchOutcome.Matched, 7),
            MatchEvent(Events, "Reggaeton Dance Workshop", new DateOnly(2026, 10, 28)));

    [Fact]
    public void MatchEvent_SameNameTwiceWithoutDate_IsAmbiguous() =>
        Assert.Equal(MatchOutcome.Ambiguous, MatchEvent(Events, "Reggaeton Dance Workshop", null).Outcome);

    [Fact]
    public void MatchEvent_SameNameTwiceOnAnotherDay_IsAmbiguous() =>
        Assert.Equal(MatchOutcome.Ambiguous,
            MatchEvent(Events, "Reggaeton Dance Workshop", new DateOnly(2026, 1, 1)).Outcome);

    [Theory]
    [InlineData("Raggeaton Dance Workshop")]   // the typo from PYN's website
    [InlineData("Halloween Party")]            // draft event, not synced
    [InlineData("")]
    public void MatchEvent_UnknownName_IsNotFound(string name) =>
        Assert.Equal(MatchOutcome.NotFound, MatchEvent(Events, name, new DateOnly(2026, 10, 28)).Outcome);
}
