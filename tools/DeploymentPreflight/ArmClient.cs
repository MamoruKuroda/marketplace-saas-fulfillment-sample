using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace DeploymentPreflight;

internal sealed class ArmQueryException(string message) : Exception(message);

internal sealed class ArmClient(HttpClient http, Func<CancellationToken, Task<string>> token)
{
    internal const string Endpoint = "https://management.azure.com";

    internal static Uri SafeUri(string path)
    {
        var uri = new Uri(new Uri(Endpoint), path);
        if (uri.Scheme != "https" || uri.Host != "management.azure.com" || uri.Port != 443 ||
            uri.UserInfo.Length != 0 || uri.Fragment.Length != 0)
            throw new InvalidOperationException("Refusing an ARM response link outside Azure public cloud.");
        return uri;
    }

    private async Task<HttpResponseMessage> SendAsync(
        HttpMethod method, string path, JsonObject? body, CancellationToken cancellation)
    {
        var request = new HttpRequestMessage(method, SafeUri(path));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await token(cancellation));
        if (body is not null)
            request.Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");
        using (request)
            return await http.SendAsync(request, cancellation);
    }

    internal async Task<JsonObject?> GetAsync(string path, bool allowNotFound, CancellationToken cancellation)
    {
        using var response = await SendAsync(HttpMethod.Get, path, null, cancellation);
        if (allowNotFound && response.StatusCode == HttpStatusCode.NotFound)
            return null;
        var body = await ReadAsync(response, cancellation);
        if (!response.IsSuccessStatusCode)
            throw new ArmQueryException($"ARM query failed (HTTP {(int)response.StatusCode}): " +
                RegionRules.Redact(body?["error"]?["code"]?.ToString() ?? response.ReasonPhrase ?? "Unknown"));
        return body ?? throw new InvalidOperationException("ARM returned an empty or non-object response.");
    }

    internal async Task<IReadOnlyList<JsonObject>> ListAsync(string path, CancellationToken cancellation)
    {
        var items = new List<JsonObject>();
        var visited = new HashSet<string>(StringComparer.Ordinal);
        string? next = path;
        while (!string.IsNullOrWhiteSpace(next))
        {
            if (visited.Count >= 100 || !visited.Add(next))
                throw new InvalidOperationException("ARM pagination did not terminate.");
            var page = await GetAsync(next, false, cancellation);
            if (page?["value"] is not JsonArray values)
                throw new InvalidOperationException("ARM list response is missing its value array.");
            items.AddRange(values.OfType<JsonObject>());
            next = page["nextLink"]?.GetValue<string>();
        }
        return items;
    }

    internal async Task<RegionCheck> ValidateAsync(
        string subscriptionId, string name, Region region, JsonObject template, JsonObject parameters,
        CancellationToken cancellation)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
        timeout.CancelAfter(TimeSpan.FromMinutes(3));
        var request = new JsonObject
        {
            ["location"] = region.Name,
            ["properties"] = new JsonObject
            {
                ["mode"] = "Incremental",
                ["validationLevel"] = "Provider",
                ["template"] = template.DeepClone(),
                ["parameters"] = parameters.DeepClone()
            }
        };
        var path = $"/subscriptions/{subscriptionId}/providers/Microsoft.Resources/deployments/{name}/validate?api-version=2025-04-01";
        try
        {
            var response = await SendAsync(HttpMethod.Post, path, request, timeout.Token);
            string? pollingUrl = null;
            while (true)
            {
                using (response)
                {
                    if (response.StatusCode != HttpStatusCode.Accepted)
                        return RegionRules.Interpret(region, (int)response.StatusCode, await ReadAsync(response, timeout.Token));
                    pollingUrl = response.Headers.Location?.ToString() ?? pollingUrl;
                    if (string.IsNullOrEmpty(pollingUrl))
                        return new(region, CheckStatus.Unknown, "Validation was accepted but returned no polling URL.");
                    var seconds = Math.Clamp(response.Headers.RetryAfter?.Delta?.TotalSeconds ?? 2, 1, 30);
                    await Task.Delay(TimeSpan.FromSeconds(seconds), timeout.Token);
                    path = pollingUrl;
                }
                response = await SendAsync(HttpMethod.Get, path, null, timeout.Token);
            }
        }
        catch (OperationCanceledException) when (!cancellation.IsCancellationRequested)
        {
            return new(region, CheckStatus.Unknown, "Validation timed out; no deployment was started.");
        }
        catch (HttpRequestException ex)
        {
            return new(region, CheckStatus.Unknown, $"Validation transport error: {ex.HttpRequestError}");
        }
        catch (JsonException)
        {
            return new(region, CheckStatus.Unknown, "Validation returned invalid JSON.");
        }
    }

    private static async Task<JsonObject?> ReadAsync(HttpResponseMessage response, CancellationToken cancellation)
    {
        var text = await response.Content.ReadAsStringAsync(cancellation);
        return string.IsNullOrWhiteSpace(text) ? null : JsonNode.Parse(text) as JsonObject;
    }
}
