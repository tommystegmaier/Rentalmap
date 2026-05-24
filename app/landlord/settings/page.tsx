import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />

      <Card>
        <CardHeader>
          <CardTitle>Stripe Connect</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Connect a Stripe Express account so tenant rent payments deposit straight to your
            bank.
          </p>
          <Button disabled variant="outline">
            Connect Stripe (coming next)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment fees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>ACH ($0.80 capped at $5): absorbed by landlord</p>
          <p>Card (2.9% + $0.30): passed to tenant (configurable)</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Default lead times: rent due 3 days before, lease renewal 60 days before.
        </CardContent>
      </Card>
    </div>
  );
}
