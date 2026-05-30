import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { one } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, PenLine } from 'lucide-react';
import { RequestSignatureButton } from './request-signature-button';

const TYPE_BADGE: Record<string, string> = {
  move_in: 'border-transparent bg-blue-100 text-blue-700',
  move_out: 'border-transparent bg-orange-100 text-orange-700',
  periodic: 'border-transparent bg-muted text-muted-foreground',
};

const TYPE_LABEL: Record<string, string> = {
  move_in: 'Move-in',
  move_out: 'Move-out',
  periodic: 'Periodic',
};

const CONDITION_BADGE: Record<string, string> = {
  excellent: 'border-transparent bg-green-100 text-green-700',
  good: 'border-transparent bg-blue-100 text-blue-700',
  fair: 'border-transparent bg-yellow-100 text-yellow-700',
  poor: 'border-transparent bg-orange-100 text-orange-700',
  damaged: 'border-transparent bg-red-100 text-red-700',
  na: 'border-transparent bg-muted text-muted-foreground',
};

const CONDITION_LABEL: Record<string, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  damaged: 'Damaged',
  na: 'N/A',
};

interface InspectionItemRow {
  id: string;
  room: string;
  item: string;
  condition: string;
  notes: string | null;
  photo_urls: string[];
  sort_order: number;
}

interface InspectionRow {
  id: string;
  type: string;
  conducted_date: string;
  overall_notes: string | null;
  tenant_signed_at: string | null;
  lease_id: string | null;
  properties: { address: string } | { address: string }[] | null;
}

export default async function InspectionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: inspData } = await supabase
    .from('inspections')
    .select(
      'id, type, conducted_date, overall_notes, tenant_signed_at, lease_id, properties:property_id(address)',
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!inspData) notFound();
  const insp = inspData as InspectionRow;

  const { data: itemRows } = await supabase
    .from('inspection_items')
    .select('id, room, item, condition, notes, photo_urls, sort_order')
    .eq('inspection_id', params.id)
    .order('sort_order', { ascending: true });

  const items = (itemRows ?? []) as InspectionItemRow[];

  // Group items by room
  const roomMap = new Map<string, InspectionItemRow[]>();
  for (const itm of items) {
    const list = roomMap.get(itm.room) ?? [];
    list.push(itm);
    roomMap.set(itm.room, list);
  }

  // Generate signed URLs for photos
  const allPaths = items.flatMap((itm) => itm.photo_urls);
  const signedUrlMap = new Map<string, string>();
  if (allPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('inspection-photos')
      .createSignedUrls(allPaths, 3600);
    for (const entry of signed ?? []) {
      if (entry.signedUrl && entry.path) {
        signedUrlMap.set(entry.path, entry.signedUrl);
      }
    }
  }

  const prop = one(insp.properties);
  const addr = prop?.address ?? '—';
  const isSigned = !!insp.tenant_signed_at;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${TYPE_LABEL[insp.type] ?? insp.type} Inspection`}
        description={addr}
        action={
          !isSigned ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/landlord/inspections/${params.id}/edit`}>
                <PenLine size={14} className="mr-1" />
                Edit
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Header badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={TYPE_BADGE[insp.type] ?? TYPE_BADGE.periodic}>
          {TYPE_LABEL[insp.type] ?? insp.type}
        </Badge>
        <Badge className="border-transparent bg-muted text-muted-foreground">
          {format(parseISO(insp.conducted_date), 'MMM d, yyyy')}
        </Badge>
        {isSigned ? (
          <Badge className="border-transparent bg-green-100 text-green-700">
            <CheckCircle2 size={12} className="mr-1" />
            Tenant signed {format(parseISO(insp.tenant_signed_at!), 'MMM d, yyyy')}
          </Badge>
        ) : (
          <Badge className="border-transparent bg-muted text-muted-foreground">
            Unsigned
          </Badge>
        )}
      </div>

      {/* Tenant signature section */}
      {!isSigned && insp.lease_id && (
        <Card className="border-dashed">
          <CardContent className="p-4 text-sm">
            <RequestSignatureButton inspectionId={params.id} />
          </CardContent>
        </Card>
      )}

      {/* Overall notes */}
      {insp.overall_notes && (
        <Card>
          <CardHeader>
            <CardTitle>Overall notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{insp.overall_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Room-by-room items */}
      {Array.from(roomMap.entries()).map(([room, roomItems]) => (
        <Card key={room}>
          <CardHeader>
            <CardTitle className="text-base">{room}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {roomItems.map((itm) => (
              <div key={itm.id} className="space-y-1 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{itm.item}</p>
                  <Badge className={CONDITION_BADGE[itm.condition] ?? CONDITION_BADGE.na}>
                    {CONDITION_LABEL[itm.condition] ?? itm.condition}
                  </Badge>
                </div>
                {itm.notes && (
                  <p className="text-xs text-muted-foreground">{itm.notes}</p>
                )}
                {itm.photo_urls.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {itm.photo_urls.map((path) => {
                      const url = signedUrlMap.get(path);
                      return url ? (
                        <a
                          key={path}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={itm.item}
                            className="aspect-square w-full rounded-md border object-cover"
                          />
                        </a>
                      ) : (
                        <div
                          key={path}
                          className="aspect-square rounded-md border bg-muted"
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No checklist items recorded.</p>
      )}
    </div>
  );
}
