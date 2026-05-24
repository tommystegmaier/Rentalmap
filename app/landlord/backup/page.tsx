import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function BackupPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Backup & restore" />

      <Card>
        <CardHeader>
          <CardTitle>Export to JSON</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Downloads a full export of properties, leases, payments, expenses, work orders, and
            documents metadata. Save to the iOS Files app — iCloud Drive will sync it.
          </p>
          <Button asChild>
            <a href="/api/backup" download="rentalmap-backup.json">
              Download backup
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import JSON</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Restore from a backup file. Coming next.
        </CardContent>
      </Card>
    </div>
  );
}
