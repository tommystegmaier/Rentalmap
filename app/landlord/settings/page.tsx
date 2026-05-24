import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PushToggle } from '@/components/push-toggle';
import { StripeConnectButton } from './connect-button';

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
    .select('stripe_connect_account_id')
    .eq('id', user!.id)
    .maybeSingle();

  const connected = !!profile?.stripe_connect_account_id;

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
                connected
                  ? 'border-transparent bg-success/10 text-success'
                  : 'border-transparent bg-warning/10 text-warning'
              }
            >
              {connected ? 'connected' : 'not connected'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Connecting Stripe lets tenants pay rent in the app. Rent deposits straight to your
            bank — Rentalmap never holds the money. ACH transfers cost about $0.80 (capped at $5),
            and cards cost 2.9% + $0.30 (passed to the tenant by default).
          </p>
          <StripeConnectButton connected={connected} />
          {!connected ? (
            <p className="text-xs text-muted-foreground">
              You&apos;ll be sent to Stripe&apos;s secure onboarding to verify your identity and link
              your bank. Takes about 5–10 minutes.
            </p>
          ) : null}
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

      <Card>
        <CardHeader>
          <CardTitle>Push notifications</CardTitle>
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
          <CardTitle>Reminders</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Default lead times: rent due 3 days before, lease renewal 60 days before. The
          reminders engine syncs nightly and fires push notifications on each trigger date.
        </CardContent>
      </Card>
    </div>
  );
}
