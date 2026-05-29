import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { RecurringExpenseForm } from '../../new/form';
import { DeleteRecurringExpenseButton } from './delete-button';

export default async function EditRecurringExpensePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: rec }, { data: properties }] = await Promise.all([
    supabase
      .from('recurring_expenses')
      .select('id, property_id, amount_cents, category, vendor, notes, tax_deductible, frequency, next_due_date')
      .eq('id', params.id)
      .maybeSingle(),
    supabase.from('properties').select('id, address').eq('owner_id', user!.id).order('address'),
  ]);

  if (!rec) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Edit recurring expense" />
      <RecurringExpenseForm
        properties={properties ?? []}
        initial={{
          id: rec.id,
          propertyId: rec.property_id,
          amountCents: rec.amount_cents,
          category: rec.category,
          vendor: rec.vendor,
          notes: rec.notes,
          taxDeductible: rec.tax_deductible,
          frequency: rec.frequency as 'monthly' | 'quarterly' | 'annually',
          nextDueDate: rec.next_due_date,
        }}
      />
      <DeleteRecurringExpenseButton id={rec.id} />
    </div>
  );
}
