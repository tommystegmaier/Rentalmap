import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PayCancelPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Payment canceled" />
      <Card>
        <CardContent className="space-y-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No charge was made. You can try again whenever you&apos;re ready.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Button asChild>
              <Link href="/tenant/pay">Try again</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/tenant">Back to home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
