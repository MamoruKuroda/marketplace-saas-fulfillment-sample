using System.Diagnostics;
using System.Text.Json.Nodes;

namespace DeploymentPreflight;

internal sealed class CommandFailureException(string message) : Exception(message);

internal class Commands
{
    internal virtual async Task<string> RunAsync(string file, IReadOnlyList<string> arguments, CancellationToken cancellation)
    {
        // Azure CLI is az.cmd on Windows. Only these fixed, local Bicep commands use cmd.exe.
        var windowsAz = OperatingSystem.IsWindows() && file == "az";
        if (windowsAz && !arguments.SequenceEqual(new[] { "bicep", "version" }) &&
            !arguments.SequenceEqual(new[] { "bicep", "build", "--file", "infra/main.bicep", "--stdout" }))
            throw new InvalidOperationException("Unexpected Azure CLI command.");
        var start = new ProcessStartInfo(windowsAz ? "cmd.exe" : file)
        {
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true
        };
        if (windowsAz)
            foreach (var argument in new[] { "/d", "/c", "az" })
                start.ArgumentList.Add(argument);
        foreach (var argument in arguments)
            start.ArgumentList.Add(argument);
        using var process = Process.Start(start)
            ?? throw new InvalidOperationException($"Unable to start {file}.");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
        timeout.CancelAfter(TimeSpan.FromMinutes(2));
        var stdout = process.StandardOutput.ReadToEndAsync(timeout.Token);
        var stderr = process.StandardError.ReadToEndAsync(timeout.Token);
        try
        {
            await process.WaitForExitAsync(timeout.Token);
            var output = await stdout;
            var errors = await stderr;
            if (process.ExitCode != 0)
                throw new CommandFailureException(
                    $"{file} {string.Join(' ', arguments.Take(2))} failed ({process.ExitCode}): {RegionRules.Redact(errors)}");
            return output;
        }
        catch (OperationCanceledException)
        {
            if (!process.HasExited)
                process.Kill(entireProcessTree: true);
            throw;
        }
    }

    internal async Task<JsonObject> AzdJsonAsync(string[] arguments, CancellationToken cancellation)
    {
        var output = await RunAsync("azd", [.. arguments, "--output", "json", "--no-prompt"], cancellation);
        return JsonNode.Parse(output) as JsonObject
            ?? throw new InvalidOperationException("azd returned an unexpected JSON response.");
    }

    internal Task<string> SaveAsync(string environmentName, string key, string value, CancellationToken cancellation) =>
        RunAsync("azd", ["env", "set", key, value, "--environment", environmentName, "--no-prompt"], cancellation);
}
