'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const DISMISSED_KEY = 'setup_checklist_dismissed';

interface Step {
  label: string;
  description: string;
  done: boolean;
  href: string;
  cta: string;
}

interface Props {
  hasProperty: boolean;
  hasLease: boolean;
  hasTenant: boolean;
  hasStripe: boolean;
}

export function SetupChecklist({ hasProperty, hasLease, hasTenant, hasStripe }: Props) {
  const allDone = hasProperty && hasLease && hasTenant && hasStripe;
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_KEY) === '1');
  }, []);

  if (allDone || dismissed) return null;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }

  const steps: Step[] = [
    {
      label: 'Add your first property',
      description: 'Enter the address and details for a rental you own.',
      done: hasProperty,
      href: '/landlord/properties/new',
      cta: 'Add property',
    },
    {
      label: 'Create a lease',
      description: 'Set rent amount, due date, and lease dates.',
      done: hasLease,
      href: hasProperty ? '/landlord/properties' : '/landlord/properties/new',
      cta: 'Create lease',
    },
    {
      label: 'Invite your tenant',
      description: 'Send an invitation so your tenant can log in and pay rent.',
      done: hasTenant,
      href: '/landlord/invite',
      cta: 'Invite tenant',
    },
    {
      label: 'Set up online payments',
      description: 'Connect Stripe to accept ACH and card payments directly.',
      done: hasStripe,
      href: '/landlord/settings',
      cta: 'Connect Stripe',
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Get started — {completedCount}/{steps.length} complete
          </CardTitle>
          <button
            type="button"
            aria-label="Dismiss setup checklist"
            onClick={dismiss}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50"
          >
            <X size={15} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step) => (
          <div key={step.label} className="flex items-start gap-3">
            {step.done ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
            ) : (
              <Circle size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${step.done ? 'text-muted-foreground line-through' : ''}`}>
                {step.label}
              </p>
              {!step.done ? (
                <p className="text-xs text-muted-foreground">{step.description}</p>
              ) : null}
            </div>
            {!step.done && step === nextStep ? (
              <Button asChild size="sm" className="shrink-0">
                <Link href={step.href}>{step.cta}</Link>
              </Button>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
