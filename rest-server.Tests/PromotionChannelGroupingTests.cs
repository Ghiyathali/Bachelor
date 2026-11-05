using RestServer.Dashboard;

namespace RestServer.Tests;

public class PromotionChannelGroupingTests
{
    [Fact]
    public void BigChannels_AreKept_BiggestFirst()
    {
        var result = PromotionChannelGrouping.Group([("Friend", 5), ("Instagram", 12), ("Facebook", 7)]);

        Assert.Equal(
            [new ChannelCount("Instagram", 12), new ChannelCount("Facebook", 7), new ChannelCount("Friend", 5)],
            result);
    }

    [Fact]
    public void SmallChannels_AreMergedIntoOther_TogetherWithRealOther()
    {
        var result = PromotionChannelGrouping.Group([("Instagram", 6), ("LinkedIn", 2), ("Poster", 2), ("Other", 1)]);

        Assert.Equal([new ChannelCount("Instagram", 6), new ChannelCount("Other", 5)], result);
    }

    [Fact]
    public void Other_IsHidden_WhenStillBelowFive()
    {
        var result = PromotionChannelGrouping.Group([("Instagram", 5), ("LinkedIn", 3)]);

        Assert.Equal([new ChannelCount("Instagram", 5), new ChannelCount("Other", null)], result);
    }

    [Fact]
    public void Other_IsAlwaysLast_EvenWhenBiggest()
    {
        var result = PromotionChannelGrouping.Group([("Other", 20), ("Instagram", 5)]);

        Assert.Equal([new ChannelCount("Instagram", 5), new ChannelCount("Other", 20)], result);
    }

    [Fact]
    public void NoSmallChannels_AndNoOther_GivesNoOtherRow()
    {
        var result = PromotionChannelGrouping.Group([("Instagram", 5), ("Friend", 0)]);

        Assert.Equal([new ChannelCount("Instagram", 5)], result);
    }

    [Fact]
    public void NoAnswers_GivesEmptyList()
    {
        Assert.Empty(PromotionChannelGrouping.Group([]));
    }
}
