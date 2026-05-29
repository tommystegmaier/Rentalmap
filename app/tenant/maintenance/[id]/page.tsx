import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { URGENCY_LABELS, type Urgency } from '@/lib/constants';
import { format, parseISO } from 'date-fns';
import { ChevronLeft } from 'lucide-react';
import { MarkWorkOrderUpdatesRead } from '../mark-read';

export default async function TenantWorkOrderDetail({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: wo } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!wo) notFound();

  // Generate signed URLs for photos the tenant submitted (bucket is private)
  const admin = createServiceRoleClient();
  const photoSignedUrls: string[] = [];
  if (wo.photo_urls?.length) {
    for (const path of wo.photo_urls as string[]) {
      const { data: signed } = await admin.storage
        .from('work-order-photos')
        .createSignedUrl(path, 3600);
      if (signed?.signedUrl) photoSignedUrls.push(signed.signedUrl);
    }
  }

  const urg = URGENCY_LABELS[wo.urgency as Urgency];

  return (
    <div className="space-y-6">
      <MarkWorkOrderUpdatesRead workOrderId={params.id} />
      <Link
        href="/tenant/maintenance"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={16} />
        Work orders
      </Link>

      <PageHeader title={wo.request_type} />

      <div className="flex flex-wrap items-center gap-2">
        <Badge className={`border-transparent ${urg.color}`}>{urg.label}</Badge>
        {(() => {
          const label = wo.status === 'closed' ? 'Completed' : wo.status.replace('_', ' ');
          const cls =
            wo.status === 'closed'
              ? 'border-transparent bg-success/10 text-success'
              : 'border-transparent bg-destructive/10 text-destructive';
          return <Badge className={cls}>{label}</Badge>;
        })()}
        <Badge className="border-transparent bg-muted text-muted-foreground">
          Submitted {format(parseISO(wo.submitted_at), 'PP')}
        </Badge>
        {wo.status === 'closed' && wo.closed_at ? (
          <Badge className="border-transparent bg-success/10 text-success">
            Completed {format(parseISO(wo.closed_at), 'PP')}
          </Badge>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your description</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="whitespace-pre-wrap">{wo.description}</p>
          {photoSignedUrls.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {photoSignedUrls.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="aspect-square w-full rounded-lg border object-cover"
                  loading="lazy"
                />
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {wo.landlord_notes_shared ? (
        <Card>
          <CardHeader>
            <CardTitle>Note from landlord</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="whitespace-pre-wrap">{wo.landlord_notes_shared}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
