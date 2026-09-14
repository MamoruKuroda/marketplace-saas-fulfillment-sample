using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace DeploymentPreflight;

internal sealed partial class TemplateInputs(JsonObject template, JsonObject parameterFile)
{
    internal JsonObject Template { get; } = template;

    internal string ResourceGroupName(string environmentName)
    {
        var group = (Template["resources"] as JsonArray)?.OfType<JsonObject>().SingleOrDefault(r =>
            string.Equals(r["type"]?.GetValue<string>(), "Microsoft.Resources/resourceGroups", StringComparison.OrdinalIgnoreCase));
        if (group?["name"]?.GetValue<string>() != "[format('rg-{0}', parameters('environmentName'))]" ||
            group["location"]?.GetValue<string>() != "[parameters('location')]")
            throw new InvalidOperationException("The sample's resource-group naming/location contract changed. " +
                "Update the region helper before selecting a new deployment location.");
        return $"rg-{environmentName}";
    }

    internal JsonObject Resolve(IReadOnlyDictionary<string, string> environment,
        string region, string principalId, string principalType)
    {
        var definitions = Template["parameters"] as JsonObject
            ?? throw new InvalidOperationException("The compiled template has no parameter definitions.");
        var entries = parameterFile["parameters"] as JsonObject
            ?? throw new InvalidOperationException("main.parameters.json has no parameters.");
        if (entries["location"]?["value"]?.ToString() != "${AZURE_LOCATION}" ||
            entries["environmentName"]?["value"]?.ToString() != "${AZURE_ENV_NAME}")
            throw new InvalidOperationException("The location/environment parameter mappings changed. " +
                "Preflight must use the same inputs as azd.");
        var resolved = new JsonObject();
        foreach (var (name, definition) in definitions)
        {
            if (definition is not JsonObject parameter)
                throw new InvalidOperationException($"Invalid parameter definition: {name}");
            if (name == "location")
            {
                resolved[name] = new JsonObject { ["value"] = region };
                continue;
            }
            if (entries[name] is not JsonObject entry || !entry.ContainsKey("value"))
            {
                if (parameter.ContainsKey("defaultValue"))
                    continue;
                throw new InvalidOperationException($"Missing input for parameter: {name}");
            }

            JsonNode? value = entry["value"]?.DeepClone();
            if (value is JsonValue scalar && scalar.TryGetValue<string>(out var text))
            {
                var match = EnvironmentReference().Match(text);
                if (match.Success)
                {
                    var key = match.Groups["key"].Value;
                    text = key switch
                    {
                        "AZURE_PRINCIPAL_ID" => principalId,
                        "AZURE_PRINCIPAL_TYPE" => principalType,
                        _ => environment.TryGetValue(key, out var configured) ? configured :
                            match.Groups["default"].Success ? match.Groups["default"].Value :
                            throw new InvalidOperationException($"Set {key} in the selected azd environment.")
                    };
                }
                else if (text.Contains("${", StringComparison.Ordinal) || text.Contains("$(", StringComparison.Ordinal))
                {
                    throw new InvalidOperationException($"Unsupported parameter substitution: {name}");
                }

                value = parameter["type"]?.GetValue<string>().ToLowerInvariant() switch
                {
                    "string" or "securestring" => JsonValue.Create(text),
                    "bool" when bool.TryParse(text, out var boolean) => JsonValue.Create(boolean),
                    "int" when long.TryParse(text, out var number) => JsonValue.Create(number),
                    "object" or "array" or "secureobject" => JsonNode.Parse(text),
                    _ => throw new InvalidOperationException($"Invalid value or unsupported type for parameter: {name}")
                };
            }
            resolved[name] = new JsonObject { ["value"] = value };
        }
        if (!resolved.ContainsKey("location") || !resolved.ContainsKey("environmentName"))
            throw new InvalidOperationException("This helper requires the sample's location and environmentName parameters.");
        return resolved;
    }

    internal IReadOnlyList<(string Type, string ApiVersion)> RegionalResources() =>
        Resources(Template)
            .Where(r => r.ContainsKey("location") && !r["type"]!.GetValue<string>()
                .StartsWith("Microsoft.Resources/", StringComparison.OrdinalIgnoreCase))
            .Select(r => (r["type"]!.GetValue<string>(), r["apiVersion"]!.GetValue<string>()))
            .Distinct()
            .ToArray();

    internal string AppServiceTier()
    {
        var plan = Resources(Template).Single(r =>
            string.Equals(r["type"]?.GetValue<string>(), "Microsoft.Web/serverfarms", StringComparison.OrdinalIgnoreCase));
        var sku = plan["sku"]?["name"]?.GetValue<string>();
        if (plan["properties"]?["reserved"]?.GetValue<bool>() != true)
            throw new InvalidOperationException("The region catalog filter expects a Linux App Service plan.");
        return sku switch
        {
            "B1" or "B2" or "B3" => "Basic",
            "F1" => "Free",
            "S1" or "S2" or "S3" => "Standard",
            _ => throw new InvalidOperationException(
                "The App Service SKU changed. Update the region helper's catalog mapping before proceeding.")
        };
    }

    internal string Summary()
    {
        return string.Join(", ", Resources(Template).Where(r => r["sku"] is not null).Select(r =>
            $"{r["type"]}: {r["sku"]!["name"]}"));
    }

    private static IEnumerable<JsonObject> Resources(JsonObject template)
    {
        if (template["resources"] is not JsonArray resources)
            throw new InvalidOperationException("Expected a compiled ARM template with a resources array.");
        foreach (var resource in resources.OfType<JsonObject>())
        {
            if (string.Equals(resource["type"]?.GetValue<string>(), "Microsoft.Resources/deployments", StringComparison.OrdinalIgnoreCase) &&
                resource["properties"]?["template"] is JsonObject nested)
            {
                foreach (var child in Resources(nested))
                    yield return child;
            }
            else
            {
                yield return resource;
            }
        }
    }

    [GeneratedRegex(@"^\$\{(?<key>[A-Za-z_][A-Za-z0-9_]*)(?:=(?<default>[^}]*))?\}$")]
    private static partial Regex EnvironmentReference();
}
