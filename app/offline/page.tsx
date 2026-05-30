import { Logo } from '@/components/logo';
import { WifiOff } from 'lucide-react';

export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo size={56} />
      <WifiOff size={28} className="text-muted-foreground" />
      <h1 className="text-xl font-semibold tracking-tight">You&apos;re offline</h1>
      <p className="text-sm text-muted-foreground">
        Pages you&apos;ve already opened are still available. Reconnect to load anything new or to
        pay rent, send messages, and submit work orders.
      </p>
    </main>
  );
}
