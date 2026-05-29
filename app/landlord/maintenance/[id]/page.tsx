import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { URGENCY_LABELS, type Urgency } from '@/lib/constants';
import { format, parseISO } from 'date-fns';
import { ChevronLeft } from 'lucide-react';
import { one } from '@/lib/utils';
import { updateWorkOrder } from './actions';
import { MarkNotificationRead } from '@/components/mark-notification-read';
import { DeleteWorkOrderButton } from '@/components/delete-work-order-button';
import { SuccessToast } from '@/components/success-toast';
import { WorkOrderReceipt } from '@/components/work-order-receipt';

interface WorkOrderDetailRow {
  id: string;
  property_id: string;
  request_type: string;
  description: string;
  urgency: Urgency;
  status: 'open' | 'in_progress' | 'closed';
  submitted_at: string;
  closed_at: string | null;
  photo_urls: string[];
  receipt_url: string | null;
  vendor_name: string | null;
  vendor_phone: string | null;
  total_cost_cents: number | null;
  landlord_notes_internal: string | null;
  landlord_notes_shared: string | null;
  tenant_contact_preference: 'phone' | 'text' | 'email';
  properties: { address: string } | { address: string }[] | null;
  submitter:
    | { name: string | null; email: string; phone: string | null }
    | { name: string | null; email: string; phone: string | null }[]
    | null;
}

export default async function WorkOrderDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { saved?: string };
}) {
  const supabase = createClient();
  const { data } = await supabase
    .from('work_orders')
    .select('*, properties:property_id(address), submitter:submitted_by_user_id(name, email, phone)')
    .eq('id', params.id)
    .maybeSingle();

  if (!data) notFound();
  const wo = data as WorkOrderDetailRow;

  // Mark as viewed by the landlord on first open so the Maintenance tab
  // badge decrements. RLS limits this update to work orders on properties
  // the caller owns, so no extra ownership check needed.
  await supabase
    .from('work_orders')
    .update({ landlord_viewed_at: new Date().toISOString() })
    .eq('id', params.id)
    .is('landlord_viewed_at', null);

  // Generate signed URLs for photos (bucket is private)
  const admin = createServiceRoleClient();
  const photoSignedUrls: string[] = [];
  if (wo.photo_urls?.length) {
    for (const path of wo.photo_urls) {
      const { data: signed } = await admin.storage
        .from('work-order-photos')
        .createSignedUrl(path, 3600);
      if (signed?.signedUrl) photoSignedUrls.push(signed.signedUrl);
    }
  }

  // Signed URL for the landlord's attached receipt (private `receipts` bucket).
  let receiptSignedUrl: string | null = null;
  if (wo.receipt_url) {
    const { data: signed } = await supabase.storage
      .from('receipts')
      .createSignedUrl(wo.receipt_url, 3600);
    receiptSignedUrl = signed?.signedUrl ?? null;
  }

  const urg = URGENCY_LABELS[wo.urgency];
  const submitter = one(wo.submitter);
  const propAddr = one(wo.properties)?.address;

  async function action(formData: FormData) {
    'use server';
    await updateWorkOrder(params.id, formData);
    redirect(`/landlord/maintenance/${params.id}?saved=1`);
  }

  return (
    <div className="space-y-6">
      <MarkNotificationRead workOrderId={params.id} />
      <SuccessToast show={searchParams.saved === '1'} message="Work order updated" />

      <Link
        href="/landlord/maintenance"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={16} />
        Work orders
      </Link>

      <PageHeader title={wo.request_type} description={propAddr ?? undefined} />

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
          <CardTitle>Tenant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="font-medium">{submitter?.name ?? submitter?.email}</p>
          {submitter?.email ? (
            <p className="text-muted-foreground">{submitter.email}</p>
          ) : null}
          {submitter?.phone ? (
            <p className="text-muted-foreground">{submitter.phone}</p>
          ) : null}
          <p className="text-muted-foreground">
            Prefers contact by {wo.tenant_contact_preference}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
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
                  alt={`Work order photo ${i + 1}`}
                  className="aspect-square w-full rounded-lg border object-cover"
                  loading="lazy"
                />
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Update</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-3 text-sm">
            <label className="block space-y-1">
              <span className="font-medium">Status</span>
              <select
                name="status"
                defaultValue={wo.status}
                className="h-11 w-full rounded-lg border border-input bg-background px-3"
              >
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="closed">Completed</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="font-medium">Vendor name</span>
                <input
                  name="vendor_name"
                  defaultValue={wo.vendor_name ?? ''}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-medium">Vendor phone</span>
                <input
                  name="vendor_phone"
                  defaultValue={wo.vendor_phone ?? ''}
                  className="h-11 w-full rounded-lg border border-input bg-background px-3"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="font-medium">Total cost ($)</span>
              <input
                name="total_cost"
                inputMode="decimal"
                defaultValue={
                  wo.total_cost_cents ? (wo.total_cost_cents / 100).toFixed(2) : ''
                }
                className="h-11 w-full rounded-lg border border-input bg-background px-3"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-medium">Internal notes (landlord only)</span>
              <textarea
                name="landlord_notes_internal"
                rows={3}
                defaultValue={wo.landlord_notes_internal ?? ''}
                className="w-full rounded-lg border border-input bg-background px-3 py-2"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-medium">Note to tenant (shown to tenant)</span>
              <textarea
                name="landlord_notes_shared"
                rows={3}
                defaultValue={wo.landlord_notes_shared ?? ''}
                className="w-full rounded-lg border border-input bg-background px-3 py-2"
              />
            </label>

            <Button type="submit" className="w-full">
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Receipt</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkOrderReceipt
            workOrderId={wo.id}
            propertyId={wo.property_id}
            receiptSignedUrl={receiptSignedUrl}
            hasReceipt={!!wo.receipt_url}
          />
        </CardContent>
      </Card>

      <DeleteWorkOrderButton id={wo.id} redirectTo="/landlord/maintenance" />
    </div>
  );
}
