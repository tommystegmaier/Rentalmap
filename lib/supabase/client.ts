import { createBrowserClient } from '@supabase/ssr';

// TODO: After connecting Supabase, regenerate strict types with:
//   npx supabase gen types typescript --project-id <id> > lib/types/database.ts
// then re-add the <Database> generic here.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Persistent cookies (400 days, browser cap) instead of session-only.
      // Without this, closing the PWA/browser logs the user back out.
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 400,
      },
    },
  );
}
