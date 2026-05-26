import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PushToggle } from '@/components/push-toggle';
import { StripeConnectButton } from './connect-button';
import { NotificationSettings } from './notification-settings';
import { PushTypeToggles } from './push-type-toggles';
import { getStripe } from '@/lib/stripe';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { stripe?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('users')
    .select(
      'stripe_connect_account_id, tenant_rent_reminder_enabled, tenant_rent_reminder_days_before, notify_appliance_service, notify_hvac_filter, notify_maintenance_requests, notify_messages',
    )
    .eq('id', user!.id)
    .maybeSingle();

  const connected = !!profile?.stripe_connect_account_id;

  // Check actual Stripe account status so we show accurate info to the landlord.
  type StripeStatus = 'not_connected' | 'restricted' | 'active';
  let stripeStatus: StripeStatus = 'not_connected';
  let stripeDue: string[] = [];
  if (connected && profile?.stripe_connect_account_id) {
    try {
      const stripe = getStripe();
      const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id);
      stripeStatus = account.charges_enabled ? 'active' : 'restricted';
      stripeDue = (account.requirements?.currently_due ?? []) as string[];
    } catch {
      stripeStatus = 'restricted';
    }
  }

  const reminderEnabled = profile?.tenant_rent_reminder_enabled ?? true;
  const reminderDays = profile?.tenant_rent_reminder_days_before ?? 3;
  const notifyApplianceService = profile?.notify_appliance_service ?? true;
  const notifyHvacFilter = profile?.notify_hvac_filter ?? true;
  const notifyMaintenance = profile?.notify_maintenance_requests ?? true;
  const notifyMessages = profile?.notify_messages ?? true;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />

      {searchParams.stripe === 'connected' ? (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
          Stripe onboarding complete. Tenants can now pay rent in the app.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Stripe Connect
            <Badge
              className={
                stripeStatus === 'active'
                  ? 'border-transparent bg-success/10 text-success'
                  : stripeStatus === 'restricted'
                    ? 'border-transparent bg-destructive/10 text-destructive'
                    : 'border-transparent bg-warning/10 text-warning'
              }
            >
              {stripeStatus === 'active'
                ? 'active'
                : stripeStatus === 'restricted'
                  ? 'action required'
                  : 'not connected'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Connecting Stripe lets tenants pay rent in the app. Rent deposits straight to your
            bank — It Rents never holds the money. ACH transfers cost about $0.80 (capped at $5),
            and cards cost 2.9% + $0.30 (passed to the tenant by default).
          </p>
          {stripeStatus === 'restricted' ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <p className="font-medium">Your Stripe account needs attention.</p>
              <p className="mt-1">
                Stripe has placed restrictions on your account — tenants can&apos;t pay online until
                you complete the required steps. Click below to finish verification.
              </p>
              {stripeDue.length > 0 ? (
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-muted-foreground">
                  {stripeDue.slice(0, 5).map((req) => (
                    <li key={req}>{req.replace(/_/g, ' ')}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <StripeConnectButton connected={connected} stripeStatus={stripeStatus} />
          {stripeStatus === 'not_connected' ? (
            <p className="text-xs text-muted-foreground">
              You&apos;ll be sent to Stripe&apos;s secure onboarding to verify your identity and link
              your bank. Takes about 5–10 minutes.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tenant rent reminders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Send each tenant a push notification a few days before rent is due. They need to
            enable push on their device (Tenant → Profile → Push notifications) for the
            reminder to reach them. Reminders run nightly.
          </p>
          <NotificationSettings
            initialEnabled={reminderEnabled}
            initialDays={reminderDays}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your push notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Get a tap on your phone when a tenant submits a work order, pays rent, or when a
            reminder fires (lease renewal, inspections, HVAC service).
          </p>
          <PushToggle vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Push notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Mute specific kinds of pushes. Everything still appears in your in-app
            notifications inbox (the bell icon) regardless.
          </p>
          <PushTypeToggles
            initialApplianceService={notifyApplianceService}
            initialHvacFilter={notifyHvacFilter}
            initialMaintenanceRequests={notifyMaintenance}
            initialMessages={notifyMessages}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment fees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>ACH ($0.80, capped at $5): absorbed by landlord</p>
          <p>Card (2.9% + $0.30): currently absorbed by landlord (configurable later)</p>
        </CardContent>
      </Card>
    </div>
  );
}
