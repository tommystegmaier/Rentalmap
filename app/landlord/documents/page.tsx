import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default async function DocumentsPage() {
  const supabase = createClient();
  const { data: documents } = await supabase
    .from('documents')
    .select('*, properties:property_id(address)')
    .order('date_added', { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Lease, addendums, insurance, tax docs — uploaded from each property's page"
      />

      {documents && documents.length > 0 ? (
        <div className="space-y-2">
          {documents.map((d: {
            id: string;
            filename: string;
            type: string;
            visible_to_tenant: boolean;
            date_added: string;
            properties: { address: string } | { address: string }[] | null;
          }) => {
            const propObj = Array.isArray(d.properties) ? d.properties[0] : d.properties;
            return (
              <Card key={d.id}>
                <CardContent className="flex items-center justify-between gap-2 p-3 text-sm">
                  <div className="min-w-0">
                    <a
                      href={`/api/documents/${d.id}/download`}
                      className="block truncate font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {d.filename}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {d.type} · {propObj?.address ?? '—'} ·{' '}
                      {format(parseISO(d.date_added), 'PP')}
                    </p>
                  </div>
                  <Badge
                    className={
                      d.visible_to_tenant
                        ? 'border-transparent bg-success/10 text-success'
                        : 'border-transparent bg-muted text-muted-foreground'
                    }
                  >
                    {d.visible_to_tenant ? 'Shared' : 'Landlord'}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<FileText size={32} />}
          title="No documents yet"
          description="Open a property and tap Upload in the Documents section."
        />
      )}

      <p className="text-xs text-muted-foreground">
        To upload, open a property and use the Documents card.{' '}
        <Link
          href="/landlord/properties"
          className="text-primary underline-offset-4 hover:underline"
        >
          Go to properties
        </Link>
      </p>
    </div>
  );
}
