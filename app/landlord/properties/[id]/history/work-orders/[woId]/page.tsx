import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { URGENCY_LABELS, type Urgency } from '@/lib/constants';
import { format, parseISO } from 'date-fns';
import { ChevronLeft } from 'lucide-react';
import { formatCents, one } from '@/lib/utils';

interface WorkOrderRow {
  id: string;
  property_id: string;
  request_type: string;
  description: string;
  urgency: Urgency;
  status: 'open' | 'in_progress' | 'closed';
  submitted_at: string;
  closed_at: string | null;
  photo_urls: string[];
  vendor_name: string | null;
  vendor_phone: string | null;
  total_cost_cents: number | null;
  landlord_notes_internal: string | null;
  landlord_notes_shared: string | null;
  tenant_contact_preference: 'phone' | 'text' | 'email';
  submitter:
    | { name: string | null; email: string; phone: string | null }
    | { name: string | null; email: string; phone: string | null }[]
    | null;
}

export default async function HistoryWorkOrderView({
  params,
}: {
  params: { id: string; woId: string };
}) {
  const supabase = createClient();

  const { data } = await supabase
    .from('work_orders')
    .select('*, submitter:submitted_by_user_id(name, email, phone)')
    .eq('id', params.woId)
    .eq('property_id', params.id)
    .maybeSingle();

  if (!data) notFound();
  const wo = data as WorkOrderRow;

  const urg = URGENCY_LABELS[wo.urgency];
  const submitter = one(wo.submitter);

  return (
    <div className="space-y-6">
      <PageHeader title={wo.request_type} description="Read-only · Previous work order" />

      <Link
        href={`/landlord/properties/${params.id}/history`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={16} />
        Back to previous service & work orders
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <Badge className={`border-transparent ${urg.color}`}>{urg.label}</Badge>
        {wo.status === 'closed' ? (
          <Badge className="border-transparent bg-success/10 text-success">Completed</Badge>
        ) : (
          <Badge className="border-transparent bg-muted text-muted-foreground">
            {wo.status.replace('_', ' ')}
          </Badge>
        )}
        <Badge className="border-transparent bg-muted text-muted-foreground">
          Submitted {format(parseISO(wo.submitted_at), 'PP')}
        </Badge>
        {wo.closed_at ? (
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
          <p className="font-medium">{submitter?.name ?? submitter?.email ?? '—'}</p>
          {submitter?.email ? (
            <p className="text-muted-foreground">{submitter.email}</p>
          ) : null}
          {submitter?.phone ? (
            <p className="text-muted-foreground">{submitter.phone}</p>
          ) : null}
          <p className="text-muted-foreground">
            Preferred contact: {wo.tenant_contact_preference}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="whitespace-pre-wrap">{wo.description}</p>
          {wo.photo_urls?.length ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {wo.photo_urls.map((p: string) => (
                <div
                  key={p}
                  className="aspect-square rounded-lg border bg-muted text-center text-xs text-muted-foreground"
                  title={p}
                >
                  <span className="block p-2">photo</span>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {wo.vendor_name || wo.vendor_phone || wo.total_cost_cents != null ? (
        <Card>
          <CardHeader>
            <CardTitle>Vendor & cost</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {wo.vendor_name ? (
              <p>
                <span className="text-muted-foreground">Vendor: </span>
                <span className="font-medium">{wo.vendor_name}</span>
              </p>
            ) : null}
            {wo.vendor_phone ? (
              <p>
                <span className="text-muted-foreground">Phone: </span>
                <span className="font-medium">{wo.vendor_phone}</span>
              </p>
            ) : null}
            {wo.total_cost_cents != null ? (
              <p>
                <span className="text-muted-foreground">Total cost: </span>
                <span className="font-medium">{formatCents(wo.total_cost_cents)}</span>
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {wo.landlord_notes_shared ? (
        <Card>
          <CardHeader>
            <CardTitle>Note to tenant</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="whitespace-pre-wrap">{wo.landlord_notes_shared}</p>
          </CardContent>
        </Card>
      ) : null}

      {wo.landlord_notes_internal ? (
        <Card>
          <CardHeader>
            <CardTitle>Internal notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="whitespace-pre-wrap">{wo.landlord_notes_internal}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
