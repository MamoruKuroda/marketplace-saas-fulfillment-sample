using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using SaaSAgentSample.Core.Subscriptions;
using SaaSAgentSample.Web.Services;

namespace SaaSAgentSample.Web.Pages.Admin;

public sealed class IndexModel : PageModel
{
    /// <summary>
    /// Opt-in switch for the demo reset. Off unless the host turns it on, so copying this sample
    /// into a real deployment does not come with a button that empties the subscription store.
    /// The sample's own infrastructure enables it, because that deployment exists to be re-run.
    /// </summary>
    public const string AllowResetConfigKey = "Demo:AllowReset";

    private readonly AdminService _admin;
    private readonly IDemoDataReset _reset;
    private readonly IConfiguration _config;
    private readonly ILogger<IndexModel> _logger;

    public IndexModel(AdminService admin, IDemoDataReset reset, IConfiguration config, ILogger<IndexModel> logger)
    {
        _admin = admin;
        _reset = reset;
        _config = config;
        _logger = logger;
    }

    public IReadOnlyList<Subscription> Subscriptions { get; private set; } = Array.Empty<Subscription>();

    public bool AllowReset => _config.GetValue(AllowResetConfigKey, false);

    /// <summary>How many subscriptions the last reset removed, when one just ran.</summary>
    [TempData]
    public int? ClearedCount { get; set; }

    public async Task OnGetAsync(CancellationToken cancellationToken)
        => Subscriptions = await _admin.ListSubscriptionsAsync(cancellationToken);

    public async Task<IActionResult> OnPostResetAsync(CancellationToken cancellationToken)
    {
        if (!AllowReset)
        {
            return NotFound();
        }

        ClearedCount = await _reset.ClearSubscriptionsAsync(cancellationToken);
        _logger.LogWarning("Demo reset removed {Count} subscription(s) and their provenance.", ClearedCount);

        // Redirect after post, so a refresh does not look like a second reset.
        return RedirectToPage();
    }
}
