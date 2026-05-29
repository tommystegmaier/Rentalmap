// Shared metadata + deep-link helpers for the P2P payment claim system
// (Venmo / Cash App / Zelle).

export type P2PMethod = 'venmo' | 'cashapp' | 'zelle';

export const P2P_METHODS: P2PMethod[] = ['venmo', 'cashapp', 'zelle'];

export const P2P_LABELS: Record<P2PMethod, string> = {
  venmo: 'Venmo',
  cashapp: 'Cash App',
  zelle: 'Zelle',
};

export function isP2PMethod(value: unknown): value is P2PMethod {
  return value === 'venmo' || value === 'cashapp' || value === 'zelle';
}

// The landlord's stored handle column for each method.
export type LandlordHandles = {
  venmo_handle: string | null;
  cashapp_cashtag: string | null;
  zelle_handle: string | null;
};

export function handleForMethod(method: P2PMethod, handles: LandlordHandles): string | null {
  switch (method) {
    case 'venmo':
      return handles.venmo_handle?.trim() || null;
    case 'cashapp':
      return handles.cashapp_cashtag?.trim() || null;
    case 'zelle':
      return handles.zelle_handle?.trim() || null;
  }
}

// How the handle is displayed to the tenant (with the network's sigil).
export function displayHandle(method: P2PMethod, handle: string): string {
  const clean = handle.replace(/^[@$]/, '');
  if (method === 'cashapp') return `$${clean}`;
  if (method === 'venmo') return `@${clean}`;
  return clean; // Zelle is an email or phone — show as-is
}

// Build a deep link that opens the payment app pre-filled with the amount.
// Returns null for methods without a reliable link (Zelle), where the tenant
// must enter the handle manually in their banking app.
export function p2pDeepLink(
  method: P2PMethod,
  handle: string,
  amountCents: number,
  note?: string,
): string | null {
  const clean = handle.replace(/^[@$]/, '').trim();
  if (!clean) return null;
  const dollars = (amountCents / 100).toFixed(2);

  if (method === 'cashapp') {
    // e.g. https://cash.app/$johndoe/25.00 — opens Cash App with amount prefilled.
    return `https://cash.app/$${encodeURIComponent(clean)}/${dollars}`;
  }
  if (method === 'venmo') {
    // Venmo web payment link; redirects into the app on mobile.
    const params = new URLSearchParams({
      txn: 'pay',
      recipients: clean,
      amount: dollars,
    });
    if (note) params.set('note', note);
    return `https://venmo.com/?${params.toString()}`;
  }
  return null;
}
