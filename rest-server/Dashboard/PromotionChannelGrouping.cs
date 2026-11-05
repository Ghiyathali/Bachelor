namespace RestServer.Dashboard;

// FR-10: one bar per promotion channel ("How did you hear about Pangaea?").
public record ChannelCount(string Channel, int? Count);

// NFR-02: a channel chosen by fewer than 5 people is not shown on its own.
// It is merged into "Other" (together with people who picked "Other" on the form),
// and if "Other" is still below 5, its count is hidden too (null).
public static class PromotionChannelGrouping
{
    public const string Other = "Other";

    public static IReadOnlyList<ChannelCount> Group(IEnumerable<(string Channel, int Count)> counts)
    {
        var withPeople = counts.Where(c => c.Count > 0).ToList();

        var channels = withPeople
            .Where(c => c.Count >= DashboardFilter.MinGroupSize && !IsOther(c.Channel))
            .OrderByDescending(c => c.Count)
            .ThenBy(c => c.Channel, StringComparer.OrdinalIgnoreCase)
            .Select(c => new ChannelCount(c.Channel, c.Count))
            .ToList();

        var other = withPeople
            .Where(c => c.Count < DashboardFilter.MinGroupSize || IsOther(c.Channel))
            .Sum(c => c.Count);
        if (other > 0)
            channels.Add(new ChannelCount(Other, DashboardFilter.Suppress(other)));

        return channels;
    }

    private static bool IsOther(string channel) =>
        string.Equals(channel.Trim(), Other, StringComparison.OrdinalIgnoreCase);
}
