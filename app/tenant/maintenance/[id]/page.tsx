import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { URGENCY_LABELS, type Urgency } from '@/lib/constants';
import { format, parseISO } from 'date-fns';

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

  const urg = URGENCY_LABELS[wo.urgency as Urgency];

  return (
    <div className="space-y-6">
      <PageHeader title={wo.request_type} />

      <div className="flex flex-wrap items-center gap-2">
        <Badge className={`border-transparent ${urg.color}`}>{urg.label}</Badge>
        <Badge className="border-transparent bg-secondary">
          {wo.status.replace('_', ' ')}
        </Badge>
        <Badge className="border-transparent bg-muted text-muted-foreground">
          Submitted {format(parseISO(wo.submitted_at), 'PP')}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your description</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="whitespace-pre-wrap">{wo.description}</p>
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
