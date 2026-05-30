import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { NewInspectionForm } from '../../new/form';

interface PropertyWithLease {
  id: string;
  address: string;
  leases: { id: string; start_date: string; end_date: string | null }[];
}

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
  property_id: string;
  lease_id: string | null;
}

export default async function EditInspectionPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: inspData } = await supabase
    .from('inspections')
    .select('id, type, conducted_date, overall_notes, tenant_signed_at, property_id, lease_id')
    .eq('id', params.id)
    .maybeSingle();

  if (!inspData) notFound();
  const insp = inspData as InspectionRow;

  // If already signed, don't allow editing
  if (insp.tenant_signed_at) {
    redirect(`/landlord/inspections/${params.id}`);
  }

  const { data: itemRows } = await supabase
    .from('inspection_items')
    .select('id, room, item, condition, notes, photo_urls, sort_order')
    .eq('inspection_id', params.id)
    .order('sort_order', { ascending: true });

  const items = (itemRows ?? []) as InspectionItemRow[];

  // Generate signed URLs for all existing photos so the edit form can show
  // thumbnails. Photos are in the private inspection-photos bucket.
  const signedUrlsMap = new Map<string, string[]>();
  await Promise.all(
    items.map(async (item) => {
      if (!item.photo_urls?.length) {
        signedUrlsMap.set(item.id, []);
        return;
      }
      const { data } = await supabase.storage
        .from('inspection-photos')
        .createSignedUrls(item.photo_urls, 3600);
      signedUrlsMap.set(item.id, data?.map((d) => d.signedUrl ?? '') ?? []);
    }),
  );

  const { data: rawProps } = await supabase
    .from('properties')
    .select('id, address, leases(id, start_date, end_date)')
    .order('address');

  const properties = ((rawProps ?? []) as unknown as PropertyWithLease[]).map((p) => ({
    id: p.id,
    address: p.address,
    leases: Array.isArray(p.leases) ? p.leases : p.leases ? [p.leases] : [],
  }));

  // Build room map from existing items
  const roomMap = new Map<string, typeof items>();
  for (const itm of items) {
    const list = roomMap.get(itm.room) ?? [];
    list.push(itm);
    roomMap.set(itm.room, list);
  }

  function uid() {
    return Math.random().toString(36).slice(2);
  }

  const initialRooms = Array.from(roomMap.entries()).map(([room, roomItems]) => ({
    id: uid(),
    name: room,
    items: roomItems.map((itm) => ({
      id: uid(),
      item: itm.item,
      condition: itm.condition as
        | 'excellent'
        | 'good'
        | 'fair'
        | 'poor'
        | 'damaged'
        | 'na',
      notes: itm.notes ?? '',
      photos: [] as File[],
      photoPreviewUrls: signedUrlsMap.get(itm.id) ?? [],
      photoPaths: itm.photo_urls,
    })),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit inspection"
        description="Update the inspection record. Changes are saved as a new version."
      />
      <NewInspectionForm
        properties={properties}
        editInspectionId={params.id}
        initialData={{
          propertyId: insp.property_id,
          leaseId: insp.lease_id,
          type: insp.type,
          conductedDate: insp.conducted_date,
          overallNotes: insp.overall_notes ?? '',
          rooms: initialRooms,
        }}
      />
    </div>
  );
}
