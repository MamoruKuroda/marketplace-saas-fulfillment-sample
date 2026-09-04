using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using SaaSAgentSample.Core.Subscriptions;
using SaaSAgentSample.Web.Endpoints;

namespace SaaSAgentSample.Tests.Web;

/// <summary>
/// The demo reset empties the subscription store from an anonymous endpoint, so what matters is
/// that it cannot be reached by accident. Two independent gates: the feature must be switched on,
/// and the request must carry the header that forces a CORS preflight.
/// </summary>
public class DemoResetEndpointTests
{
    private static HttpRequest Request(bool withHeader)
    {
        var context = new DefaultHttpContext();
        if (withHeader)
        {
            context.Request.Headers[DemoResetEndpoint.RequiredHeader] = "1";
        }

        return context.Request;
    }

    private static IConfiguration Config(bool allow) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [DemoResetEndpoint.AllowResetConfigKey] = allow ? "true" : "false",
            })
            .Build();

    private sealed class SpyReset : IDemoDataReset
    {
        public int Calls { get; private set; }

        public Task<int> ClearSubscriptionsAsync(CancellationToken cancellationToken = default)
        {
            Calls++;
            return Task.FromResult(3);
        }
    }

    [Fact]
    public async Task Off_by_default_so_an_unconfigured_deployment_has_no_such_endpoint()
    {
        var reset = new SpyReset();

        var result = await DemoResetEndpoint.HandleAsync(
            Request(withHeader: true),
            new ConfigurationBuilder().Build(),
            reset,
            NullLoggerFactory.Instance,
            CancellationToken.None);

        Assert.IsType<NotFound>(result);
        Assert.Equal(0, reset.Calls);
    }

    [Fact]
    public async Task Refuses_when_the_feature_is_switched_off()
    {
        var reset = new SpyReset();

        var result = await DemoResetEndpoint.HandleAsync(
            Request(withHeader: true), Config(allow: false), reset, NullLoggerFactory.Instance, CancellationToken.None);

        Assert.IsType<NotFound>(result);
        Assert.Equal(0, reset.Calls);
    }

    [Fact]
    public async Task Refuses_without_the_header_that_forces_a_preflight()
    {
        var reset = new SpyReset();

        var result = await DemoResetEndpoint.HandleAsync(
            Request(withHeader: false), Config(allow: true), reset, NullLoggerFactory.Instance, CancellationToken.None);

        Assert.IsType<BadRequest>(result);
        Assert.Equal(0, reset.Calls);
    }

    [Fact]
    public async Task Clears_when_enabled_and_called_correctly()
    {
        var reset = new SpyReset();

        var result = await DemoResetEndpoint.HandleAsync(
            Request(withHeader: true), Config(allow: true), reset, NullLoggerFactory.Instance, CancellationToken.None);

        Assert.Equal(1, reset.Calls);
        Assert.NotNull(result);
    }
}
