using System.Globalization;

namespace DeploymentPreflight;

internal sealed class ConsoleUi(
    IReadOnlyDictionary<string, string> environment,
    TextReader? input = null,
    TextWriter? output = null,
    bool? interactive = null)
{
    private readonly TextReader reader = input ?? Console.In;
    private readonly TextWriter writer = output ?? Console.Out;
    private readonly bool japanese = environment.GetValueOrDefault("DEPLOYMENT_PREFLIGHT_LANGUAGE",
        CultureInfo.CurrentUICulture.TwoLetterISOLanguageName).Equals("ja", StringComparison.OrdinalIgnoreCase);

    internal bool Accepted => IsTrue("DEPLOYMENT_PREFLIGHT_ACCEPT");
    private bool Interactive => (interactive ?? !Console.IsInputRedirected) &&
        !IsTrue("CI") && !IsTrue("AZD_NON_INTERACTIVE") && !Accepted;
    private bool IsTrue(string key) => environment.TryGetValue(key, out var value) &&
        (value.Equals("true", StringComparison.OrdinalIgnoreCase) || value == "1");
    internal string Text(string english, string japaneseText) => japanese ? japaneseText : english;
    internal void Write(string english, string japaneseText) => writer.WriteLine(Text(english, japaneseText));
    internal void Value(string text) => writer.WriteLine(text);

    internal int Choose(string english, string japaneseText, IReadOnlyList<string> options)
    {
        Write(english, japaneseText);
        for (var i = 0; i < options.Count; i++)
            writer.WriteLine($"  {i + 1}. {options[i]}");
        if (!Interactive)
            throw new InvalidOperationException(Text(
                "Input is required. Set AZURE_SUBSCRIPTION_ID and AZURE_LOCATION in this azd environment. " +
                "For unattended runs also set DEPLOYMENT_PREFLIGHT_ACCEPT=true.",
                "入力が必要です。azd 環境に AZURE_SUBSCRIPTION_ID と AZURE_LOCATION を設定してください。" +
                "無人実行には DEPLOYMENT_PREFLIGHT_ACCEPT=true も必要です。"));
        while (true)
        {
            writer.Write("> ");
            var line = reader.ReadLine() ?? throw new OperationCanceledException();
            if (int.TryParse(line, out var value) && value >= 1 && value <= options.Count)
                return value - 1;
            Write("Enter one of the displayed numbers.", "表示された番号を入力してください。");
        }
    }

    internal bool Confirm(string english, string japaneseText)
    {
        if (Accepted)
            return true;
        return Choose(english, japaneseText,
            [Text("Cancel", "キャンセル"), Text("Continue", "続行")]) == 1;
    }

    internal void Result(RegionCheck check)
    {
        var label = check.Status switch
        {
            CheckStatus.Candidate => Text("Candidate: provider validation passed", "候補：Provider 事前検証を通過"),
            CheckStatus.Blocked => Text("Blocked", "利用不可"),
            _ => Text("Unverified", "未確認")
        };
        writer.WriteLine($"  {check.Region.Name} ({check.Region.Geography}) - {label}");
        if (check.Detail.Length > 0)
            writer.WriteLine($"    {check.Detail}");
    }
}
