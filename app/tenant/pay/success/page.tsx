import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

export default function PaySuccessPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Payment submitted" />
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <CheckCircle2 size={48} className="text-success" />
          <p className="font-medium">Thanks — we&apos;ve got it.</p>
          <p className="text-sm text-muted-foreground">
            If you paid by card it should show as settled within a few seconds. ACH payments
            usually take 1–3 business days. We&apos;ll email you a receipt.
          </p>
          <div className="mt-4 flex gap-2">
            <Button asChild>
              <Link href="/tenant">Back to home</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/tenant/payments">Payment history</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
