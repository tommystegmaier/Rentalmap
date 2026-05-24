import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { FileText } from 'lucide-react';

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Documents" description="Lease, addendums, insurance, tax docs" />
      <EmptyState
        icon={<FileText size={32} />}
        title="Documents vault coming next"
        description="Upload lease PDFs, mark documents as tenant-visible, store inspection reports."
      />
    </div>
  );
}
