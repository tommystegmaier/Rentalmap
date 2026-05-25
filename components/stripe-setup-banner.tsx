import Link from 'next/link';
import { CreditCard, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Server component banner that nudges the landlord to connect Stripe.
 * Renders nothing once the landlord has a connected account on file, so it
 * disappears as soon as setup is complete.
 */
export async function StripeSetupBanner({
  variant = 'dashboard',
}: {
  variant?: 'dashboard' | 'rent';
}) {
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

  if (profile?.stripe_connect_account_id) return null;

  const headline =
    variant === 'rent' ? 'Tenants can’t pay rent yet' : 'Set up rent payments';
  const body =
    variant === 'rent'
      ? 'Connect Stripe so tenants can pay rent in the app. Until you do, you’ll need to log payments manually.'
      : 'Connect Stripe so tenants can pay rent in the app. About 5 minutes.';

  return (
    <Link href="/landlord/settings" className="block">
      <Card className="border-warning/40 bg-warning/5 transition hover:bg-warning/10">
        <CardContent className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning">
            <CreditCard size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{headline}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
          </div>
          <ArrowRight size={16} className="shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
