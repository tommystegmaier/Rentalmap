'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, isSameDay, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface ConversationMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

interface Props {
  currentUserId: string;
  otherUserId: string;
  otherUserLabel: string;
  leaseId: string | null;
  messages: ConversationMessage[];
}

export function ConversationView({
  currentUserId,
  otherUserId,
  otherUserLabel,
  leaseId,
  messages,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_id: otherUserId,
          body: draft.trim(),
          lease_id: leaseId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to send');
      setDraft('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-2">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            No messages yet. Say hi to {otherUserLabel}.
          </div>
        ) : (
          messages.map((m, i) => {
            const isMine = m.sender_id === currentUserId;
            const prev = messages[i - 1];
            const showDate =
              !prev || !isSameDay(parseISO(prev.created_at), parseISO(m.created_at));
            return (
              <div key={m.id} className="space-y-1">
                {showDate ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    {format(parseISO(m.created_at), 'PP')}
                  </p>
                ) : null}
                <div
                  className={cn(
                    'flex',
                    isMine ? 'justify-end' : 'justify-start',
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm',
                      isMine
                        ? 'rounded-br-md bg-primary text-primary-foreground'
                        : 'rounded-bl-md bg-secondary text-secondary-foreground',
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p
                      className={cn(
                        'mt-1 text-[10px]',
                        isMine ? 'text-primary-foreground/70' : 'text-muted-foreground',
                      )}
                    >
                      {format(parseISO(m.created_at), 'p')}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSend} className="sticky bottom-2 space-y-2 rounded-2xl border bg-card p-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder={`Message ${otherUserLabel}…`}
          required
          maxLength={5000}
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={busy || !draft.trim()}>
            {busy ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </form>
    </div>
  );
}
