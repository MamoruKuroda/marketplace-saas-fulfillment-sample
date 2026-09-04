using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Localization;
using SaaSAgentSample.Fulfillment;
using SaaSAgentSample.Fulfillment.Models;
using SaaSAgentSample.Web.Services;

namespace SaaSAgentSample.Web.Pages;

public sealed class IndexModel : PageModel
{
    private readonly LandingService _landing;
    private readonly IStringLocalizer<SharedResource> _l;
    private readonly IConfiguration _config;

    public IndexModel(LandingService landing, IStringLocalizer<SharedResource> l, IConfiguration config)
    {
        _landing = landing;
        _l = l;
        _config = config;
    }

    [BindProperty(SupportsGet = true)]
    public string? Token { get; set; }

    public ResolvedSubscription? Resolved { get; private set; }

    public string? Message { get; private set; }

    public bool IsActivated { get; private set; }

    /// <summary>True when the resolved subscription is already Subscribed (e.g. re-visiting or toggling
    /// language after activation): show the "active" state instead of the Activate button, so a GET is
    /// idempotent and the confirmation survives a language switch.</summary>
    public bool AlreadyActive { get; private set; }

    /// <summary>True when there is no purchase token: render the "Start here" demo map instead of the activation flow.</summary>
    public bool ShowHome { get; private set; }

    /// <summary>
    /// Emulator links for the "Begin at the Emulator" call to action, when known. They carry the
    /// reader's language so the demo does not flip language when it crosses into the other system.
    /// </summary>
    public string? EmulatorUrl { get; private set; }

    /// <summary>Emulator Subscriptions tab, used by the "what happens next" note after activation.</summary>
    public string? EmulatorSubscriptionsUrl { get; private set; }

    public async Task OnGetAsync(CancellationToken cancellationToken)
    {
        EmulatorUrl = DemoNavigation.EmulatorLink(_config);
        EmulatorSubscriptionsUrl = DemoNavigation.EmulatorLink(_config, "/subscriptions.html");

        if (string.IsNullOrWhiteSpace(Token))
        {
            ShowHome = true;
            return;
        }

        try
        {
            Resolved = await _landing.ResolveAsync(Token, cancellationToken);
            if (Resolved is null)
            {
                Message = _l["The purchase could not be resolved."];
            }
            else if (string.Equals(Resolved.Subscription?.SaasSubscriptionStatus, "Subscribed", StringComparison.OrdinalIgnoreCase))
            {
                AlreadyActive = true;
                Message = _l["This subscription is already active."];
            }
        }
        catch (FulfillmentApiException)
        {
            Message = _l["The purchase could not be resolved (the token may be invalid or expired)."];
        }
    }

    public async Task<IActionResult> OnPostAsync(string subscriptionId, string planId, int? quantity, CancellationToken cancellationToken)
    {
        EmulatorUrl = DemoNavigation.EmulatorLink(_config);
        EmulatorSubscriptionsUrl = DemoNavigation.EmulatorLink(_config, "/subscriptions.html");

        if (string.IsNullOrWhiteSpace(subscriptionId) || string.IsNullOrWhiteSpace(planId))
        {
            Message = _l["Missing subscription details."];
            return Page();
        }

        try
        {
            var result = await _landing.ActivateAsync(subscriptionId, planId, quantity, cancellationToken);
            IsActivated = result == LandingActivationResult.Activated;
            Message = IsActivated
                ? _l["Your subscription is now active."]
                : _l["Activation could not be completed. Please retry from the Marketplace."];
        }
        catch (FulfillmentApiException)
        {
            Message = _l["Activation failed. Please try again."];
        }

        return Page();
    }
}
