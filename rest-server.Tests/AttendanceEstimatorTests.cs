using RestServer.Dashboard;

namespace RestServer.Tests;

public class AttendanceEstimatorTests
{
    private static readonly DateTimeOffset Start = new(2030, 1, 1, 0, 0, 0, TimeSpan.Zero);

    private static PastEvent At(int day, int accepted) => new(Start.AddDays(day), accepted);

    [Fact]
    public void FewerThanThreeEvents_GivesNoEstimate()
    {
        var result = AttendanceEstimator.Estimate([At(0, 10), At(30, 20)], Start.AddDays(60));

        Assert.Equal(new AttendanceEstimate(2, null, null, null, null), result);
    }

    [Fact]
    public void FlatHistory_EstimatesTheAverage()
    {
        var result = AttendanceEstimator.Estimate([At(0, 20), At(30, 20), At(60, 20)], Start.AddDays(90));

        Assert.Equal(new AttendanceEstimate(3, 20, 20, 20, 20), result);
    }

    [Fact]
    public void PerfectRisingTrend_ContinuesTheLine()
    {
        // +10 every 30 days -> day 90 gives 40, with no error around the line.
        var result = AttendanceEstimator.Estimate([At(0, 10), At(30, 20), At(60, 30)], Start.AddDays(90));

        Assert.Equal(new AttendanceEstimate(3, 20, 40, 40, 40), result);
    }

    [Fact]
    public void NoisyTrend_GivesRangeAroundTheLine()
    {
        // Line: 10.6 + 0.32 * day -> day 120 = 49. Standard error = 1.90 -> 47..51.
        var result = AttendanceEstimator.Estimate(
            [At(0, 10), At(30, 22), At(60, 28), At(90, 40)], Start.AddDays(120));

        Assert.Equal(new AttendanceEstimate(4, 25, 49, 47, 51), result);
    }

    [Fact]
    public void AllEventsOnSameDay_FallsBackToTheAverage()
    {
        var result = AttendanceEstimator.Estimate([At(0, 10), At(0, 20), At(0, 30)], Start.AddDays(30));

        Assert.Equal(20, result.Estimate);
        Assert.Equal(20, result.Average);
    }

    [Fact]
    public void FallingTrend_IsNeverBelowZero()
    {
        // 30, 20, 10 -> the line hits -30 at day 180.
        var result = AttendanceEstimator.Estimate([At(0, 30), At(30, 20), At(60, 10)], Start.AddDays(180));

        Assert.Equal(new AttendanceEstimate(3, 20, 0, 0, 0), result);
    }
}
