import { PageHeader } from '@/components/page-header';
import { NewVendorForm } from './form';

export default function NewVendorPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Add vendor" />
      <NewVendorForm />
    </div>
  );
}
