import { createBrowserClient } from '@supabase/ssr';

// TODO: After connecting Supabase, regenerate strict types with:
//   npx supabase gen types typescript --project-id <id> > lib/types/database.ts
// then re-add the <Database> generic here.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
