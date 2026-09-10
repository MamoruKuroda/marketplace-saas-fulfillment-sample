using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc;
using SaaSAgentSample.Core.Subscriptions;
using SaaSAgentSample.Web.Services;

namespace SaaSAgentSample.Web.Pages.Admin;

public sealed class IndexModel : PageModel
{
    private readonly AdminService _admin;

    public IndexModel(AdminService admin) => _admin = admin;

    public IReadOnlyList<Subscription> Subscriptions { get; private set; } = Array.Empty<Subscription>();

    [BindProperty(SupportsGet = true)]
    public string? MarketplaceSubscriptionId { get; set; }

    public async Task OnGetAsync(CancellationToken cancellationToken)
    {
        var records = await _admin.ListSubscriptionsAsync(cancellationToken);
        Subscriptions = string.IsNullOrEmpty(MarketplaceSubscriptionId)
            ? records
            : records.Where(s => string.Equals(s.MarketplaceSubscriptionId, MarketplaceSubscriptionId, StringComparison.Ordinal)).ToArray();
    }
}
