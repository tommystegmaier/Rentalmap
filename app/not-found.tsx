import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-sm text-muted-foreground">That page doesn&apos;t exist.</p>
      <Button asChild>
        <Link href="/">Go home</Link>
      </Button>
    </main>
  );
}
