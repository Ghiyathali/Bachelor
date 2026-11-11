namespace RestServer.Dashboard;

// FR-14 / #82: estimated attendance for a planned event, from past events of the same type.
// Level 1: the average of past events. Level 2: a simple linear regression over time.
// No machine learning (project delimitation 1) - just least squares you can do by hand.
public record PastEvent(DateTimeOffset StartsAt, int Accepted);

public record AttendanceEstimate(
    int BasedOnEvents,
    double? Average,   // level 1: mean accepted participants of past events
    int? Estimate,     // level 2: regression line at the planned date
    int? Low,          // estimate - typical error, never below 0
    int? High);        // estimate + typical error

public static class AttendanceEstimator
{
    // With 2 events a straight line always fits perfectly, so it looks certain but isn't.
    public const int MinPastEvents = 3;

    public static AttendanceEstimate Estimate(IReadOnlyList<PastEvent> past, DateTimeOffset plannedDate)
    {
        var n = past.Count;
        if (n < MinPastEvents)
            return new AttendanceEstimate(n, null, null, null, null);

        // x = days since the first past event, y = accepted participants.
        var first = past.Min(p => p.StartsAt);
        var xs = past.Select(p => (p.StartsAt - first).TotalDays).ToArray();
        var ys = past.Select(p => (double)p.Accepted).ToArray();
        var meanX = xs.Average();
        var meanY = ys.Average();

        // Least squares: the straight line with the smallest total squared error.
        var sumXX = xs.Sum(x => (x - meanX) * (x - meanX));
        var sumXY = xs.Zip(ys, (x, y) => (x - meanX) * (y - meanY)).Sum();
        // All events on the same day -> no direction in time, so the line is flat at the average.
        var slope = sumXX == 0 ? 0 : sumXY / sumXX;
        var intercept = meanY - slope * meanX;

        var plannedX = (plannedDate - first).TotalDays;
        var predicted = intercept + slope * plannedX;

        // Typical distance between past events and the line (standard error, n - 2 degrees of freedom).
        var squaredErrors = xs.Zip(ys, (x, y) => Math.Pow(y - (intercept + slope * x), 2)).Sum();
        var spread = Math.Sqrt(squaredErrors / (n - 2));

        return new AttendanceEstimate(
            n,
            Math.Round(meanY, 1),
            Whole(predicted),
            Whole(predicted - spread),
            Whole(predicted + spread));
    }

    // People are whole numbers, and a falling trend can never predict fewer than 0.
    private static int Whole(double value) =>
        (int)Math.Max(0, Math.Round(value, MidpointRounding.AwayFromZero));
}
