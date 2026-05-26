import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StripeConnectButton } from '@/app/landlord/settings/connect-button';
import { CheckCircle, AlertTriangle } from 'lucide-react';

export async function StripeRentSection() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('stripe_connect_account_id')
    .eq('id', user.id)
    .maybeSingle();

  type StripeStatus = 'not_connected' | 'restricted' | 'active';
  let stripeStatus: StripeStatus = 'not_connected';

  if (profile?.stripe_connect_account_id) {
    try {
      const stripe = getStripe();
      const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id);
      stripeStatus = account.charges_enabled ? 'active' : 'restricted';
    } catch {
      stripeStatus = 'restricted';
    }
  }

  if (stripeStatus === 'active') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
        <CheckCircle size={14} className="shrink-0" />
        Online payments active — tenants can pay by bank, card, Apple Pay, or Cash App
      </div>
    );
  }

  if (stripeStatus === 'restricted') {
    return (
      <Link href="/landlord/settings">
        <Card className="border-destructive/30 bg-destructive/5 transition hover:bg-destructive/10">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle size={20} className="shrink-0 text-destructive" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-destructive">Stripe needs attention</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Complete verification in Settings to accept payments.
              </p>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          Accept online rent
          <Badge className="border-transparent bg-warning/10 text-warning text-xs">not set up</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Connect Stripe so tenants can pay rent in the app. Money deposits straight to your bank
          — It Rents never holds it.
        </p>
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Accepted payment methods</p>
          <p>Bank transfer (ACH) — free for tenants, settles in 1–3 business days</p>
          <p>Debit / credit card — 2.9% + $0.30 fee (passed to tenant)</p>
          <p>Apple Pay — same as card, tap-to-pay on iPhone</p>
          <p>Cash App Pay — same as card, instant</p>
        </div>
        <StripeConnectButton connected={false} stripeStatus="not_connected" />
        <p className="text-xs text-muted-foreground">
          Takes about 5–10 minutes on Stripe&apos;s secure onboarding to verify your identity and
          link your bank.
        </p>
      </CardContent>
    </Card>
  );
}
